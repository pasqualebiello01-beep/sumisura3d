/* Variante per Cloudflare Pages (cartella functions/): POST /api/checkout */
import { handleApi } from "../../lib/checkout.mjs";
export const onRequest = async ({ request, env }) => (await handleApi(request, env)) || new Response("Not found", { status: 404 });
