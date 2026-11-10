/* Catalogo: ricerca, categorie, filtri e ordinamento */
document.addEventListener("DOMContentLoaded", () => {
  const { $, $$, esc, PRODUCTS, CATS, cardHTML, minPrice } = window.S3D;
  const results = $("#results"), count = $("#results-count");
  const q = $("#q"), sort = $("#sort"), priceMax = $("#price-max"), priceOut = $("#price-out");
  const only3d = $("#only-3d"), includeQuote = $("#include-quote");
  const filters = $("#filters"), openBtn = $("#open-filters");

  const prices = PRODUCTS.map(minPrice).filter((n) => n != null);
  const ceil = Math.max(10, Math.ceil((Math.max(...prices, 0) + 1) / 5) * 5);
  priceMax.max = ceil; priceMax.value = ceil;

  // Chip categorie
  $("#cat-chips").innerHTML =
    `<label class="chip"><input type="radio" name="cat" value="" checked><span>Tutte</span></label>` +
    CATS.map((c) => `<label class="chip"><input type="radio" name="cat" value="${esc(c.id)}"><span>${esc(c.name)}</span></label>`).join("");

  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const state = () => ({
    cat: ($('input[name="cat"]:checked') || {}).value || "",
    q: norm(q.value.trim()),
    max: Number(priceMax.value),
    only3d: only3d.checked,
    includeQuote: includeQuote.checked,
    sort: sort.value
  });

  function render() {
    const s = state();
    priceOut.textContent = s.max >= ceil ? "Nessun limite" : `fino a ${s.max} €`;
    let list = PRODUCTS.filter((p) => {
      if (s.cat && p.category !== s.cat) return false;
      if (s.only3d && !p.model) return false;
      const mp = minPrice(p);
      if (mp == null && !s.includeQuote) return false;
      if (mp != null && s.max < ceil && mp > s.max) return false;
      if (s.q) {
        const cat = CATS.find((c) => c.id === p.category);
        const hay = norm([p.name, p.short, cat ? cat.name : "", ...(p.description || [])].join(" "));
        if (!s.q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const val = (p) => { const m = minPrice(p); return m == null ? Infinity : m; };
    if (s.sort === "price-asc") list.sort((a, b) => val(a) - val(b));
    else if (s.sort === "price-desc") list.sort((a, b) => (val(b) === Infinity ? -1 : val(a) === Infinity ? 1 : val(b) - val(a)));
    else if (s.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "it"));
    else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    count.textContent = list.length === 1 ? "1 prodotto" : `${list.length} prodotti`;
    results.innerHTML = list.length
      ? list.map((p) => cardHTML(p)).join("")
      : `<div class="empty-state" style="grid-column:1/-1">
           <h2>Nessun prodotto corrisponde ai filtri</h2>
           <p class="muted">Prova a cambiare ricerca o filtri. Se ti serve qualcosa che non è in catalogo, possiamo realizzarlo su misura.</p>
           <p style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" data-reset>Azzera i filtri</button><a class="btn btn-sm" href="contatti.html#richiesta">Richiedi un pezzo su misura</a></p>
         </div>`;
    const reset = $("[data-reset]", results);
    if (reset) reset.addEventListener("click", resetAll);

    // Intestazione in base alla categoria
    const cat = CATS.find((c) => c.id === s.cat);
    $("#catalog-title").textContent = cat ? cat.name : "Catalogo";
    $("#catalog-intro").textContent = cat ? cat.description : "Prodotti pronti da personalizzare. Non trovi quello che cerchi? Lo realizziamo su misura.";
    document.title = (cat ? cat.name + " – " : "Catalogo – ") + "Sumisura 3D";
    const wantHash = s.cat ? "#" + s.cat : "";
    if (location.hash !== wantHash) history.replaceState(null, "", location.pathname + location.search + wantHash);
  }
  function resetAll() {
    q.value = ""; priceMax.value = ceil; only3d.checked = false; includeQuote.checked = true; sort.value = "featured";
    $('input[name="cat"][value=""]').checked = true; render(); q.focus();
  }
  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const r = $(`input[name="cat"][value="${CSS.escape(id)}"]`) || $('input[name="cat"][value=""]');
    r.checked = true; render();
  }

  let deb;
  q.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(render, 160); });
  [sort, priceMax, only3d, includeQuote].forEach((el) => el.addEventListener("input", render));
  $("#cat-chips").addEventListener("change", render);
  $("#reset-filters").addEventListener("click", resetAll);
  addEventListener("hashchange", fromHash);

  // Pannello filtri su mobile
  let scrim = null;
  function setFilters(open) {
    filters.classList.toggle("open", open);
    openBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      scrim = document.createElement("div"); scrim.className = "scrim"; scrim.addEventListener("click", () => setFilters(false));
      document.body.appendChild(scrim); ($("input", filters) || filters).focus();
    } else { if (scrim) scrim.remove(); scrim = null; }
  }
  openBtn.addEventListener("click", () => setFilters(true));
  $$("[data-close-filters]").forEach((b) => b.addEventListener("click", () => { setFilters(false); openBtn.focus(); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && filters.classList.contains("open")) { setFilters(false); openBtn.focus(); } });

  fromHash();
});
