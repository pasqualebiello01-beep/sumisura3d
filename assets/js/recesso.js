/* Recesso online (art. 54-bis Codice del consumo): modulo, conferma e ricevuta con data e ora */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.S3D;
  const { $, esc, C } = S;
  const form = $("#recesso-form"), out = $("#recesso-result"), done = $("#recesso-done");
  if (!form) return;
  S.setupValidation(form);
  const ref = new URLSearchParams(location.search).get("ordine");
  if (ref) $("#r-ref").value = ref.toUpperCase();

  const fmt = (iso) => new Date(iso).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Rome" });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    out.innerHTML = "";
    if (!S.validateForm(form)) return;
    const d = {
      name: $("#r-name").value.trim(), email: $("#r-email").value.trim(),
      reference: $("#r-ref").value.trim().toUpperCase(), items: $("#r-items").value.trim(), reason: $("#r-reason").value.trim()
    };
    const btn = $("button[type=submit]", form);
    S.setBusy(btn, true, "Invio in corso…");
    let receivedAt = new Date().toISOString(), saved = false;
    try {
      const res = await S.postJSON(C.withdrawalEndpoint || "/api/recesso", d, 20000);
      if (res && res.receivedAt) receivedAt = res.receivedAt;
      saved = !!(res && res.found);
    } catch (err) {
      if (err && err.status === 400 && err.message && !/^http-/.test(err.message)) {
        S.setBusy(btn, false);
        out.innerHTML = `<div class="notice notice-err"><p>${esc(err.message)}</p></div>`;
        return;
      }
      saved = false; // server non raggiungibile: la ricevuta resta valida, va inviata anche su WhatsApp
    }
    S.setBusy(btn, false);

    const seller = C.legalName || C.brand;
    const text = `RICEVUTA DI RECESSO\n\nDestinatario: ${seller}${C.legalEmail ? ` (${C.legalEmail})` : ""}\nData e ora di invio: ${fmt(receivedAt)}\n\nCon la presente io, ${d.name}, comunico il recesso dal contratto di vendita relativo all'ordine ${d.reference}${d.items ? `, per i seguenti beni: ${d.items}` : ", per tutti i beni dell'ordine"}.\nEmail: ${d.email}${d.reason ? `\nMotivo (facoltativo): ${d.reason}` : ""}`;
    const blob = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    form.hidden = true;
    done.hidden = false;
    done.innerHTML = `
      <div class="notice notice-ok" style="margin-bottom:1.2rem"><p><strong>Richiesta di recesso inviata.</strong> Conserva questa ricevuta: contiene il testo della tua dichiarazione e la data e l'ora di invio.</p></div>
      <div class="receipt" tabindex="-1" id="receipt">${esc(text)}</div>
      ${saved ? "" : `<div class="notice" style="margin-top:1.2rem"><p>Per collegare subito la richiesta al tuo ordine, inviaci una copia della ricevuta su WhatsApp. Il recesso vale comunque dalla data e ora indicate qui sopra.</p></div>`}
      <p style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem">
        <a class="btn" href="${blob}" download="ricevuta-recesso-${esc(d.reference)}.txt">Scarica la ricevuta</a>
        ${C.whatsapp ? `<a class="btn btn-ghost" href="${esc(S.waUrl(text))}" rel="noopener noreferrer" referrerpolicy="no-referrer" target="_blank">Invia una copia su WhatsApp</a>` : ""}
      </p>
      <p class="small muted" style="margin-top:1rem">Ti contatteremo all'email indicata con l'indirizzo per la restituzione. Hai 14 giorni da oggi per rispedirci il prodotto.</p>`;
    $("#receipt").focus();
  });
});
