/* Carrello: i prodotti del catalogo si pagano online con Stripe,
   i pezzi su misura si richiedono con un preventivo su WhatsApp */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.S3D;
  const { $, $$, esc, money, product, unitPrice, Cart, C, SHIPPING } = S;
  const root = $("#cart-root");
  let formDraft = {};
  const cancelled = new URLSearchParams(location.search).get("pagamento") === "annullato";

  function itemHTML(i, custom) {
    const p = product(i.id); const u = unitPrice(p, i.options);
    const opts = Object.entries(i.options).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
    const img = S.imagesFor(p, i.options)[0].src;
    return `<li class="cart-item" data-key="${esc(i.key)}">
      <a class="thumb" href="prodotto.html#${esc(p.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(S.thumbSrc(img))}" alt="" width="96" height="96" loading="lazy" onerror="this.onerror=null;this.src='${esc(img)}'"></a>
      <div>
        <h3><a href="prodotto.html#${esc(p.id)}">${esc(p.name)}</a>${custom ? ' <span class="badge badge-ph">Su misura</span>' : ""}</h3>
        <p class="opts">${opts}${i.note ? `<br>Note: ${esc(i.note)}` : ""}<br>${u == null ? "Prezzo su preventivo" : custom ? `Da ${money(u)} cad., prezzo finale nel preventivo` : `${money(u)} cad.`}</p>
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
          <div class="qty" role="group" aria-label="Quantità di ${esc(p.name)}">
            <button type="button" data-q="-1" aria-label="Diminuisci quantità">−</button>
            <input type="number" value="${i.qty}" min="1" max="99" inputmode="numeric" aria-label="Quantità">
            <button type="button" data-q="1" aria-label="Aumenta quantità">+</button>
          </div>
          <button type="button" class="link-btn" data-remove>Rimuovi</button>
        </div>
      </div>
      <div class="line-total">${custom ? "Preventivo" : money(u * i.qty)}</div>
    </li>`;
  }

  function render() {
    const items = Cart.items();
    if (!items.length) {
      root.innerHTML = `<div class="empty-state" style="margin-bottom:2rem">
        <h2>Il carrello è vuoto</h2>
        <p class="muted">Scegli un prodotto dal catalogo oppure descrivici il pezzo che ti serve.</p>
        <p style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap"><a class="btn" href="catalogo.html">Vai al catalogo</a><a class="btn btn-ghost" href="contatti.html#richiesta">Richiedi un pezzo su misura</a></p></div>`;
      return;
    }
    saveDraft();
    const shop = Cart.orderable(), custom = Cart.custom();
    const t = Cart.totals(shop);
    const both = shop.length && custom.length;
    root.innerHTML = `
      ${cancelled && shop.length ? `<div class="notice" role="status" style="margin-bottom:1.5rem">Pagamento annullato: non ti è stato addebitato nulla. Puoi riprovare quando vuoi.</div>` : ""}
      <div class="cart-layout">
        <div>
          ${shop.length ? `${both ? '<h2 class="cart-group">Da ordinare online</h2>' : '<h2 class="sr-only">Prodotti nel carrello</h2>'}
          <ul class="cart-items">${shop.map((i) => itemHTML(i, false)).join("")}</ul>` : ""}
          ${custom.length ? `<h2 class="cart-group"${shop.length ? ' style="margin-top:2rem"' : ""}>Su misura, con preventivo su WhatsApp</h2>
          <ul class="cart-items">${custom.map((i) => itemHTML(i, true)).join("")}</ul>` : ""}
          <p style="margin-top:1rem"><a href="catalogo.html">Continua a scegliere</a></p>
        </div>

        <div class="summary-col">
          ${shop.length ? `
          <aside class="summary" aria-labelledby="pay-title">
            <h2 id="pay-title">Ordina e paga</h2>
            <div class="sum-row"><span>Prodotti</span><span>${money(t.total)}</span></div>
            <div class="sum-row"><span>Spedizione ${esc(SHIPPING.label)}</span><span>${money(SHIPPING.amount)}</span></div>
            <div class="total-row"><span>Totale</span><span>${money(t.total + SHIPPING.amount)}</span></div>
            <button type="button" class="btn btn-block" id="pay-btn">Paga con Stripe</button>
            <p class="small muted" style="margin:.8rem 0 0">Pagamento sicuro gestito da Stripe: indirizzo di spedizione e dati di pagamento li inserisci nella pagina di Stripe.${both ? " I pezzi su misura non sono inclusi: per quelli ricevi un preventivo a parte." : ""}</p>
            <div id="pay-result" role="alert" style="margin-top:1rem"></div>
          </aside>` : ""}
          ${custom.length ? `
          <aside class="summary" aria-labelledby="quote-title"${shop.length ? ' style="margin-top:1.5rem"' : ""}>
            <h2 id="quote-title">Preventivo su misura</h2>
            <p class="small muted">${custom.length === 1 ? "Questo pezzo è su misura" : "Questi pezzi sono su misura"}: non si paga online. Ti mandiamo il preventivo su WhatsApp e decidi tu se confermare.</p>
            <form id="quote-form" novalidate>
              <div class="field"><label for="q-name">Nome e cognome</label><input id="q-name" name="name" type="text" autocomplete="name" data-rules="required" aria-describedby="q-name-err"><span class="error-msg" id="q-name-err"></span></div>
              <div class="field"><label for="q-email">Email <span class="optional">(facoltativa)</span></label><input id="q-email" name="email" type="email" autocomplete="email" data-rules="email" aria-describedby="q-email-err"><span class="error-msg" id="q-email-err"></span></div>
              <div class="field"><label for="q-city">Città o CAP <span class="optional">(per la spedizione)</span></label><input id="q-city" name="city" type="text" autocomplete="postal-code"></div>
              <div class="field"><label for="q-msg">Messaggio <span class="optional">(misure, quantità, uso…)</span></label><textarea id="q-msg" name="message" style="min-height:90px"></textarea></div>
              <div class="hp" aria-hidden="true"><label for="q-web">Lascia vuoto</label><input id="q-web" name="website" type="text" tabindex="-1" autocomplete="off"></div>
              <div class="field"><label class="consent"><input id="q-consent" name="consent" type="checkbox" data-rules="checked" aria-describedby="q-consent-err"> <span>Ho letto l'<a href="privacy.html">informativa privacy</a> e acconsento al trattamento dei dati per ricevere il preventivo.</span></label><span class="error-msg" id="q-consent-err"></span></div>
              <button class="btn ${shop.length ? "btn-dark " : ""}btn-block" type="submit">Richiedi il preventivo su WhatsApp</button>
              <p class="small muted" style="margin:.8rem 0 0">Si apre la nostra chat WhatsApp con il riepilogo già scritto: ti basta premere Invia.</p>
              <div id="quote-result" style="margin-top:1rem"></div>
            </form>
          </aside>` : ""}
        </div>
      </div>`;
    restoreDraft();
    bind(shop, custom);
  }

  function saveDraft() { const f = $("#quote-form"); if (!f) return; $$("input,select,textarea", f).forEach((el) => { if (el.id) formDraft[el.id] = el.type === "checkbox" ? el.checked : el.value; }); }
  function restoreDraft() { Object.entries(formDraft).forEach(([id, v]) => { const el = document.getElementById(id); if (!el) return; if (el.type === "checkbox") el.checked = v; else el.value = v; }); }

  /* Pagamento: il server ricalcola i prezzi e crea la pagina di pagamento Stripe */
  async function pay(shop) {
    const btn = $("#pay-btn"), out = $("#pay-result");
    out.innerHTML = "";
    S.setBusy(btn, true, "Apertura del pagamento…");
    try {
      const res = await S.postJSON(C.checkoutEndpoint, { items: shop.map((i) => ({ id: i.id, options: i.options, qty: i.qty, note: i.note })) }, 15000);
      if (!res.url) throw new Error("no-url");
      try { sessionStorage.setItem("s3d-pending-order", JSON.stringify(shop.map((i) => i.key))); } catch (e) { /* facoltativo */ }
      location.href = res.url;
    } catch (err) {
      S.setBusy(btn, false);
      let msg = "Il pagamento non si è aperto. Riprova tra poco.";
      if (err && [404, 405, 501].includes(err.status)) msg = "Il pagamento online non è attivo su questa versione del sito. Sul sito pubblicato su Cloudflare funziona dopo aver inserito la chiave Stripe.";
      else if (err && err.status && err.message && !/^http-/.test(err.message)) msg = err.message;
      else if (err && err.name === "AbortError") msg = "Il server non ha risposto in tempo. Riprova.";
      else if (!navigator.onLine) msg = "Sembra che tu sia offline.";
      out.innerHTML = `<div class="notice notice-err"><p>${esc(msg)}</p></div>`;
    }
  }

  function bind(shop, custom) {
    $$(".cart-item").forEach((li) => {
      const key = li.dataset.key, input = $("input", li);
      $$("[data-q]", li).forEach((b) => b.addEventListener("click", () => Cart.setQty(key, (parseInt(input.value, 10) || 1) + Number(b.dataset.q))));
      input.addEventListener("change", () => Cart.setQty(key, parseInt(input.value, 10) || 1));
      $("[data-remove]", li).addEventListener("click", () => {
        const name = $("h3 a", li).textContent;
        Cart.remove(key); S.toast(`${name} rimosso dal carrello.`);
        const first = $(".cart-item input") || $("main a.btn"); if (first) first.focus();
      });
    });
    const payBtn = $("#pay-btn");
    if (payBtn) payBtn.addEventListener("click", () => pay(shop));

    const form = $("#quote-form");
    if (!form) return;
    S.setupValidation(form);
    const quoteText = (d) => `Ciao Sumisura 3D, vorrei un preventivo per un pezzo su misura.\n\nNome: ${d.name || ""}${d.email ? `\nEmail: ${d.email}` : ""}${d.city ? `\nCittà/CAP: ${d.city}` : ""}\n\n${Cart.summaryText(Cart.custom())}${d.message ? `\n\nMessaggio: ${d.message}` : ""}`;
    if (C.whatsapp) {
      S.bindWhatsAppButton(form, quoteText, (d) => {
        S.postJSON(C.quoteEndpoint, { ...d, consent: true, items: Cart.custom(), page: location.href, channel: "whatsapp" }, 6000).catch(() => {}); // copia d'archivio, se il server è attivo
      });
      return;
    }
    // Senza numero WhatsApp: la richiesta va all'endpoint del server
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const out = $("#quote-result"); out.innerHTML = "";
      if (!S.validateForm(form)) return;
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.website) return;
      delete data.website; data.consent = true; data.items = Cart.custom(); data.page = location.href;
      const btn = $('button[type="submit"]', form);
      S.setBusy(btn, true, "Invio in corso…");
      try {
        await S.postJSON(C.quoteEndpoint, data);
        Cart.removeMany(Cart.custom().map((i) => i.key));
        S.toast("Richiesta di preventivo inviata. Ti rispondiamo al più presto.");
      } catch (err) {
        S.setBusy(btn, false);
        const text = quoteText(data);
        out.innerHTML = S.fallbackHTML("Richiesta di preventivo – Sumisura 3D", text, S.reasonFor(err));
        S.bindCopy(out, text);
      }
    });
  }

  document.addEventListener("cart:change", render);
  render();
});
