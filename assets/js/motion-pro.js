/* =====================================================================
   Sumisura 3D — effetti avanzati
   Librerie:  GSAP + ScrollTrigger + SplitText (github.com/greensock/GSAP)
              Lenis, scorrimento morbido (github.com/darkroomengineering/lenis)
   Effetti ispirati a React Bits (github.com/DavidHDev/react-bits), riscritti in
   JavaScript semplice perché il sito non usa React: Magnet, Tilted/Spotlight Card,
   Click Spark, Split/Blur Text, Count Up, Scroll Velocity.

   Le librerie si caricano dopo il contenuto, senza rallentare la pagina.
   Se non arrivano (rete, blocchi) il sito resta con gli effetti di base di motion.js.
   Con "riduci animazioni" attivo non si carica nulla.
   ===================================================================== */
(function () {
  "use strict";
  const C = window.S3D_CONFIG || {};
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const desktop = () => matchMedia("(min-width: 861px)").matches;
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ================================================================
     1. Effetti che non richiedono librerie (funzionano sempre)
     ================================================================ */

  /* Magnet: i pulsanti principali si avvicinano un poco al puntatore */
  const MAGNET = ".btn:not(.btn-sm):not(.btn-block), .stage-btn, .showcase-arrow, .cart-link";
  function magnet(scope) {
    if (!fine) return;
    $$(MAGNET, scope).forEach((el) => {
      if (el.dataset.magnet) return;
      el.dataset.magnet = "1";
      el.classList.add("magnet");
      const strength = el.classList.contains("btn") ? 0.22 : 0.3;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.classList.add("is-pulling");
        el.style.setProperty("--tx", `${Math.max(-10, Math.min(10, x)).toFixed(1)}px`);
        el.style.setProperty("--ty", `${Math.max(-8, Math.min(8, y)).toFixed(1)}px`);
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("is-pulling");
        el.style.setProperty("--tx", "0px"); el.style.setProperty("--ty", "0px");
      });
    });
  }

  /* Tilted Card: le schede prodotto si inclinano appena verso il puntatore */
  function tilt(scope) {
    if (!fine) return;
    $$(".card", scope).forEach((card) => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = "1";
      const media = card.querySelector(".card-media");
      if (!media) return;
      let raf = 0, ev = null;
      card.addEventListener("pointermove", (e) => {
        ev = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = media.getBoundingClientRect();
          const px = (ev.clientX - r.left) / r.width - 0.5, py = (ev.clientY - r.top) / r.height - 0.5;
          media.style.setProperty("--ry", `${(px * 7).toFixed(2)}deg`);
          media.style.setProperty("--rx", `${(-py * 7).toFixed(2)}deg`);
        });
      });
      card.addEventListener("pointerleave", () => { media.style.setProperty("--rx", "0deg"); media.style.setProperty("--ry", "0deg"); });
    });
  }

  /* Nastro di parole chiave: in pausa quando non si vede */
  function marquee() {
    const m = document.querySelector(".marquee");
    if (!m || !("IntersectionObserver" in window)) return null;
    new IntersectionObserver(([en]) => m.classList.toggle("paused", !en.isIntersecting)).observe(m);
    return m;
  }

  function scanBasic(scope) { magnet(scope); tilt(scope); }

  /* ================================================================
     2. Caricamento delle librerie
     ================================================================ */
  const base = C.vendorBase || "https://cdn.jsdelivr.net/npm/";
  const fromNpm = /\/npm\/?$/.test(base);
  const LIBS = {
    gsap: fromNpm ? "gsap@3.15.0/dist/gsap.min.js" : "gsap.min.js",
    st: fromNpm ? "gsap@3.15.0/dist/ScrollTrigger.min.js" : "ScrollTrigger.min.js",
    split: fromNpm ? "gsap@3.15.0/dist/SplitText.min.js" : "SplitText.min.js",
    lenis: fromNpm ? "lenis@1.3.27/dist/lenis.min.js" : "lenis.min.js"
  };
  const load = (file) => new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = base.replace(/\/?$/, "/") + file;
    s.async = true; s.crossOrigin = "anonymous";
    s.onload = ok; s.onerror = () => ko(new Error("non caricato: " + file));
    document.head.appendChild(s);
    setTimeout(() => ko(new Error("tempo scaduto: " + file)), 8000);
  });

  async function loadAll() {
    await load(LIBS.gsap);
    const extra = [load(LIBS.st), load(LIBS.split)];
    if (fine && desktop()) extra.push(load(LIBS.lenis).catch(() => null)); // Lenis solo con mouse/trackpad
    await Promise.all(extra.slice(0, 2));
    await Promise.allSettled(extra.slice(2));
  }

  /* ================================================================
     3. Effetti con GSAP
     ================================================================ */
  let lenis = null;

  function setupLenis(gsap, ScrollTrigger) {
    if (!window.Lenis || !fine || !desktop()) return;
    lenis = new window.Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // aree con uno scorrimento proprio: menu, filtri, vista 3D, campi di testo
      prevent: (node) => !!(node && node.closest && node.closest(".main-nav, .filters, .viewer, model-viewer, textarea, select, .rail-panel, [data-lenis-prevent]"))
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // menu mobile o pannelli aperti: scorrimento della pagina bloccato
    const sync = () => (document.body.classList.contains("nav-open") ? lenis.stop() : lenis.start());
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // link interni (#richiesta ecc.): scorrimento morbido tenendo conto dell'intestazione fissa
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash || url.hash === "#") return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      const header = document.getElementById("site-header");
      lenis.scrollTo(target, { offset: -((header ? header.offsetHeight : 68) + 16), duration: 1.2 });
      history.pushState(null, "", url.hash);
      setTimeout(() => { if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }, 900);
    });
  }

  /* Split / Blur Text: i titoli di sezione entrano parola per parola */
  function splitTitles(gsap, SplitText, scope) {
    const vh = innerHeight;
    $$(".section-head h2, .prose > h2, .product-desc h2, .cta-block h2, .page-head + section h2", scope).forEach((h) => {
      if (h.dataset.split || h.classList.contains("sr-only")) return;
      if (h.getBoundingClientRect().top < vh * 0.9) return; // già visibile: niente animazione
      h.dataset.split = "1";
      const split = SplitText.create(h, { type: "words,lines", mask: "lines", wordsClass: "split-word", linesClass: "split-line", aria: "auto" });
      gsap.from(split.words, {
        yPercent: 105, opacity: 0, filter: desktop() ? "blur(6px)" : "none",
        duration: 0.85, ease: "power3.out", stagger: 0.045,
        scrollTrigger: { trigger: h, start: "top 88%", once: true },
        onComplete: () => split.revert() // DOM originale ripristinato: nessun problema se cambia la larghezza
      });
    });
  }

  /* Count Up con GSAP per i numeri del laboratorio (sostituisce quello di base solo se non è già partito) */
  function countUps(gsap, scope) {
    $$(".hero-facts strong, .facts strong", scope).forEach((s) => {
      if (s.dataset.counted) return;
      const m = s.textContent.match(/(\d{1,3}(?:\.\d{3})+|\d+)/);
      if (!m || /[–-]/.test(s.textContent)) return;
      const target = parseInt(m[1].replace(/\./g, ""), 10);
      if (target < 5) return;
      s.dataset.counted = "1";
      const before = s.textContent.slice(0, m.index), after = s.textContent.slice(m.index + m[1].length), final = s.textContent;
      const fmt = new Intl.NumberFormat("it-IT"), o = { v: 0 };
      s.style.fontVariantNumeric = "tabular-nums";
      gsap.to(o, {
        v: target, duration: 1.6, ease: "power2.out",
        scrollTrigger: { trigger: s, start: "top 92%", once: true },
        onUpdate: () => { s.textContent = before + fmt.format(Math.round(o.v)) + after; },
        onComplete: () => { s.textContent = final; }
      });
    });
  }

  /* Click Spark: piccole scintille beige quando si clicca un pulsante principale */
  function clickSpark(gsap) {
    let layer = null;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn:not(.btn-ghost), .cart-link, [data-add]");
      if (!btn || btn.disabled || e.detail === 0) return; // e.detail 0 = attivato da tastiera
      if (!layer) { layer = document.createElement("div"); layer.className = "spark-layer"; layer.setAttribute("aria-hidden", "true"); document.body.appendChild(layer); }
      const n = 8;
      for (let i = 0; i < n; i++) {
        const sp = document.createElement("i");
        sp.className = "spark";
        const ang = (360 / n) * i;
        sp.style.left = `${e.clientX - 1}px`; sp.style.top = `${e.clientY - 12}px`;
        layer.appendChild(sp);
        gsap.fromTo(sp, { rotation: ang, scaleY: 0.2, opacity: 1, transformOrigin: "50% 100%" }, {
          scaleY: 1, opacity: 0, duration: 0.55, ease: "power2.out",
          x: Math.sin(ang * Math.PI / 180) * 26, y: -Math.cos(ang * Math.PI / 180) * 26,
          onComplete: () => sp.remove()
        });
      }
    }, true);
  }

  /* Scroll Velocity: il nastro di parole accelera mentre si scorre */
  function marqueeVelocity(gsap, ScrollTrigger, m) {
    if (!m) return;
    const track = m.querySelector(".marquee-track");
    const anim = track && track.getAnimations ? track.getAnimations()[0] : null;
    if (!anim) return;
    const state = { rate: 1 };
    ScrollTrigger.create({
      trigger: m, start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        const v = Math.min(4, 1 + Math.abs(self.getVelocity()) / 600);
        gsap.to(state, { rate: v, duration: 0.2, overwrite: true, onUpdate: () => { anim.playbackRate = state.rate; } });
        gsap.to(state, { rate: 1, duration: 1.2, delay: 0.25, ease: "power2.out", onUpdate: () => { anim.playbackRate = state.rate; } });
      }
    });
  }

  /* Parallasse e scorrimento guidato (solo desktop) */
  function scrollScenes(gsap) {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 861px)", () => {
      const hero = document.querySelector(".hero");
      if (hero) {
        gsap.to(".hero .stage-shot", { yPercent: 9, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 } });
        gsap.to(".hero .hero-copy", { y: 60, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 } });
      }
      // galleria della scheda prodotto: leggero spostamento
      $$(".gallery-main").forEach((el) => gsap.fromTo(el, { y: 18 }, { y: -18, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 } }));
    });
  }

  /* ================================================================
     4. Avvio
     ================================================================ */
  function start() {
    scanBasic(document);
    const m = marquee();
    new MutationObserver((muts) => muts.forEach((mu) => mu.addedNodes.forEach((n) => { if (n.nodeType === 1) scanBasic(n); })))
      .observe(document.body, { childList: true, subtree: true });

    if (C.advancedMotion === false) return;
    // dopo il caricamento completo, nei momenti liberi del browser: la pagina è già usabile
    const go = () => loadAll().then(() => {
      const { gsap, ScrollTrigger, SplitText } = window;
      if (!gsap || !ScrollTrigger || !SplitText) throw new Error("librerie incomplete");
      gsap.registerPlugin(ScrollTrigger, SplitText);
      root.classList.add("gsap-on");
      setupLenis(gsap, ScrollTrigger);
      const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fontsReady.then(() => {
        splitTitles(gsap, SplitText, document);
        countUps(gsap, document);
        clickSpark(gsap);
        marqueeVelocity(gsap, ScrollTrigger, m);
        scrollScenes(gsap);
        ScrollTrigger.refresh();
      });
      addEventListener("load", () => ScrollTrigger.refresh());
    }).catch((err) => {
      root.classList.add("gsap-off");
      if (window.console) console.info("[Sumisura 3D] Effetti avanzati non attivi, restano quelli di base:", err.message);
    });
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    if (document.readyState === "complete") idle(go, { timeout: 1500 });
    else addEventListener("load", () => idle(go, { timeout: 1500 }), { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
