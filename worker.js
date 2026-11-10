/* Sumisura 3D — Cloudflare Worker
   Serve i file del sito e gestisce le rotte /api/* del checkout Stripe.
   Configurazione: wrangler.toml; chiave segreta: STRIPE_SECRET_KEY (vedi README). */
import { handleApi } from "./lib/checkout.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(request, env);
      if (res) return res;
      return new Response(JSON.stringify({ ok: false, error: "Rotta non trovata." }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return env.ASSETS.fetch(request);
  }
};
