/* Homepage: inquadrature in dissolvenza con effetto stampa, parallasse e prodotti in evidenza */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.S3D;
  const { $, $$, esc, money, PRODUCTS, C, Cart, toast, unitPrice, minPrice, hasPriceRange, thumbSrc, reduceMotion } = S;

  /* Vetrina sul binario: scegli un prodotto, gli altri sfumano, il pannello entra da destra */
  function setupShowcase() {
    const showcase = $("#showcase"), rail = $("#rail"), panel = $("#rail-panel");
    if (!showcase) return;
    const list = PRODUCTS.filter((p) => p.featured).concat(PRODUCTS.filter((p) => !p.featured && p.price != null)).slice(0, 6);
    rail.innerHTML = list.map((p) => {
      const mp = minPrice(p);
      const price = mp == null ? "Su preventivo" : (hasPriceRange(p) ? "da " : "") + money(mp);
      return `<li><button type="button" class="rail-item" data-id="${esc(p.id)}" aria-expanded="false" aria-controls="rail-panel">
        <img src="${esc(thumbSrc(S.imagesFor(p)[0].src))}" srcset="${esc(S.thumbSet(S.imagesFor(p)[0].src))}" sizes="(max-width: 860px) 38vw, 190px" alt="" width="600" height="600" loading="lazy" decoding="async" style="view-transition-name:p-${esc(p.id)}" onerror="${esc(S.thumbFallback(S.imagesFor(p)[0].src))}">
        <span class="rail-label"><strong>${esc(p.name)}</strong><span>${price}</span></span></button></li>`;
    }).join("");
    let current = null, lastTrigger = null;
    const restoreImg = (b) => { const q = PRODUCTS.find((x) => x.id === b.dataset.id); const full = S.imagesFor(q)[0].src; const src = thumbSrc(full); const im = $("img", b); if (im.getAttribute("src") !== src) { im.srcset = S.thumbSet(full); im.src = src; } };
    const desktop = () => matchMedia("(min-width: 861px)").matches;

    function moveSelected(btn) {
      const img = $("img", btn);
      img.style.transform = "";
      if (!desktop()) return;
      const box = showcase.getBoundingClientRect(), r = img.getBoundingClientRect();
      const targetX = box.left + box.width * 0.32, targetY = box.top + box.height * 0.5;
      const scale = Math.min(2.1, (box.height * 0.9) / r.height);
      const dx = targetX - (r.left + r.width / 2);
      const dy = targetY - (r.top + r.height / 2) + (r.height * scale) / 2 - r.height / 2;
      img.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    }
    function open(id, btn) {
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p) return;
      if (current === id) return close();
      $$(".rail-item", rail).forEach((b) => { b.classList.remove("is-selected"); b.setAttribute("aria-expanded", "false"); $("img", b).style.transform = ""; restoreImg(b); });
      current = id; lastTrigger = btn;
      btn.classList.add("is-selected"); btn.setAttribute("aria-expanded", "true");
      showcase.classList.add("has-selection");
      const selected = {};
      (p.variants || []).forEach((v) => { selected[v.name] = S.defaultOption(v); });
      panel.innerHTML = `
        <button type="button" class="icon-btn rail-close" aria-label="Chiudi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <p class="muted small" style="margin:0">${esc((S.category(p.category) || {}).name || "")}${p.placeholder && C.showPlaceholders ? ' <span class="badge badge-ph">Esempio</span>' : ""}</p>
        <h3 id="rail-panel-title" tabindex="-1">${esc(p.name)}</h3>
        <p class="price-big" data-price aria-live="polite"></p>
        ${(p.variants || []).slice(0, 2).map((v, vi) => `<fieldset class="variant"><legend>${esc(v.name)}</legend><div class="chip-list">${v.options.map((o, oi) =>
          `<label class="chip"><input type="radio" name="rv${vi}" value="${esc(o.label)}" data-variant="${esc(v.name)}"${o.label === S.defaultOption(v) ? " checked" : ""}><span>${S.swatch(o)}${esc(o.label)}</span></label>`).join("")}</div></fieldset>`).join("")}
        <div class="rail-panel-actions">
          <button type="button" class="btn" data-add>Aggiungi al carrello</button>
          <a class="btn btn-ghost" href="prodotto.html#${esc(p.id)}">${p.model ? "Apri la scheda e la vista 3D" : "Apri la scheda"}</a>
        </div>`;
      const priceEl = $("[data-price]", panel);
      const upd = () => { const u = unitPrice(p, selected); priceEl.textContent = money(u); };
      upd();
      const selImg = $("img", btn);
      let view = 0;
      const recolor = () => {
        const imgs = S.imagesFor(p, selected);
        const src = thumbSrc(imgs[Math.min(view, imgs.length - 1)].src);
        if (selImg.getAttribute("src") !== src) { selImg.classList.remove("recolor"); void selImg.offsetWidth; selImg.removeAttribute("srcset"); selImg.src = src; selImg.classList.add("recolor"); }
      };
      $$("[data-variant]", panel).forEach((r) => r.addEventListener("change", () => {
        selected[r.dataset.variant] = r.value; upd();
        const v = (p.variants || []).find((x) => x.name === r.dataset.variant);
        if (v && v.view != null) view = v.view;
        recolor();
      }));
      $("[data-add]", panel).addEventListener("click", () => { Cart.add(p.id, { ...selected }, 1, ""); toast(`${p.name} aggiunto al carrello.`, { href: "carrello.html", label: "Vai al carrello" }); });
      $(".rail-close", panel).addEventListener("click", close);
      panel.hidden = false;
      requestAnimationFrame(() => { moveSelected(btn); panel.classList.add("is-open"); });
      setTimeout(() => $("#rail-panel-title").focus({ preventScroll: true }), reduceMotion ? 0 : 350);
      if (!desktop()) { const sb = reduceMotion ? "auto" : "smooth"; rail.scrollTo({ left: btn.parentElement.offsetLeft - (rail.clientWidth - btn.parentElement.offsetWidth) / 2, behavior: sb }); setTimeout(() => panel.scrollIntoView({ behavior: sb, block: "nearest" }), 50); }
    }
    function close() {
      if (!current) return;
      current = null;
      showcase.classList.remove("has-selection");
      panel.classList.remove("is-open");
      $$(".rail-item", rail).forEach((b) => { b.classList.remove("is-selected"); b.setAttribute("aria-expanded", "false"); $("img", b).style.transform = ""; restoreImg(b); });
      setTimeout(() => { if (!current) { panel.hidden = true; panel.innerHTML = ""; } }, reduceMotion ? 0 : 400);
      if (lastTrigger) lastTrigger.focus({ preventScroll: true });
    }
    rail.addEventListener("click", (e) => { const b = e.target.closest(".rail-item"); if (b) open(b.dataset.id, b); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && current) close(); });
    document.addEventListener("click", (e) => { if (current && !showcase.contains(e.target)) close(); });
    addEventListener("resize", () => { const b = $(".rail-item.is-selected", rail); if (b) moveSelected(b); });
  }

  setupShowcase();

  // Carosello
  const stage = $("#stage");
  if (!stage) return;
  const shots = $$(".stage-shot", stage);
  const caption = $(".stage-caption", stage);
  const toggle = $('[data-stage="toggle"]', stage);
  const bar = $(".stage-progress span", stage);
  const DURATION = 5200;
  let firstShow = true;
  let index = 0, playing = !reduceMotion, timer = null, start = 0, elapsed = 0, raf = null;

  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';

  // Le inquadrature successive si scaricano solo dopo il caricamento della pagina
  function loadShot(shot) {
    const im = $("img", shot);
    if (im && im.dataset.src) { if (im.dataset.srcset) im.srcset = im.dataset.srcset; im.src = im.dataset.src; delete im.dataset.src; delete im.dataset.srcset; }
  }
  // (la successiva viene scaricata 1,5 s prima del cambio, vedi tick)

  function show(i, animate = true) {
    index = (i + shots.length) % shots.length;
    loadShot(shots[index]);
    shots.forEach((s, k) => {
      const active = k === index;
      s.classList.toggle("is-active", active);
      s.setAttribute("aria-hidden", String(!active));
      s.classList.remove("is-printing");
      s.classList.remove("is-streaking");
      // primo caricamento: stampa a strati; cambi successivi: scia orizzontale
      if (active && animate && !reduceMotion) { void s.offsetWidth; s.classList.add(firstShow ? "is-printing" : "is-streaking"); }
    });
    firstShow = false;
    const cur = shots[index];
    caption.textContent = cur.dataset.title;
    caption.href = cur.dataset.link;
    elapsed = 0; start = performance.now();
  }
  function tick(now) {
    if (!playing) return;
    const t = elapsed + (now - start);
    bar.style.width = Math.min(100, (t / DURATION) * 100) + "%";
    if (t > DURATION - 1500) loadShot(shots[(index + 1) % shots.length]);
    if (t >= DURATION) { show(index + 1); }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    playing = true; start = performance.now();
    toggle.innerHTML = ICON_PAUSE; toggle.setAttribute("aria-label", "Metti in pausa lo scorrimento");
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function pause() {
    if (playing) elapsed += performance.now() - start;
    playing = false; cancelAnimationFrame(raf);
    toggle.innerHTML = ICON_PLAY; toggle.setAttribute("aria-label", "Avvia lo scorrimento");
  }
  $('[data-stage="next"]', stage).addEventListener("click", () => { show(index + 1); bar.style.width = "0"; });
  $('[data-stage="prev"]', stage).addEventListener("click", () => { show(index - 1); bar.style.width = "0"; });
  toggle.addEventListener("click", () => (playing ? pause() : play()));
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { show(index + 1); }
    if (e.key === "ArrowLeft") { show(index - 1); }
  });
  // Pausa quando la scheda non è visibile o il carosello esce dallo schermo
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) { pause(); stage.dataset.autoPaused = "1"; } else if (!document.hidden && stage.dataset.autoPaused) { delete stage.dataset.autoPaused; play(); } });

  // la prima "stampa" parte solo quando l'immagine è arrivata
  const firstImg = $("img", shots[0]);
  const startFirst = () => { show(0, true); shots[0].classList.remove("is-waiting"); };
  if (firstImg && !firstImg.complete) { firstImg.addEventListener("load", startFirst, { once: true }); firstImg.addEventListener("error", startFirst, { once: true }); }
  else startFirst();
  if (playing) play(); else { toggle.innerHTML = ICON_PLAY; toggle.setAttribute("aria-label", "Avvia lo scorrimento"); }

  // Parallasse leggera allo scroll
  if (!reduceMotion) {
    let ticking = false;
    const imgs = shots.map((s) => $("img", s));
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
          imgs.forEach((im) => { im.style.transform = `translate3d(0, ${(p * -28).toFixed(1)}px, 0) scale(1.02)`; });
        }
        ticking = false;
      });
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
});
