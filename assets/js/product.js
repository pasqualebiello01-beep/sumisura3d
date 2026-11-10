/* Pagina prodotto: galleria, vista 3D, varianti, quantità, aggiunta al carrello */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.S3D;
  const { $, $$, esc, money, product, category, unitPrice, PRODUCTS, C, Cart, toast, cardHTML, ph } = S;
  const root = $("#product-root");

  let viewer = null;

  function render() {
    const id = decodeURIComponent(location.hash.slice(1));
    const p = product(id);
    if (!p) {
      root.innerHTML = `<div class="empty-state" style="margin:2rem 0 4rem"><h1 style="font-size:2rem">Prodotto non trovato</h1>
        <p class="muted">Il link potrebbe essere errato o il prodotto non è più disponibile.</p>
        <p><a class="btn" href="catalogo.html">Vai al catalogo</a></p></div>`;
      $("#bc-name").textContent = "Prodotto non trovato";
      document.title = "Prodotto non trovato – Sumisura 3D";
      $("#related-section").hidden = true;
      return;
    }
    const cat = category(p.category);
    const selected = {};
    (p.variants || []).forEach((v) => { selected[v.name] = S.defaultOption(v); });

    document.title = `${p.name} – Sumisura 3D`;
    const md = $('meta[name="description"]'); if (md) md.content = `${p.name}: ${p.short}`;
    $("#bc-name").textContent = p.name;

    let images = S.imagesFor(p, selected);
    const thumbsHTML = () => images.length > 1 ? images.map((im, i) =>
      `<button type="button" data-img="${i}" aria-label="Mostra immagine ${i + 1}: ${esc(im.alt)}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(S.thumbSrc(im.src))}" alt="" width="76" height="76" loading="lazy" onerror="this.onerror=null;this.src='${esc(im.src)}'"></button>`).join("") : "";

    root.innerHTML = `
      <div class="product" style="padding-bottom:1rem">
        <div class="gallery">
          ${p.model ? `<div class="view-tabs" role="tablist" aria-label="Tipo di vista">
              <button type="button" role="tab" id="tab-img" aria-selected="true" aria-controls="gallery-main">Foto</button>
              <button type="button" role="tab" id="tab-3d" aria-selected="false" aria-controls="gallery-main">Vista 3D</button>
            </div>` : ""}
          <div class="gallery-main" id="gallery-main"${p.model ? ' role="tabpanel" aria-labelledby="tab-img"' : ""}>
            <img id="main-img" src="${esc(images[0].src)}" alt="${esc(images[0].alt)}" width="1100" height="1100" style="view-transition-name:p-${esc(p.id)}">
          </div>
          <div class="thumbs" role="group" aria-label="Immagini del prodotto">${thumbsHTML()}</div>
        </div>

        <div class="product-info">
          <p class="muted" style="margin-bottom:.4rem"><a href="catalogo.html#${esc(p.category)}">${esc(cat ? cat.name : "")}</a>${p.placeholder && C.showPlaceholders ? ' <span class="badge badge-ph">Esempio</span>' : ""}</p>
          <h1>${esc(p.name)}</h1>
          <p class="price-big" id="price" aria-live="polite"></p>
          <p class="price-note" id="price-note" aria-live="polite"></p>
          <p class="lead" style="font-size:1.1rem">${esc(p.short)}</p>

          <form id="buy-form" novalidate>
            ${(p.variants || []).map((v, vi) => `
              <fieldset class="variant">
                <legend>${esc(v.name)} <output id="v-out-${vi}">${esc(S.defaultOption(v))}</output></legend>
                <div class="chip-list">${v.options.map((o, oi) => `
                  <label class="chip"><input type="radio" name="v${vi}" value="${esc(o.label)}" data-variant="${esc(v.name)}" data-out="v-out-${vi}"${o.label === S.defaultOption(v) ? " checked" : ""}><span>${S.swatch(o)}${esc(o.label)}${o.priceDelta ? ` (${o.priceDelta > 0 ? "+" : "−"}${money(Math.abs(o.priceDelta))})` : ""}</span></label>`).join("")}
                </div>
              </fieldset>`).join("")}
            <div class="field">
              <label for="note">Note per la personalizzazione <span class="optional">(facoltativo)</span></label>
              <textarea id="note" maxlength="600" style="min-height:90px" placeholder="Misure, modello dell'apparecchio, quantità particolari…" aria-describedby="note-hint"></textarea>
              <span class="hint" id="note-hint">Se scrivi una modifica, il prodotto diventa su misura: niente pagamento online, ti mandiamo un preventivo su WhatsApp.</span>
            </div>
            <div class="buy-row">
              <div class="qty" role="group" aria-label="Quantità">
                <button type="button" data-q="-1" aria-label="Diminuisci quantità">−</button>
                <input type="number" id="qty" value="1" min="1" max="99" inputmode="numeric" aria-label="Quantità">
                <button type="button" data-q="1" aria-label="Aumenta quantità">+</button>
              </div>
              <button type="submit" class="btn">Aggiungi al carrello</button>
            </div>
          </form>

          <div class="prose">${(p.description || []).map((d) => `<p>${esc(d)}</p>`).join("")}</div>
          ${p.specs && p.specs.length ? `<dl class="spec-list">${p.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl>` : ""}
          <p class="small muted" style="margin-top:1.5rem">Hai bisogno di una versione diversa? <a href="contatti.html#richiesta">Chiedici un pezzo su misura</a>.</p>
        </div>
      </div>`;

    // Prezzo
    const priceEl = $("#price");
    const updatePrice = () => {
      const u = unitPrice(p, selected);
      const q = Number($("#qty").value) || 1;
      const custom = S.isCustom(p, selected, $("#note") ? $("#note").value : "");
      $("#price-note").innerHTML = p.price == null ? "Il prezzo dipende dal progetto: te lo mandiamo con il preventivo su WhatsApp."
        : custom ? `<span class="badge badge-ph">Su misura</span> ${esc(C.customNote)}` : esc(C.priceNote);
      priceEl.innerHTML = u == null ? "Su preventivo" : `${money(u)}${q > 1 ? ` <span class="muted" style="font-size:1rem;font-weight:400">· ${money(u * q)} per ${q} pezzi</span>` : ""}`;
    };
    $$("[data-variant]", root).forEach((r) => r.addEventListener("change", () => {
      selected[r.dataset.variant] = r.value; $("#" + r.dataset.out).textContent = r.value; updatePrice();
      const v = (p.variants || []).find((x) => x.name === r.dataset.variant);
      applyAppearance(v && v.view != null ? v.view : null);
    }));

    // Quantità
    const qty = $("#qty");
    const clampQty = () => { qty.value = Math.max(1, Math.min(99, parseInt(qty.value, 10) || 1)); updatePrice(); };
    $$("[data-q]", root).forEach((b) => b.addEventListener("click", () => { qty.value = (parseInt(qty.value, 10) || 1) + Number(b.dataset.q); clampQty(); }));
    qty.addEventListener("change", clampQty);
    qty.addEventListener("input", updatePrice);
    $("#note").addEventListener("input", updatePrice);
    updatePrice();

    // Aggiunta al carrello
    $("#buy-form").addEventListener("submit", (e) => {
      e.preventDefault(); clampQty();
      Cart.add(p.id, { ...selected }, Number(qty.value), $("#note").value);
      toast(`${p.name} aggiunto al carrello.`, { href: "carrello.html", label: "Vai al carrello" });
    });

    // Galleria
    const mainWrap = $("#gallery-main");
    let imgIndex = 0;
    function bindThumbs() {
      $$(".thumbs button", root).forEach((b) => b.addEventListener("click", () => { if (p.model) selectTab("img"); showImage(Number(b.dataset.img)); }));
    }
    /** Mostra il prodotto nel colore/variante scelti: foto e modello 3D */
    let startBelow = false;
    function applyAppearance(view) {
      if (view != null) { imgIndex = view; startBelow = true; } // es. attacco: mostra il lato da sotto
      const next = S.imagesFor(p, selected);
      if (next !== images || view != null) {
        images = next;
        $(".thumbs", root).innerHTML = thumbsHTML(); bindThumbs();
        if (!viewer) showImage(Math.min(imgIndex, images.length - 1));
        else $$(".thumbs button", root).forEach((b) => b.setAttribute("aria-current", "false"));
      }
      if (viewer) {
        if (viewer.src !== S.modelFor(p, selected)) open3D(); // forma diversa: carica l'altro modello
        else viewer.setColor(S.colorFor(p, selected));
      }
    }
    function showImage(i) {
      imgIndex = i;
      const im = images[i];
      let img = $("#main-img");
      if (!img) { mainWrap.innerHTML = `<img id="main-img" width="1100" height="1100">`; img = $("#main-img"); }
      img.src = im.src; img.alt = im.alt;
      img.classList.remove("swap"); void img.offsetWidth; img.classList.add("swap");
      $$(".thumbs button", root).forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
    }
    bindThumbs();

    // Vista 3D
    function selectTab(which) {
      const t3 = $("#tab-3d"), ti = $("#tab-img");
      if (!t3) return;
      const is3d = which === "3d";
      t3.setAttribute("aria-selected", String(is3d)); ti.setAttribute("aria-selected", String(!is3d));
      mainWrap.setAttribute("aria-labelledby", is3d ? "tab-3d" : "tab-img");
      if (is3d) open3D(); else { if (viewer) { viewer.destroy(); viewer = null; } mainWrap.innerHTML = ""; showImage(imgIndex); }
    }
    function open3D() {
      if (viewer) { viewer.destroy(); viewer = null; }
      mainWrap.innerHTML = `
        <div class="viewer">
          <div class="viewer-status" id="viewer-status"><div><p style="margin:0">Caricamento del modello 3D…</p><div class="viewer-bar"><span id="viewer-bar"></span></div></div></div>
        </div>`;
      const box = $(".viewer", mainWrap);
      if (!window.S3DViewer) return fail3D("Il visualizzatore 3D non è stato caricato.");
      viewer = window.S3DViewer.create(box, {
        src: S.modelFor(p, selected),
        color: S.colorFor(p, selected),
        startBelow,
        label: `Modello 3D di ${p.name}. Trascina per ruotare, usa la rotella o il pizzico per lo zoom.`,
        onProgress: (f) => { const b = $("#viewer-bar"); if (b) b.style.width = Math.round(f * 100) + "%"; },
        onError: (err) => fail3D((err && err.message) || "Il modello 3D non si è caricato."),
        onLoad: () => {
          const st = $("#viewer-status"); if (st) st.remove();
          const auto = viewer.isAutoRotating();
          box.insertAdjacentHTML("beforeend", `
            <div class="viewer-tools">
              <button type="button" class="stage-btn" data-mv="in" aria-label="Avvicina"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
              <button type="button" class="stage-btn" data-mv="out" aria-label="Allontana"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
              <button type="button" class="stage-btn" data-mv="rotate" aria-pressed="${auto}" aria-label="Rotazione automatica"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5"/></svg></button>
              <button type="button" class="stage-btn" data-mv="reset" aria-label="Ripristina la vista"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg></button>
            </div>
            <p class="viewer-help">Trascina per ruotare, rotella o pizzico per lo zoom, doppio clic per ripristinare</p>`);
          $('[data-mv="in"]', box).addEventListener("click", () => viewer.zoom(1.25));
          $('[data-mv="out"]', box).addEventListener("click", () => viewer.zoom(0.8));
          $('[data-mv="rotate"]', box).addEventListener("click", (e) => { const on = !viewer.isAutoRotating(); viewer.setAutoRotate(on); e.currentTarget.setAttribute("aria-pressed", String(on)); });
          $('[data-mv="reset"]', box).addEventListener("click", () => viewer.reset());
        }
      });
    }
    function fail3D(msg) {
      if (viewer) { viewer.destroy(); viewer = null; }
      const im = images[0];
      mainWrap.innerHTML = `<img src="${esc(im.src)}" alt="${esc(im.alt)}" width="1100" height="1100">
        <div class="viewer-help" style="pointer-events:auto"><span class="notice" style="display:inline-block;padding:.5rem .8rem">${esc(msg)} Ti mostriamo la foto del prodotto.</span></div>`;
    }
    if (p.model) {
      $("#tab-img").addEventListener("click", () => selectTab("img"));
      $("#tab-3d").addEventListener("click", () => selectTab("3d"));
      $(".view-tabs").addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = document.activeElement.id === "tab-img" ? "#tab-3d" : "#tab-img"; $(n).focus(); $(n).click(); }
      });
    }

    // Prodotti correlati
    const related = PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category).concat(PRODUCTS.filter((x) => x.id !== p.id && x.category !== p.category)).slice(0, 4);
    $("#related").innerHTML = related.map((x) => cardHTML(x)).join("");
    $("#related-section").hidden = related.length === 0;

    // Dati strutturati per i motori di ricerca
    const old = $("#product-ld"); if (old) old.remove();
    const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.short, category: cat ? cat.name : undefined,
      image: p.images.map((i) => new URL(i.src, location.href).href), brand: { "@type": "Brand", name: "Sumisura 3D" } };
    if (p.price != null) ld.offers = { "@type": "Offer", priceCurrency: C.currency, price: S.minPrice(p).toFixed(2), url: location.href };
    const sc = document.createElement("script"); sc.type = "application/ld+json"; sc.id = "product-ld"; sc.textContent = JSON.stringify(ld);
    document.head.appendChild(sc);
  }

  addEventListener("hashchange", () => { if (viewer) { viewer.destroy(); viewer = null; } render(); scrollTo(0, 0); });
  render();
});
