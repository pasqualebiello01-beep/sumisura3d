/* Variante per Cloudflare Pages (cartella functions/): GET /api/order?session_id=... */
import { handleApi } from "../../lib/checkout.mjs";
export const onRequest = async ({ request, env }) => (await handleApi(request, env)) || new Response("Not found", { status: 404 });
