/* =====================================================================
   Sumisura 3D — animazioni e micro-interazioni
   - comparsa delle sezioni durante lo scorrimento (dissolvenza, scorrimento, ingrandimento alternati)
   - onda al tocco/clic sui pulsanti, indicatore animato nel menu, barra di lettura
   - luce che segue il puntatore sulle schede (solo desktop), immagini in dissolvenza
   - numeri che contano, icone che si disegnano, particelle discrete nella homepage
   - transizione in uscita tra le pagine dove il browser non ha le View Transitions
   Tutto si spegne se il dispositivo chiede "riduci animazioni".
   ===================================================================== */
(function () {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const desktop = () => matchMedia("(min-width: 861px)").matches;
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ------------------------------------------------ onda al tocco/clic (anche con animazioni ridotte resta solo il feedback di colore) */
  const RIPPLE = ".btn, .icon-btn, .stage-btn, .showcase-arrow, .qty button, .view-tabs button, .chip span, .thumbs button";
  if (!reduce) {
    document.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest(RIPPLE);
      if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
      if (!el.classList.contains("has-ripple")) {
        el.classList.add("has-ripple");
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
      }
      let host = el.querySelector(":scope > .ripple-host");
      if (!host) { host = document.createElement("i"); host.className = "ripple-host"; host.setAttribute("aria-hidden", "true"); el.appendChild(host); }
      const r = el.getBoundingClientRect();
      const s = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("i");
      dot.className = "ripple";
      dot.style.setProperty("--x", `${e.clientX - r.left}px`);
      dot.style.setProperty("--y", `${e.clientY - r.top}px`);
      dot.style.setProperty("--s", `${s}px`);
      host.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      setTimeout(() => dot.remove(), 1000);
    }, { passive: true });
  }

  /* Se setBusy() o un altro script riscrive il contenuto del pulsante, l'onda viene rimossa con esso: va bene. */

  if (reduce) return; // da qui in poi solo effetti di movimento
  root.classList.add("motion");

  /* ------------------------------------------------ comparsa durante lo scorrimento */
  // gruppi: selettore → tipo di animazione ("alt" alterna sinistra/destra), ritardo progressivo tra fratelli
  const GROUPS = [
    [".section-head", "up", 0],
    [".services .service", "up", 0.12],
    [".grid-products > *", "up", 0.07],
    [".rail > li", "soft", 0.08],
    [".steps > li", "up", 0.12],
    [".cta-block", "zoom", 0],
    [".two-col > *:not(.prose)", "alt", 0.1],
    [".facts", "up", 0],
    [".prose > h2, .prose > h3", "left", 0],
    [".prose > p, .prose > ul, .prose > ol", "fade", 0],
    [".faq > details", "up", 0.05],
    [".contact-list > li", "left", 0.06],
    ["form .field, form .form-row, form .consent, form .btn", "up", 0.04],
    [".catalog .filters > *", "left", 0.05],
    [".toolbar", "fade", 0],
    [".product .gallery", "left", 0],
    [".product-info > *", "right", 0.05],
    [".product-desc", "up", 0],
    [".cart-items > li", "up", 0.06],
    [".summary", "zoom", 0],
    [".reviews > li", "up", 0.1],
    [".footer-grid > *", "up", 0.07],
    [".footer-bottom", "fade", 0],
    [".notice:not([role])", "fade", 0],
    ["section.section-tight > .wrap > .btn, .empty-state", "zoom", 0]
  ];
  // dopo l'avvio si animano solo questi (contenuti nuovi, non quelli ridisegnati a ogni modifica come il carrello)
  const LIVE = ".grid-products > *, .rail > li, .reviews > li, .empty-state";
  const SEEN = ".section-head, .steps, .services, .hero-facts, .facts";

  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      if (el.hasAttribute("data-anim")) {
        el.classList.add("is-in");
        const d = parseFloat(el.style.getPropertyValue("--d")) || 0;
        // a comparsa finita l'elemento torna "normale": niente conflitti con gli effetti al passaggio del mouse
        setTimeout(() => { el.removeAttribute("data-anim"); el.classList.remove("is-in"); el.style.removeProperty("--d"); }, 1500 + d * 1000);
      }
      if (el.hasAttribute("data-seen")) { el.classList.add("seen"); countUp(el); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;

  const vh = () => window.innerHeight || root.clientHeight;
  /** all'avvio si animano solo gli elementi sotto lo schermo; quelli inseriti dopo (vetrina, catalogo, carrello) sempre */
  function tag(el, type, delay, onlyBelow) {
    if (!io || el.dataset.animDone || el.closest(".hero")) return;
    if (!onlyBelow && !el.matches(LIVE)) return;
    if (!desktop() && el.closest(".filters, .rail")) return; // su smartphone: filtri a comparsa e vetrina a scorrimento laterale restano fermi
    if (el.parentElement && el.parentElement.closest("[data-anim]")) return; // già dentro un blocco che entra
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return; // nascosto
    if (onlyBelow && el.getBoundingClientRect().top < vh() * 0.92) return;
    el.dataset.animDone = "1";
    el.setAttribute("data-anim", type);
    if (delay) el.style.setProperty("--d", `${Math.min(delay, 0.6).toFixed(2)}s`);
    io.observe(el);
  }
  function scan(scope, onlyBelow) {
    GROUPS.forEach(([sel, type, step]) => {
      const list = $$(sel, scope).concat(scope.matches && scope.matches(sel) ? [scope] : []);
      const counters = new Map();
      list.forEach((el) => {
        const parent = el.parentElement;
        const i = counters.get(parent) || 0; counters.set(parent, i + 1);
        const t = type === "alt" ? (i % 2 ? "right" : "left") : type;
        tag(el, t, step * (i % 8), onlyBelow);
      });
    });
    $$(SEEN, scope).forEach((el) => {
      if (el.hasAttribute("data-seen") || !io) return;
      // se è già sullo schermo all'avvio, lascia partire comunque la linea/il conteggio con un attimo di ritardo
      el.setAttribute("data-seen", "");
      io.observe(el);
    });
    prepareIcons(scope);
    fadeImages(scope);
    cardLight(scope);
  }

  /* ------------------------------------------------ icone dei servizi che si disegnano */
  function prepareIcons(scope) {
    $$(".services svg path, .services svg circle", scope).forEach((p) => {
      if (p.hasAttribute("data-draw") || p.getAttribute("stroke-dasharray")) return;
      p.setAttribute("pathLength", "1");
      p.setAttribute("data-draw", "");
    });
  }

  /* ------------------------------------------------ numeri che contano (8 anni, Oltre 1.000) */
  function countUp(box) {
    $$("strong", box).forEach((s) => {
      if (s.dataset.counted || /[–-]/.test(s.textContent)) return;
      const m = s.textContent.match(/(\d{1,3}(?:\.\d{3})+|\d+)/);
      if (!m) return;
      s.dataset.counted = "1";
      const target = parseInt(m[1].replace(/\./g, ""), 10);
      if (!target || target < 5) return;
      const before = s.textContent.slice(0, m.index), after = s.textContent.slice(m.index + m[1].length);
      const final = s.textContent;
      const fmt = new Intl.NumberFormat("it-IT");
      const t0 = performance.now(), dur = 1200;
      s.style.fontVariantNumeric = "tabular-nums";
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        s.textContent = k < 1 ? before + fmt.format(Math.round(target * e)) + after : final;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------ immagini in dissolvenza quando arrivano */
  function fadeImages(scope) {
    $$("main img, .site-footer img", scope).forEach((img) => {
      if (img.dataset.fadeDone || img.closest(".hero, .stage") || img.id === "main-img") return;
      img.dataset.fadeDone = "1";
      if (img.complete && img.naturalWidth) return;
      img.classList.add("img-fade");
      const done = () => img.classList.add("loaded");
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, 4000); // mai lasciare un'immagine invisibile
    });
  }

  /* ------------------------------------------------ luce che segue il puntatore sulle schede (desktop) */
  function cardLight(scope) {
    if (!finePointer) return;
    $$(".card", scope).forEach((card) => {
      if (card.dataset.light) return;
      card.dataset.light = "1";
      const media = card.querySelector(".card-media");
      if (!media) return;
      let raf = 0;
      card.addEventListener("pointermove", (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = media.getBoundingClientRect();
          media.style.setProperty("--mx", `${e.clientX - r.left}px`);
          media.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
      });
    });
  }

  /* ------------------------------------------------ indicatore animato nel menu (desktop) */
  function navIndicator() {
    const ul = document.querySelector(".main-nav ul");
    if (!ul || ul.querySelector(".nav-ind")) return;
    const ind = document.createElement("li");
    ind.className = "nav-ind"; ind.setAttribute("aria-hidden", "true"); ind.setAttribute("role", "presentation");
    ul.appendChild(ind);
    root.classList.add("has-nav-ind");
    const current = ul.querySelector('a[aria-current="page"]');
    const moveTo = (a, instant) => {
      if (!a || !desktop()) { ind.classList.remove("on"); return; }
      ind.classList.toggle("instant", !!instant);
      ind.style.setProperty("--x", `${a.offsetLeft}px`);
      ind.style.setProperty("--y", `${a.offsetTop}px`);
      ind.style.setProperty("--w", `${a.offsetWidth}px`);
      ind.style.setProperty("--h", `${a.offsetHeight}px`);
      ind.classList.add("on");
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.remove("instant")));
    };
    const rest = () => (current ? moveTo(current) : ind.classList.remove("on"));
    $$("a", ul).forEach((a) => {
      a.addEventListener("pointerenter", () => moveTo(a, !ind.classList.contains("on")));
      a.addEventListener("focus", () => moveTo(a, !ind.classList.contains("on")));
    });
    ul.addEventListener("pointerleave", rest);
    ul.addEventListener("focusout", (e) => { if (!ul.contains(e.relatedTarget)) rest(); });
    if (current) moveTo(current, true);
    // i caratteri web possono arrivare dopo e cambiare le larghezze
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => current && moveTo(current, true));
    addEventListener("resize", () => current ? moveTo(current, true) : rest(), { passive: true });
  }

  /* ------------------------------------------------ barra di lettura */
  function scrollProgress() {
    const bar = document.createElement("div");
    bar.className = "scroll-progress"; bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = root.scrollHeight - vh();
      bar.style.setProperty("--p", max > 40 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : 0);
    };
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener("resize", update, { passive: true });
    update();
  }

  /* ------------------------------------------------ particelle discrete e bagliore nella homepage (solo desktop) */
  function heroFx() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const fx = document.createElement("div");
    fx.className = "hero-fx"; fx.setAttribute("aria-hidden", "true");
    let html = '<span class="glow"></span>';
    if (desktop() && finePointer) {
      for (let i = 0; i < 9; i++) {
        const l = 38 + Math.random() * 58, t = 15 + Math.random() * 70;
        html += `<i style="--l:${l.toFixed(1)}%;--t:${t.toFixed(1)}%;--sz:${(2 + Math.random() * 3).toFixed(1)}px;--dur:${(10 + Math.random() * 8).toFixed(1)}s;--del:${(-Math.random() * 12).toFixed(1)}s;--dx:${(Math.random() * 40 - 20).toFixed(0)}px"></i>`;
      }
    }
    fx.innerHTML = html;
    hero.appendChild(fx);
    // fuori dallo schermo o in una scheda nascosta: animazioni in pausa
    if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => fx.classList.toggle("paused", !en.isIntersecting)).observe(hero);
  }

  /* ------------------------------------------------ uscita dalla pagina (solo se il browser non ha le View Transitions) */
  function pageLeave() {
    if (!root.classList.contains("no-vt")) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download") || a.dataset.wa !== undefined) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.protocol.indexOf("http") !== 0) return;
      if (url.pathname === location.pathname && url.hash) return; // ancora nella stessa pagina
      e.preventDefault();
      root.classList.add("is-leaving");
      setTimeout(() => { location.href = a.href; }, 190);
    });
    // tornando indietro con la cache del browser la pagina deve essere visibile
    addEventListener("pageshow", () => root.classList.remove("is-leaving"));
  }

  /* ------------------------------------------------ avvio */
  // questo script è l'ultimo della pagina: header, footer e contenuti generati sono già pronti
  function start() {
    navIndicator();
    scrollProgress();
    heroFx();
    pageLeave();
    scan(document, true);
    // contenuti aggiunti dopo (filtri del catalogo, carrello, vetrina, menu ricostruito)
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1 || n.classList.contains("ripple") || n.classList.contains("ripple-host")) return;
        if (n.matches(".site-header *, .main-nav ul") || n.querySelector(".main-nav ul")) navIndicator();
        scan(n, false);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
