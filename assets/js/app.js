/* =====================================================================
   Sumisura 3D — funzioni comuni (layout, tema, carrello, moduli)
   ===================================================================== */
(function () {
  "use strict";
  const C = window.S3D_CONFIG || {};
  const PRODUCTS = window.S3D_PRODUCTS || [];
  const CATS = window.S3D_CATEGORIES || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) document.documentElement.classList.add("no-motion");
  if (!C.showPlaceholders) document.documentElement.classList.add("ph-hidden");

  /* ------------------------------------------------------------ utility */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: C.currency || "EUR" });
  const money = (n) => (n == null ? "Su preventivo" : fmt.format(n));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } }
  };
  const product = (id) => PRODUCTS.find((p) => p.id === id);
  /** Link WhatsApp: sul telefono apre l'app (wa.me), sul computer apre direttamente
   *  WhatsApp Web, evitando la pagina intermedia api.whatsapp.com che alcuni browser bloccano */
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const waUrl = (text) => {
    const t = text ? encodeURIComponent(text) : "";
    return isMobileDevice
      ? `https://wa.me/${C.whatsapp}${t ? `?text=${t}` : ""}`
      : `https://web.whatsapp.com/send?phone=${C.whatsapp}${t ? `&text=${t}` : ""}`;
  };
  const category = (id) => CATS.find((c) => c.id === id);
  const thumbSrc = (src) => src.replace(/\.webp$/, "-600.webp");
  /** Miniature responsive: versione da 300 px per gli schermi piccoli, 600 px per gli altri.
   *  Se la versione -300 manca, l'immagine ripiega da sola su quella grande. */
  const thumbSet = (src) => `${src.replace(/\.webp$/, "-300.webp")} 300w, ${src.replace(/\.webp$/, "-600.webp")} 600w`;
  const thumbFallback = (src) => `this.onerror=null;this.removeAttribute('srcset');this.src='${src}'`;
  const ph = (label) => `<span class="ph ph-only">[${esc(label)}]</span>`;

  function unitPrice(p, options) {
    if (!p || p.price == null) return null;
    let total = p.price;
    (p.variants || []).forEach((v) => {
      const o = v.options.find((x) => x.label === (options || {})[v.name]);
      if (o) total += o.priceDelta || 0;
    });
    return Math.max(0, total);
  }
  /** Opzione predefinita di una variante: la prima senza sovrapprezzo */
  function defaultOption(v) { return (v.options.find((o) => !o.priceDelta) || v.options[0]).label; }
  function defaultOptions(p) { const o = {}; (p.variants || []).forEach((v) => { o[v.name] = defaultOption(v); }); return o; }
  function selectedOption(p, options, key) {
    for (const v of p.variants || []) { const o = v.options.find((x) => x.label === (options || {})[v.name]); if (o && o[key]) return o; }
    return null;
  }
  /** Foto da mostrare per le opzioni scelte (es. il colore), altrimenti quelle del prodotto */
  const slug = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const imgCache = new Map();
  function imagesFor(p, options) {
    options = options || defaultOptions(p);
    if (p.imageVariants && p.imageViews) {
      // foto che dipendono da più varianti: <id>-<valore1>-<valore2><suffisso>.webp
      const vals = p.imageVariants.map((n) => options[n]).filter(Boolean);
      const key = p.id + "|" + vals.join("|");
      if (!imgCache.has(key)) {
        const base = `assets/img/prodotti/${p.id}-${vals.map(slug).join("-")}`;
        imgCache.set(key, p.imageViews.map((v) => ({ src: `${base}${v.suffix}.webp`, alt: `${p.name}, ${vals.join(", ").toLowerCase()}, ${v.label}` })));
      }
      return imgCache.get(key);
    }
    const o = selectedOption(p, options, "images"); return o ? o.images : p.images;
  }
  /** Modello 3D per le opzioni scelte (es. un attacco diverso), altrimenti quello del prodotto */
  function modelFor(p, options) { const o = selectedOption(p, options || defaultOptions(p), "model"); return o ? o.model : p.model; }
  /** Colore da applicare al modello 3D per le opzioni scelte */
  function colorFor(p, options) { const o = selectedOption(p, options || defaultOptions(p), "color"); return o ? o.color : null; }
  /** Pallino colore nelle scelte di variante */
  function swatch(o) { return o.color ? `<i class="swatch" style="background:${o.color}" aria-hidden="true"></i>` : ""; }
  /** Pezzo su misura → preventivo WhatsApp: senza prezzo fisso, con un'opzione custom
   *  oppure con una nota di modifica scritta dal cliente */
  function isCustom(p, options, note) {
    if (!p) return true;
    if (p.price == null) return true;
    if (note && String(note).trim()) return true;
    return (p.variants || []).some((v) => { const o = v.options.find((x) => x.label === (options || {})[v.name]); return o && o.custom; });
  }
  const SHIPPING = window.S3D_SHIPPING || { amount: 0, label: "" };
  function minPrice(p) {
    if (p.price == null) return null;
    let min = p.price;
    (p.variants || []).forEach((v) => { min += Math.min(...v.options.map((o) => o.priceDelta || 0)); });
    return Math.max(0, min);
  }
  function hasPriceRange(p) {
    return (p.variants || []).some((v) => new Set(v.options.map((o) => o.priceDelta || 0)).size > 1);
  }

  /* ------------------------------------------------------------ icone */
  const ICON = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
    moon: '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>',
    sun: '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3.5 35 12 20 20.5 5 12Z" fill="#FF5A1F"/><path d="M5 12 20 20.5V37L5 28.5Z" fill="currentColor"/><path d="M35 12 20 20.5V37L35 28.5Z" fill="currentColor" opacity=".62"/><path d="M7.5 18.6 17.5 24.3M7.5 22.6 17.5 28.3M7.5 26.6 17.5 32.3" stroke="var(--bg)" stroke-width="1.1" opacity=".55"/></svg>`;
  const logoHTML = `<a class="logo" href="index.html" aria-label="Sumisura 3D, vai alla homepage">${LOGO}<span class="logo-word">Sumisura<span> 3D</span></span></a>`;

  /* ------------------------------------------------------------ layout */
  const NAV = [
    ["index.html", "Home", "home"],
    ["catalogo.html", "Catalogo", "catalog"],
    ["chi-siamo.html", "Chi siamo", "about"],
    ["faq.html", "FAQ", "faq"],
    ["contatti.html", "Contatti", "contact"]
  ];
  function renderHeader() {
    const el = $("#site-header");
    if (!el) return;
    const page = document.body.dataset.page;
    el.innerHTML = `
      <div class="wrap header-inner">
        ${logoHTML}
        <nav class="main-nav" id="main-nav" aria-label="Principale">
          <ul>${NAV.map(([h, l, k]) => `<li><a href="${h}"${k === page ? ' aria-current="page"' : ""}>${l}</a></li>`).join("")}</ul>
        </nav>
        <div class="header-actions">
          <button class="icon-btn theme-toggle" type="button" aria-label="Cambia tema chiaro o scuro">${ICON.moon}${ICON.sun}</button>
          <a class="icon-btn cart-link" href="carrello.html" aria-label="Carrello"${page === "cart" ? ' aria-current="page"' : ""}>${ICON.cart}<span class="cart-count" aria-hidden="true" data-empty="true">0</span></a>
          <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Apri il menu">${ICON.menu}</button>
        </div>
      </div>`;
    const toggle = $(".menu-toggle", el);
    const setMenu = (open) => {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Chiudi il menu" : "Apri il menu");
      toggle.innerHTML = open ? ICON.close : ICON.menu;
    };
    toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("nav-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("nav-open")) { setMenu(false); toggle.focus(); } });
    $$(".main-nav a", el).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    window.matchMedia("(min-width: 901px)").addEventListener("change", (m) => { if (m.matches) setMenu(false); });

    $(".theme-toggle", el).addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store.set("s3d-theme", next);
    });
    const onScroll = () => el.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  function renderFooter() {
    const el = $("#site-footer");
    if (!el) return;
    const year = new Date().getFullYear();
    const contact = [];
    if (C.whatsapp) contact.push(`<li><a href="${esc(waUrl())}" rel="noopener noreferrer" referrerpolicy="no-referrer">WhatsApp</a></li>`);
    if (C.email) contact.push(`<li><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>`);
    if (C.phone) contact.push(`<li><a href="tel:${esc(C.phone.replace(/\s/g, ""))}">${esc(C.phone)}</a></li>`);
    if (C.instagram) contact.push(`<li><a href="${esc(C.instagram)}" rel="noopener">Instagram</a></li>`);
    if (C.openingHours) contact.push(`<li>${esc(C.openingHours)}</li>`);
    contact.push(`<li><a href="contatti.html">Modulo di contatto</a></li>`);
    el.innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            ${logoHTML}
            <p class="small">Stampa 3D su ordinazione: ricambi introvabili, prototipi e progetti personalizzati.</p>
          </div>
          <div><h2>Negozio</h2><ul>
            <li><a href="catalogo.html">Catalogo</a></li>
            ${CATS.map((c) => `<li><a href="catalogo.html#${c.id}">${esc(c.name)}</a></li>`).join("")}
            <li><a href="carrello.html">Carrello</a></li></ul></div>
          <div><h2>Informazioni</h2><ul>
            <li><a href="chi-siamo.html">Chi siamo</a></li>
            <li><a href="spedizioni.html">Spedizioni</a></li>
            <li><a href="faq.html">Domande frequenti</a></li>
            <li><a href="privacy.html">Privacy</a></li></ul></div>
          <div><h2>Contatti</h2><ul>${contact.join("")}</ul></div>
        </div>
        <div class="footer-bottom">
          <span>© ${year} ${esc(C.legalName || C.brand)}${C.vatNumber ? ` · P.IVA ${esc(C.vatNumber)}` : ""}</span>
          ${C.address ? `<span>${esc(C.address)}</span>` : ""}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ toast */
  function toast(msg, link) {
    let region = $(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region"; region.setAttribute("role", "status"); region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<p>${esc(msg)}</p>${link ? `<a href="${esc(link.href)}">${esc(link.label)}</a>` : ""}`;
    region.appendChild(t);
    setTimeout(() => { t.remove(); }, 5000);
  }

  /* ------------------------------------------------------------ carrello */
  const CART_KEY = "s3d-cart-v1";
  let memoryCart = null; // usato se localStorage non è disponibile
  const Cart = {
    items() { const s = store.get(CART_KEY, null); return (s || memoryCart || []).filter((i) => product(i.id)); },
    save(items) { memoryCart = items; store.set(CART_KEY, items); updateBadge(true); document.dispatchEvent(new CustomEvent("cart:change")); },
    key(id, options, note) { return id + "|" + JSON.stringify(options || {}) + "|" + (note || "").trim(); },
    add(id, options, qty, note) {
      const items = this.items();
      const key = this.key(id, options, note);
      const found = items.find((i) => i.key === key);
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({ key, id, options: options || {}, qty, note: (note || "").trim() });
      this.save(items);
    },
    setQty(key, qty) {
      const items = this.items();
      const it = items.find((i) => i.key === key);
      if (it) it.qty = Math.max(1, Math.min(99, qty));
      this.save(items);
    },
    remove(key) { this.save(this.items().filter((i) => i.key !== key)); },
    clear() { this.save([]); },
    count() { return this.items().reduce((n, i) => n + i.qty, 0); },
    /** Prodotti pagabili online (catalogo) e prodotti su misura (preventivo WhatsApp) */
    orderable() { return this.items().filter((i) => !isCustom(product(i.id), i.options, i.note)); },
    custom() { return this.items().filter((i) => isCustom(product(i.id), i.options, i.note)); },
    removeMany(keys) { const k = new Set(keys); this.save(this.items().filter((i) => !k.has(i.key))); },
    totals(items) {
      let total = 0, quoteOnly = false;
      (items || this.items()).forEach((i) => {
        const u = unitPrice(product(i.id), i.options);
        if (u == null) quoteOnly = true; else total += u * i.qty;
      });
      return { total, quoteOnly };
    },
    /** Riepilogo testuale (per il messaggio WhatsApp dei pezzi su misura) */
    summaryText(items) {
      const list = items || this.items();
      const lines = list.map((i) => {
        const p = product(i.id);
        const opts = Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(", ");
        const u = unitPrice(p, i.options);
        const base = u == null ? "prezzo da definire" : `base ${money(u * i.qty)}`;
        return `- ${i.qty} × ${p.name}${opts ? ` (${opts})` : ""} — ${base}${i.note ? `\n  Note: ${i.note}` : ""}`;
      });
      return lines.join("\n");
    }
  };
  function updateBadge(bump) {
    const n = Cart.count();
    $$(".cart-count").forEach((b) => {
      b.textContent = n > 99 ? "99+" : n; b.dataset.empty = String(n === 0);
      if (bump && !reduceMotion) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    });
    $$(".cart-link").forEach((a) => a.setAttribute("aria-label", n ? `Carrello, ${n} ${n === 1 ? "articolo" : "articoli"}` : "Carrello, vuoto"));
  }
  window.addEventListener("storage", (e) => { if (e.key === CART_KEY) { updateBadge(false); document.dispatchEvent(new CustomEvent("cart:change")); } });

  /* ------------------------------------------------------------ schede prodotto */
  function cardHTML(p, opts = {}) {
    const img = imagesFor(p)[0];
    const cat = category(p.category);
    const mp = minPrice(p);
    const price = mp == null ? "Su preventivo" : `${hasPriceRange(p) ? '<span class="from">da </span>' : ""}${money(mp)}`;
    const badges = [];
    if (p.model) badges.push('<span class="badge badge-3d">Vista 3D</span>');
    if (p.placeholder && C.showPlaceholders) badges.push('<span class="badge badge-ph">Esempio</span>');
    return `
      <article class="card">
        <div class="card-media">
          <img src="${esc(thumbSrc(img.src))}" srcset="${esc(thumbSet(img.src))}" sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 290px" alt="${esc(img.alt)}" width="600" height="600" style="view-transition-name:p-${esc(p.id)}" loading="${opts.eager ? "eager" : "lazy"}" decoding="async"
               onerror="${esc(thumbFallback(img.src))}">
          ${badges.length ? `<div class="card-badges">${badges.join("")}</div>` : ""}
        </div>
        <div class="card-body">
          <span class="card-cat">${esc(cat ? cat.name : "")}</span>
          <h3 class="card-title"><a href="prodotto.html#${esc(p.id)}">${esc(p.name)}</a></h3>
          ${p.short ? `<p class="card-desc">${esc(p.short)}</p>` : ""}
          <span class="card-price">${price}</span>
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------ invio moduli */
  /**
   * Invia una richiesta all'endpoint configurato. Restituisce { ok, id } oppure lancia un errore.
   * Non considera mai una richiesta inviata se il server non risponde con successo.
   */
  async function postJSON(url, data, timeoutMs = 12000) {
    if (!url) throw new Error("no-endpoint");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data), signal: ctrl.signal });
      let body = {};
      try { body = await res.json(); } catch (e) { /* risposta non JSON */ }
      if (!res.ok || body.ok === false) { const err = new Error(body.error || "http-" + res.status); err.status = res.status; throw err; }
      return body;
    } finally { clearTimeout(timer); }
  }

  /** Pannello di ripiego: email, WhatsApp o copia del riepilogo */
  function fallbackHTML(subject, text, reason) {
    const actions = [];
    if (C.email) actions.push(`<a class="btn btn-sm" href="mailto:${esc(C.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}">Invia via email</a>`);
    if (C.whatsapp) actions.push(`<a class="btn btn-sm btn-dark" href="${esc(waUrl(subject + "\n\n" + text))}" rel="noopener">Invia su WhatsApp</a>`);
    actions.push(`<button type="button" class="btn btn-sm btn-ghost" data-copy>Copia il riepilogo</button>`);
    const contacts = [C.email && `email ${esc(C.email)}`, C.phone && `telefono ${esc(C.phone)}`].filter(Boolean).join(" · ");
    return `
      <div class="notice notice-err" role="alert" tabindex="-1">
        <h3>La richiesta non è stata inviata</h3>
        <p>${esc(reason)} I tuoi dati sono ancora nel modulo. Puoi riprovare oppure inviarci lo stesso riepilogo in un altro modo.</p>
        ${contacts ? `<p class="small">Contatti: ${contacts}</p>` : ""}
        ${!C.email && !C.whatsapp ? `<p class="small">${ph("Configurazione: inserisci email e/o WhatsApp in assets/js/config.js per attivare questi pulsanti")}</p>` : ""}
        <div class="fallback-actions">${actions.join("")}</div>
      </div>`;
  }
  function bindCopy(container, text) {
    const b = $("[data-copy]", container);
    if (!b) return;
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); b.textContent = "Riepilogo copiato"; }
      catch (e) {
        const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.width = "100%"; ta.rows = 8;
        b.replaceWith(ta); ta.select();
      }
    });
  }
  function reasonFor(err) {
    if (err && err.message === "no-endpoint") return "L'invio automatico non è configurato.";
    if (err && err.name === "AbortError") return "Il server non ha risposto in tempo.";
    if (err && err.status === 404) return "Il servizio di invio non è attivo su questo sito.";
    if (err && err.status === 429) return "Troppe richieste in poco tempo: attendi un minuto.";
    if (err && err.status === 400) return "Alcuni dati non sono stati accettati dal server.";
    if (err && err.status >= 500) return "Il server ha restituito un errore.";
    if (!navigator.onLine) return "Sembra che tu sia offline.";
    return "Il server non è raggiungibile.";
  }

  /* ------------------------------------------------------------ WhatsApp */
  /**
   * Apre la chat WhatsApp con il messaggio già scritto e mostra nel contenitore
   * un riquadro con il pulsante per riaprirla (se il browser blocca la nuova scheda).
   * Il messaggio parte solo quando il cliente preme Invia in WhatsApp.
   */
  // Dentro un riquadro protetto (es. l'anteprima su claude.ai) la scheda aperta in automatico
  // eredita le restrizioni e WhatsApp la rifiuta: lì si usa solo il pulsante, che apre fuori.
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  function sendViaWhatsApp(text, container, extraHTML) {
    const url = waUrl(text);
    let opened = false;
    if (!inFrame) {
      try { const w = window.open(url, "_blank"); if (w) { w.opener = null; opened = true; } } catch (e) { opened = false; }
    }
    container.innerHTML = `
      <div class="notice notice-ok" role="status" tabindex="-1">
        <h3>${opened ? "Messaggio pronto su WhatsApp" : "Ultimo passo: apri WhatsApp"}</h3>
        <p>${opened ? "Si è aperta la chat WhatsApp di Sumisura 3D con il tuo messaggio già scritto: <strong>premi Invia in WhatsApp</strong> per mandarcelo." : "Premi il pulsante: si apre la chat WhatsApp di Sumisura 3D con il tuo messaggio già scritto, poi <strong>premi Invia in WhatsApp</strong>."}</p>
        <div class="fallback-actions">
          <a class="btn btn-sm" href="${esc(url)}"${inFrame ? "" : ' target="_blank"'} rel="noopener">${opened ? "Riapri WhatsApp" : "Apri WhatsApp e invia"}</a>
          ${extraHTML || ""}
        </div>
      </div>`;
    $(".notice", container).focus();
    return url;
  }

  /**
   * Trasforma il pulsante di invio del modulo in un link WhatsApp vero:
   * il link si aggiorna mentre il cliente scrive e, al clic, se i dati sono validi
   * apre subito la chat con il messaggio già scritto (anche dentro l'anteprima).
   * buildText(data) restituisce il testo; onSend(data) parte dopo il clic valido.
   */
  function bindWhatsAppButton(form, buildText, onSend) {
    const btn = $('button[type="submit"]', form);
    if (!btn) return null;
    const a = document.createElement("a");
    a.className = btn.className; a.innerHTML = btn.innerHTML; a.setAttribute("role", "button");
    a.rel = "noopener noreferrer"; a.referrerPolicy = "no-referrer"; if (!inFrame) a.target = "_blank";
    btn.replaceWith(a);
    const read = () => { const d = Object.fromEntries(new FormData(form).entries()); return d; };
    const update = () => { a.href = waUrl(buildText(read())); };
    form.addEventListener("input", update); form.addEventListener("change", update); update();
    a.addEventListener("click", (e) => {
      const d = read();
      if (d.website || !validateForm(form)) { e.preventDefault(); return; }
      update();
      onSend && onSend(d);
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); a.click(); }); // tasto Invio
    return a;
  }

  /* ------------------------------------------------------------ validazione */
  const RULES = {
    required: (v) => v.trim() !== "" || "Compila questo campo.",
    email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Inserisci un indirizzo email valido, ad esempio nome@dominio.it.",
    tel: (v) => !v || /^[+\d][\d\s().-]{5,}$/.test(v.trim()) || "Inserisci un numero di telefono valido.",
    min10: (v) => !v || v.trim().length >= 10 || "Scrivi almeno 10 caratteri.",
    checked: (v, el) => el.checked || "Per inviare la richiesta devi accettare l'informativa privacy."
  };
  function validateField(el) {
    const rules = (el.dataset.rules || "").split(" ").filter(Boolean);
    let msg = "";
    for (const r of rules) { const res = RULES[r](el.value || "", el); if (res !== true) { msg = res; break; } }
    const errEl = document.getElementById(el.id + "-err");
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (errEl) errEl.textContent = msg;
    return !msg;
  }
  function setupValidation(form) {
    $$("[data-rules]", form).forEach((el) => {
      const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "blur";
      el.addEventListener(evt, () => validateField(el));
      el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") validateField(el); });
    });
  }
  function validateForm(form) {
    let first = null;
    $$("[data-rules]", form).forEach((el) => { if (!validateField(el) && !first) first = el; });
    if (first) first.focus();
    return !first;
  }
  function setBusy(btn, busy, label) {
    if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label)}`; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; }
  }

  /* ------------------------------------------------------------ comparsa a strati */
  function setupReveal() {
    const els = $$(".reveal");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach((e) => io.observe(e));
  }

  /* ------------------------------------------------------------ segnaposto config */
  function fillConfigSlots() {
    $$("[data-config]").forEach((el) => {
      const key = el.dataset.config;
      const val = C[key];
      if (val) {
        if (el.dataset.as === "mailto") el.innerHTML = `<a href="mailto:${esc(val)}">${esc(val)}</a>`;
        else if (el.dataset.as === "tel") el.innerHTML = `<a href="tel:${esc(val.replace(/\s/g, ""))}">${esc(val)}</a>`;
        else if (el.dataset.as === "wa") el.innerHTML = `<a href="${esc(waUrl())}" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(el.dataset.label || "Scrivici su WhatsApp")}</a>`;
        else if (el.dataset.as === "link") el.innerHTML = `<a href="${esc(val)}" rel="noopener">${esc((el.dataset.labelConfig && C[el.dataset.labelConfig]) || el.dataset.label || val)}</a>`;
        else el.textContent = val;
      } else {
        el.innerHTML = ph(el.dataset.placeholder || `${key} da inserire in config.js`);
        const row = el.closest("[data-hide-empty]");
        if (row && !C.showPlaceholders) row.hidden = true;
      }
    });
    $$("[data-requires]").forEach((el) => { if (!C[el.dataset.requires]) el.hidden = true; });
    $$("a[data-wa]").forEach((a) => { if (C.whatsapp) a.href = waUrl(a.dataset.wa); });
    $$("a[data-href-config]").forEach((a) => { const v = C[a.dataset.hrefConfig]; if (v) a.href = v; });
  }

  /** Link esterni: in nuova scheda sul sito pubblicato, link semplici dentro un riquadro protetto */
  function externalLinks() {
    if (inFrame) return;
    $$('a[href^="https://wa.me"], a[href*="whatsapp.com"]').forEach((a) => { a.rel = "noopener noreferrer"; a.referrerPolicy = "no-referrer"; });
    $$('a[href^="https://wa.me"], a[href*="whatsapp.com"], a[href*="instagram.com"]').forEach((a) => { a.target = "_blank"; if (!a.rel) a.rel = "noopener"; });
  }

  /* ------------------------------------------------------------ avvio */
  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
    updateBadge(false);
    fillConfigSlots();
    externalLinks();
    setupReveal();
  });

  window.S3D = {
    C, PRODUCTS, CATS, $, $$, esc, money, product, category, unitPrice, minPrice, defaultOption, defaultOptions, imagesFor, colorFor, modelFor, swatch, isCustom, SHIPPING, hasPriceRange, thumbSrc, thumbSet, thumbFallback, ph,
    Cart, cardHTML, toast, postJSON, fallbackHTML, waUrl, sendViaWhatsApp, bindWhatsAppButton, bindCopy, reasonFor, setupValidation, validateForm, setBusy,
    reduceMotion, store, updateBadge
  };
})();
