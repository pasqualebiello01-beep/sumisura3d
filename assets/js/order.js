/* Pagina di conferma dopo il pagamento Stripe: verifica l'ordine sul server */
document.addEventListener("DOMContentLoaded", async () => {
  const S = window.S3D;
  const { $, esc, money, C, Cart } = S;
  const root = $("#order-root"), title = $("#order-title");
  const id = new URLSearchParams(location.search).get("session_id");
  const fail = (h, msg) => {
    title.textContent = h;
    root.innerHTML = `<p class="lead">${msg}</p><p style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn" href="carrello.html">Torna al carrello</a><a class="btn btn-ghost" href="contatti.html">Contattaci</a></p>`;
  };
  if (!id) return fail("Nessun ordine da mostrare", "Questa pagina si apre dopo un pagamento con Stripe.");
  try {
    const res = await fetch(`${C.orderEndpoint}?session_id=${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "http-" + res.status);
    const o = data.order;
    if (!o.paid) return fail("Pagamento non completato", "Stripe non ha ancora confermato il pagamento. Se hai già pagato, aspetta qualche minuto e ricarica la pagina; altrimenti puoi riprovare dal carrello.");
    // svuota dal carrello i prodotti appena pagati (i pezzi su misura restano)
    let keys = null;
    try { keys = JSON.parse(sessionStorage.getItem("s3d-pending-order")); sessionStorage.removeItem("s3d-pending-order"); } catch (e) { keys = null; }
    Cart.removeMany(keys || Cart.orderable().map((i) => i.key));
    title.textContent = "Grazie, ordine ricevuto";
    const left = Cart.custom().length;
    root.innerHTML = `
      <div class="order-box">
        <p class="lead">Il pagamento è andato a buon fine. Prepariamo il tuo ordine e lo spediamo con Poste Italiane: quando parte ti mandiamo il codice di tracciamento.</p>
        <dl>
          <dt>Riferimento</dt><dd>${esc(o.reference)}</dd>
          ${o.amount != null ? `<dt>Totale pagato</dt><dd>${money(o.amount)}</dd>` : ""}
          ${o.email ? `<dt>Email</dt><dd>${esc(o.email)}</dd>` : ""}
        </dl>
        ${left ? `<div class="notice" style="margin-bottom:1.5rem"><p>Nel carrello ${left === 1 ? "è rimasto un pezzo su misura" : `sono rimasti ${left} pezzi su misura`}: <a href="carrello.html">richiedi il preventivo su WhatsApp</a>.</p></div>` : ""}
        <p style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn" href="catalogo.html">Torna al catalogo</a>${C.whatsapp ? `<a class="btn btn-ghost" href="${esc(S.waUrl())}" rel="noopener">Scrivici su WhatsApp</a>` : ""}</p>
      </div>`;
  } catch (err) {
    fail("Non riusciamo a verificare l'ordine", `Se hai pagato, l'ordine è comunque registrato da Stripe: scrivici su WhatsApp indicando il riferimento ${esc(id.slice(-8).toUpperCase())}.`);
  }
});
