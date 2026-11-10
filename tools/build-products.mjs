// Crea una pagina HTML per ogni prodotto (es. manopola-ricambio.html), già leggibile da Google:
// titolo, descrizione, foto, prezzo, caratteristiche e dati strutturati. Poi aggiorna la sitemap.
// Uso: node tools/build-products.mjs   (rilancialo quando aggiungi o modifichi prodotti in products.js)
import { readFileSync, writeFileSync } from "node:fs";
import { S3D_PRODUCTS, S3D_CATEGORIES } from "../assets/js/products.js";

const root = new URL("..", import.meta.url).pathname;
const SITE = "https://sumisura3d.it";
const tpl = readFileSync(root + "prodotto.html", "utf8");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const slug = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const defaultOption = (v) => (v.options.find((o) => !o.priceDelta) || v.options[0]);
const minPrice = (p) => p.price == null ? null : Math.max(0, p.price + (p.variants || []).reduce((s, v) => s + Math.min(...v.options.map((o) => o.priceDelta || 0)), 0));
const hasRange = (p) => (p.variants || []).some((v) => new Set(v.options.map((o) => o.priceDelta || 0)).size > 1);

function mainImage(p) {
  const chosen = Object.fromEntries((p.variants || []).map((v) => [v.name, defaultOption(v).label]));
  if (p.imageVariants && p.imageViews) {
    const vals = p.imageVariants.map((n) => chosen[n]).filter(Boolean);
    return { src: `assets/img/prodotti/${p.id}-${vals.map(slug).join("-")}${p.imageViews[0].suffix}.webp`, alt: `${p.name}, ${vals.join(", ").toLowerCase()}` };
  }
  for (const v of p.variants || []) { const o = defaultOption(v); if (o.images && o.images[0]) return o.images[0]; }
  return p.images[0];
}
const jpgFor = (src) => src.replace(/^assets\/img\/prodotti\/(.+)\.webp$/, "assets/img/checkout/$1.jpg");

const urls = [];
for (const p of S3D_PRODUCTS) {
  const cat = S3D_CATEGORIES.find((c) => c.id === p.category);
  const file = `${p.id}.html`, url = `${SITE}/${p.id}`; // Cloudflare pubblica le pagine senza ".html"
  const img = mainImage(p);
  const ogImg = `${SITE}/${img.src.includes("/prodotti/") ? jpgFor(img.src) : img.src}`;
  const mp = minPrice(p);
  const priceText = mp == null ? "Su preventivo" : `${hasRange(p) ? "da " : ""}${money(mp)}`;
  const title = `${p.name}${mp != null ? ` – ${priceText}` : ""} | Sumisura 3D`;
  const desc = `${p.short} Stampa 3D su misura di Sumisura 3D${mp != null ? `, ${priceText}` : ""}. Spedizione con Poste Italiane.`.slice(0, 160);

  const ld = [{
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: (p.description || [p.short]).join(" "),
    image: [`${SITE}/${img.src}`], sku: p.id, category: cat ? cat.name : undefined,
    brand: { "@type": "Brand", name: "Sumisura 3D" },
    ...(mp != null ? { offers: { "@type": "Offer", url, priceCurrency: "EUR", price: mp.toFixed(2), availability: "https://schema.org/MadeToOrder", itemCondition: "https://schema.org/NewCondition",
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: "6.99", currency: "EUR" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "IT" } } } } : {})
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Catalogo", item: `${SITE}/catalogo` },
      { "@type": "ListItem", position: 3, name: p.name, item: url }]
  }];

  // contenuto già pronto nella pagina (Google lo legge subito; poi lo script lo rende interattivo)
  const staticHTML = `
    <div class="product" style="padding-bottom:1rem">
      <div class="gallery"><div class="gallery-main"><img id="main-img" src="${esc(img.src)}" alt="${esc(img.alt)}" width="1100" height="1100" fetchpriority="high"></div></div>
      <div class="product-info">
        <p class="muted" style="margin-bottom:.4rem"><a href="catalogo.html#${esc(p.category)}">${esc(cat ? cat.name : "")}</a></p>
        <h1>${esc(p.name)}</h1>
        <p class="price-big">${esc(priceText)}</p>
        <p class="lead" style="font-size:1.1rem">${esc(p.short)}</p>
        ${(p.variants || []).map((v) => `<p class="small"><strong>${esc(v.name)}:</strong> ${v.options.map((o) => esc(o.label)).join(", ")}</p>`).join("")}
        <section class="product-desc" aria-labelledby="desc-title"><h2 id="desc-title">Descrizione</h2><div class="prose">${(p.description || []).map((d) => `<p>${esc(d)}</p>`).join("")}</div></section>
        ${p.specs && p.specs.length ? `<h2 class="spec-title">Caratteristiche</h2><dl class="spec-list">${p.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl>` : ""}
      </div>
    </div>`;

  let h = tpl;
  const set = (re, val) => { if (!re.test(h)) throw new Error(`${file}: non trovo ${re}`); h = h.replace(re, val); };
  set(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  set(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  set(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="product">`);
  set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`);
  set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  set(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${ogImg}">`);
  set(/<meta property="og:image:width" content="[^"]*">\n<meta property="og:image:height" content="[^"]*">\n/, "");
  set(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(img.alt)}">`);
  set(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${ogImg}">`);
  h = h.replace(/<meta name="robots" content="noindex[^"]*">\n/, "");
  set(/<\/head>/, `<script type="application/ld+json" id="product-ld">${JSON.stringify(ld[0])}</script>\n<script type="application/ld+json">${JSON.stringify(ld[1])}</script>\n</head>`);
  set(/<body data-page="product">/, `<body data-page="product" data-product="${esc(p.id)}">`);
  set(/<li aria-current="page" id="bc-name">[^<]*<\/li>/, `<li aria-current="page" id="bc-name">${esc(p.name)}</li>`);
  set(/<div id="product-root" aria-live="polite">[\s\S]*?<\/div>\n<\/div>/, `<div id="product-root" aria-live="polite">${staticHTML}\n  </div>\n</div>`);
  writeFileSync(root + file, h);
  urls.push(url);
  console.log("pagina creata:", file);
}

// sitemap: pagine fisse + pagine prodotto
const fixed = ["", "catalogo.html", "chi-siamo.html", "contatti.html", "faq.html", "spedizioni.html", "condizioni-vendita.html", "recesso.html", "privacy.html", "cookie.html"];
const today = new Date().toISOString().slice(0, 10);
writeFileSync(root + "sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...fixed.map((f) => `${SITE}/${f.replace(/\.html$/, "")}`), ...urls].map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
console.log("sitemap aggiornata:", fixed.length + urls.length, "indirizzi");
