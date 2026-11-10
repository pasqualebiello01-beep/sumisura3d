/* =====================================================================
   Sumisura 3D — checkout Stripe (logica comune)
   Usato da worker.js (Cloudflare Workers), functions/ (Cloudflare Pages)
   e server.js (Node). Nessuna dipendenza: parla con l'API Stripe via fetch.

   Sicurezza:
   - i prezzi vengono ricalcolati qui da assets/js/products.js: il browser
     invia solo id prodotto, opzioni e quantità;
   - i pezzi su misura (price: null, opzione custom o nota di modifica) vengono rifiutati:
     vanno richiesti con il preventivo WhatsApp;
   - con una chiave "live" i prodotti di esempio (placeholder) non sono vendibili.
   ===================================================================== */
import { S3D_PRODUCTS, S3D_SHIPPING } from "../assets/js/products.js";

const STRIPE_API = "https://api.stripe.com/v1";
const MAX_ITEMS = 50;

export class CheckoutError extends Error {
  constructor(message, status = 400, code = "invalid") { super(message); this.status = status; this.code = code; }
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const cents = (euro) => Math.round(euro * 100);

/** Prezzo unitario in euro e controllo delle opzioni scelte */
function priceFor(product, options) {
  if (product.price == null) throw new CheckoutError(`"${product.name}" è un prodotto su misura: richiedi il preventivo su WhatsApp.`, 400, "custom");
  let total = product.price;
  const chosen = {};
  for (const v of product.variants || []) {
    const label = options && options[v.name];
    const opt = v.options.find((o) => o.label === label) || v.options.find((o) => !o.priceDelta) || v.options[0];
    if (label && opt.label !== label) throw new CheckoutError(`Opzione non valida per "${product.name}": ${v.name}.`);
    if (opt.custom) throw new CheckoutError(`"${product.name}" con ${v.name} "${opt.label}" è su misura: richiedi il preventivo su WhatsApp.`, 400, "custom");
    total += opt.priceDelta || 0;
    chosen[v.name] = opt.label;
  }
  return { unit: Math.max(0, total), chosen };
}

/** Immagine del prodotto nelle opzioni scelte (es. il colore), per la pagina di pagamento */
function imageFor(product, chosen) {
  const slug = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (product.imageVariants && product.imageViews) {
    const vals = product.imageVariants.map((n) => chosen[n]).filter(Boolean);
    return `assets/img/prodotti/${product.id}-${vals.map(slug).join("-")}${product.imageViews[0].suffix}.webp`;
  }
  for (const v of product.variants || []) {
    const o = v.options.find((x) => x.label === chosen[v.name]);
    if (o && o.images && o.images[0]) return o.images[0].src;
  }
  return product.images && product.images[0] ? product.images[0].src : null;
}

/** Converte un oggetto annidato nel formato form-urlencoded dell'API Stripe */
function encode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

async function stripe(env, path, { method = "GET", body } = {}, fetchImpl = fetch) {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new CheckoutError("Pagamenti non ancora attivi: manca la chiave Stripe sul server.", 503, "not_configured");
  const res = await fetchImpl(`${env.STRIPE_API_BASE || STRIPE_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: body ? encode(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || `Errore Stripe ${res.status}`;
    throw new CheckoutError(msg, 502, "stripe");
  }
  return data;
}

/* ---------------------------------------------------------------- foto su Stripe
   Stripe deve scaricare le foto dal sito, ma la protezione di Cloudflare può bloccarlo.
   Per essere sicuri, la prima volta che una variante viene ordinata il server carica la foto
   direttamente su Stripe (file + link pubblico) e crea un "prodotto" Stripe con quella foto.
   Dagli ordini successivi riusa lo stesso prodotto. Se qualcosa va storto, si torna al link del sito. */
async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readAsset(env, origin, path, fetchImpl) {
  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    const r = await env.ASSETS.fetch(new Request(new URL("/" + path, origin)));
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
    return null;
  }
  if (env.READ_ASSET) return env.READ_ASSET(path); // server.js (Node)
  const r = await (fetchImpl || fetch)(new URL("/" + path, origin));
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

async function uploadToStripe(env, bytes, filename, fetchImpl = fetch) {
  const form = new FormData();
  form.append("purpose", "business_logo");
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), filename);
  const base = env.STRIPE_API_BASE || "https://files.stripe.com/v1";
  const res = await fetchImpl(`${base}/files`, { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2024-06-20" }, body: form });
  const file = await res.json().catch(() => ({}));
  if (!res.ok || !file.id) throw new Error("upload");
  const link = await stripe(env, "/file_links", { method: "POST", body: { file: file.id } }, fetchImpl);
  if (!link.url) throw new Error("file_link");
  return link.url;
}

/** Restituisce l'id di un prodotto Stripe con nome, descrizione e foto, creandolo se serve. */
async function stripeProduct(env, origin, { p, optText, imgPath }, fetchImpl) {
  if (!imgPath || !env.STRIPE_SECRET_KEY) return null;
  const mode = String(env.STRIPE_SECRET_KEY).startsWith("sk_live") ? "live" : "test";
  const id = "s3d_" + (await sha([mode, p.id, p.name, optText, imgPath].join("|")));
  try { await stripe(env, `/products/${id}`, {}, fetchImpl); return id; } catch (e) { /* non esiste ancora */ }
  try {
    const bytes = await readAsset(env, origin, imgPath, fetchImpl);
    if (!bytes) return null;
    const url = await uploadToStripe(env, bytes, imgPath.split("/").pop(), fetchImpl);
    await stripe(env, "/products", { method: "POST", body: {
      id, name: p.name, description: optText ? optText.slice(0, 500) : undefined,
      images: { 0: url }, metadata: { product_id: p.id, sito: "sumisura3d" } } }, fetchImpl);
    return id;
  } catch (e) {
    // due ordini contemporanei possono averlo appena creato: riprova a leggerlo
    try { await stripe(env, `/products/${id}`, {}, fetchImpl); return id; } catch (e2) { return null; }
  }
}

/**
 * Crea una sessione Stripe Checkout.
 * body: { items: [{ id, options, qty, note }] }   origin: es. "https://www.sumisura3d.it"
 * Restituisce { url } a cui reindirizzare il cliente.
 */
export async function createCheckout(body, { env, origin, fetchImpl }) {
  const items = Array.isArray(body && body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (!items.length) throw new CheckoutError("Il carrello è vuoto.");
  const live = String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
  const lineItems = [];
  const notes = [];
  const prepared = items.map((it) => {
    const p = S3D_PRODUCTS.find((x) => x.id === it.id);
    if (!p) throw new CheckoutError("Un prodotto del carrello non esiste più. Aggiorna la pagina.", 400, "unknown_product");
    if (live && p.placeholder) throw new CheckoutError(`"${p.name}" è un prodotto di esempio e non può essere venduto.`, 400, "placeholder");
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    if (str(it.note, 400)) throw new CheckoutError(`"${p.name}" ha una richiesta di modifica: è su misura, richiedi il preventivo su WhatsApp.`, 400, "custom");
    const { unit, chosen } = priceFor(p, it.options || {});
    const optText = Object.entries(chosen).map(([k, v]) => `${k}: ${v}`).join(", ");
    const note = str(it.note, 400);
    // Stripe non mostra le immagini WebP: usiamo la copia JPG in assets/img/checkout/
    const imgPath = (imageFor(p, chosen) || "").replace(/^assets\/img\/prodotti\/(.+)\.webp$/, "assets/img/checkout/$1.jpg") || null;
    notes.push(`${qty}× ${p.id}${optText ? ` [${optText}]` : ""}${note ? ` {${note}}` : ""}`);
    return { p, qty, unit, optText, imgPath };
  });

  const productIds = await Promise.all(prepared.map((x) => stripeProduct(env, origin, x, fetchImpl).catch(() => null)));
  prepared.forEach((x, i) => {
    const img = x.imgPath ? new URL(x.imgPath, origin).href : null;
    const price_data = { currency: "eur", unit_amount: cents(x.unit) };
    if (productIds[i]) price_data.product = productIds[i];
    else price_data.product_data = {
      name: x.p.name,
      description: x.optText ? x.optText.slice(0, 500) : undefined,
      images: img ? { 0: img } : undefined,
      metadata: { product_id: x.p.id }
    };
    lineItems.push({ quantity: x.qty, price_data });
  });

  // Riepilogo leggibile nei metadati dell'ordine (max 500 caratteri per campo)
  const metadata = {};
  notes.join(" | ").match(/.{1,490}/g).slice(0, 10).forEach((chunk, i) => { metadata[`ordine_${i + 1}`] = chunk; });

  const session = await stripe(env, "/checkout/sessions", {
    method: "POST",
    body: {
      mode: "payment",
      locale: "it",
      line_items: Object.fromEntries(lineItems.map((l, i) => [i, l])),
      shipping_address_collection: { allowed_countries: Object.fromEntries(S3D_SHIPPING.countries.map((c, i) => [i, c])) },
      shipping_options: { 0: { shipping_rate_data: { type: "fixed_amount", display_name: `Spedizione ${S3D_SHIPPING.label}`, fixed_amount: { amount: cents(S3D_SHIPPING.amount), currency: "eur" } } } },
      phone_number_collection: { enabled: "true" },
      billing_address_collection: "auto",
      success_url: `${origin}/ordine-confermato.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/carrello.html?pagamento=annullato`,
      metadata
    }
  }, fetchImpl);
  if (!session.url) throw new CheckoutError("Stripe non ha restituito la pagina di pagamento.", 502, "stripe");
  return { url: session.url };
}

/** Stato di un ordine dopo il pagamento (per la pagina di conferma) */
export async function getOrder(sessionId, { env, fetchImpl }) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId || "")) throw new CheckoutError("Codice ordine non valido.");
  const s = await stripe(env, `/checkout/sessions/${sessionId}`, {}, fetchImpl);
  return {
    paid: s.payment_status === "paid",
    status: s.payment_status,
    amount: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
    currency: s.currency,
    email: s.customer_details ? s.customer_details.email : null,
    name: s.customer_details ? s.customer_details.name : null,
    reference: s.id.slice(-8).toUpperCase()
  };
}

/**
 * Richiesta di recesso (art. 54-bis Codice del consumo).
 * body: { name, email, reference, items, reason }
 * Cerca l'ordine su Stripe dal riferimento (ultime 8 cifre della sessione) e, se lo trova,
 * registra la richiesta nei "metadata" del pagamento: la vedi nella dashboard Stripe.
 * La richiesta è valida anche se l'ordine non viene trovato: il cliente riceve comunque la ricevuta.
 */
export async function requestWithdrawal(body, { env, fetchImpl }) {
  const name = str(body && body.name, 120), email = str(body && body.email, 200);
  const reference = str(body && body.reference, 40).toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const items = str(body && body.items, 400), reason = str(body && body.reason, 400);
  if (!name) throw new CheckoutError("Inserisci nome e cognome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("Inserisci un indirizzo email valido.");
  if (reference.length < 4) throw new CheckoutError("Inserisci il riferimento dell'ordine.");
  const receivedAt = new Date().toISOString();
  let found = false;
  if (env.STRIPE_SECRET_KEY) {
    try {
      let after = null;
      for (let page = 0; page < 5 && !found; page++) {
        const list = await stripe(env, `/checkout/sessions?limit=100${after ? `&starting_after=${after}` : ""}`, {}, fetchImpl);
        const s = (list.data || []).find((x) => x.id.slice(-8).toUpperCase() === reference.slice(-8) && x.payment_status === "paid");
        if (s) {
          found = true;
          if (s.payment_intent) {
            const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent.id;
            await stripe(env, `/payment_intents/${pi}`, { method: "POST", body: { metadata: {
              recesso_richiesto: receivedAt, recesso_nome: name, recesso_email: email,
              recesso_prodotti: items || "tutti", recesso_motivo: reason || "-" } } }, fetchImpl);
          }
        }
        if (!list.has_more || !list.data || !list.data.length) break;
        after = list.data[list.data.length - 1].id;
      }
    } catch (e) { found = false; }
  }
  return { receivedAt, found, reference, name, email, items, reason };
}

/** Gestione HTTP comune (Request → Response), usata da Worker e Pages */
export async function handleApi(request, env) {
  const url = new URL(request.url);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  try {
    if (url.pathname === "/api/checkout") {
      if (request.method !== "POST") return json({ ok: false, error: "Metodo non consentito." }, 405);
      const body = await request.json().catch(() => null);
      if (!body) return json({ ok: false, error: "Richiesta non valida." }, 400);
      const origin = env.SITE_URL || url.origin;
      const { url: checkoutUrl } = await createCheckout(body, { env, origin });
      return json({ ok: true, url: checkoutUrl });
    }
    if (url.pathname === "/api/order") {
      const order = await getOrder(url.searchParams.get("session_id"), { env });
      return json({ ok: true, order });
    }
    if (url.pathname === "/api/recesso") {
      if (request.method !== "POST") return json({ ok: false, error: "Metodo non consentito." }, 405);
      const body = await request.json().catch(() => null);
      if (!body) return json({ ok: false, error: "Richiesta non valida." }, 400);
      const result = await requestWithdrawal(body, { env });
      return json({ ok: true, ...result });
    }
    return null; // non è una rotta API
  } catch (err) {
    const status = err instanceof CheckoutError ? err.status : 500;
    return json({ ok: false, error: err instanceof CheckoutError ? err.message : "Errore interno del server.", code: err.code || "error" }, status);
  }
}
