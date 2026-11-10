/* =====================================================================
   Sumisura 3D — server locale senza dipendenze (Node.js 18+)
   Avvio:  node server.js        poi apri http://localhost:8080
   - serve i file del sito
   - POST /api/preventivo e /api/contatto: valida e salva le richieste
     in data/richieste.jsonl (una richiesta JSON per riga)
   - POST /api/checkout e GET /api/order: pagamento con Stripe Checkout
     (stessa logica del Cloudflare Worker, in lib/checkout.mjs)
   Variabili d'ambiente: PORT (default 8080), HOST (default 0.0.0.0),
   STRIPE_SECRET_KEY (chiave segreta Stripe, es. sk_test_...), SITE_URL (facoltativa)
   Per ricevere anche un'email a ogni richiesta, collega qui il tuo
   servizio SMTP o di invio email (vedi README, "Notifiche email").
   ===================================================================== */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = path.join(ROOT, "data");
const LOG_FILE = path.join(DATA_DIR, "richieste.jsonl");
const MAX_BODY = 64 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".woff2": "font/woff2"
};
const BLOCKED = /^\/(data|tools|node_modules|lib|functions)(\/|$)|^\/(server|worker)\.js$|^\/wrangler\.toml$|^\/README\.md$|^\/\./;

// Limite semplice di richieste: 5 al minuto per IP
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.length <= 200;
const str = (s, max) => (typeof s === "string" ? s.trim().slice(0, max) : "");

function validate(kind, b) {
  const errors = [];
  if (!str(b.name, 120)) errors.push("name");
  if (b.email && !isEmail(b.email)) errors.push("email");
  if (b.consent !== true) errors.push("consent");
  if (b.website) errors.push("spam");
  if (kind === "contatto") {
    if (!str(b.topic, 60)) errors.push("topic");
    if (str(b.message, 4000).length < 10) errors.push("message");
  } else {
    if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 100) errors.push("items");
  }
  return errors;
}

function clean(kind, b) {
  const out = {
    name: str(b.name, 120), email: str(b.email, 200), phone: str(b.phone, 40), message: str(b.message, 4000), page: str(b.page, 300), channel: str(b.channel, 20)
  };
  if (kind === "contatto") out.topic = str(b.topic, 60);
  else {
    out.city = str(b.city, 80); out.contactPreference = str(b.contactPreference, 20);
    out.items = b.items.slice(0, 100).map((i) => ({
      id: str(i.id, 80), name: str(i.name, 160), qty: Math.max(1, Math.min(99, parseInt(i.qty, 10) || 1)),
      options: Object.fromEntries(Object.entries(i.options || {}).slice(0, 10).map(([k, v]) => [str(k, 40), str(v, 80)])),
      note: str(i.note, 600), unitPrice: typeof i.unitPrice === "number" ? i.unitPrice : null
    }));
    out.estimatedTotal = typeof b.estimatedTotal === "number" ? b.estimatedTotal : null;
  }
  return out;
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function handleApi(req, res, kind) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  const ip = req.socket.remoteAddress || "?";
  if (rateLimited(ip)) return send(res, 429, { ok: false, error: "rate" });
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else chunks.push(c); });
  req.on("end", () => {
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return send(res, 400, { ok: false, error: "json" }); }
    const errors = validate(kind, body);
    if (errors.length) return send(res, 400, { ok: false, error: "invalid", fields: errors });
    const id = "S3D-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
    const record = { id, type: kind, receivedAt: new Date().toISOString(), ...clean(kind, body) };
    fs.mkdir(DATA_DIR, { recursive: true }, (err) => {
      if (err) return send(res, 500, { ok: false, error: "storage" });
      fs.appendFile(LOG_FILE, JSON.stringify(record) + "\n", (err2) => {
        if (err2) return send(res, 500, { ok: false, error: "storage" });
        console.log(`[${record.receivedAt}] Nuova richiesta ${kind} ${id} da ${record.name}${record.email ? ` <${record.email}>` : ""}${record.channel ? ` (via ${record.channel})` : ""}`);
        // Punto di aggancio per notifiche email: notify(record)
        send(res, 200, { ok: true, id });
      });
    });
  });
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (urlPath === "/") urlPath = "/index.html";
  if (BLOCKED.test(urlPath)) return notFound(res);
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    const longCache = /\.(webp|jpg|png|svg|glb|gltf|woff2)$/.test(ext);
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": longCache ? "public, max-age=604800" : "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  fs.readFile(path.join(ROOT, "404.html"), (err, html) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(err ? "Pagina non trovata" : html);
  });
}

// Checkout Stripe: converte la richiesta Node in Request standard e usa lib/checkout.mjs
let checkoutLib = null;
function handleCheckout(req, res) {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c); });
  req.on("end", async () => {
    try {
      checkoutLib = checkoutLib || (await import("./lib/checkout.mjs"));
      const url = `http://${req.headers.host || "localhost"}${req.url}`;
      const request = new Request(url, { method: req.method, headers: { "Content-Type": "application/json" }, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
      const response = await checkoutLib.handleApi(request, { ...process.env, READ_ASSET: (rel) => { try { return new Uint8Array(fs.readFileSync(path.join(ROOT, rel))); } catch (e) { return null; } } });
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(await response.text());
    } catch (e) {
      console.error(e);
      send(res, 500, { ok: false, error: "Errore interno del server." });
    }
  });
}

http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/api/checkout" || p === "/api/order" || p === "/api/recesso") return handleCheckout(req, res);
  if (p === "/api/preventivo") return handleApi(req, res, "preventivo");
  if (p === "/api/contatto") return handleApi(req, res, "contatto");
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, HOST, () => console.log(`Sumisura 3D in ascolto su http://localhost:${PORT}`));
