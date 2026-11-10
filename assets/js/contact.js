/* Modulo di contatto: prepara il messaggio e apre WhatsApp verso il numero di Sumisura 3D */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.S3D;
  const { $, esc, C } = S;
  const form = $("#contact-form");
  if (!form) return;
  S.setupValidation(form);

  const buildText = (data) => [
    `Ciao Sumisura 3D, sono ${data.name || ""}.`,
    `Argomento: ${data.topic || ""}`,
    "",
    data.message || "",
    data.email ? `\nEmail: ${data.email}` : ""
  ].join("\n").trim();

  // Con il numero WhatsApp impostato, "Invia su WhatsApp" apre subito la chat
  if (C.whatsapp) {
    S.bindWhatsAppButton(form, buildText, (data) => {
      // copia d'archivio sul server, se attivo (non blocca e non mostra errori)
      S.postJSON(C.contactEndpoint, { ...data, consent: true, page: location.href, channel: "whatsapp" }, 6000).catch(() => {});
    });
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("#contact-result"); out.innerHTML = "";
    if (!S.validateForm(form)) return;
    const fd = new FormData(form);
    if (fd.get("website")) return; // campo trappola anti-spam
    const data = Object.fromEntries(fd.entries());
    delete data.website; data.consent = true; data.page = location.href;

    const text = buildText(data);
    // Senza numero WhatsApp configurato: invio all'endpoint del server
    const btn = $('button[type="submit"]', form);
    S.setBusy(btn, true, "Invio in corso…");
    try {
      const res = await S.postJSON(C.contactEndpoint, data);
      S.setBusy(btn, false);
      form.reset();
      out.innerHTML = `<div class="notice notice-ok" role="status" tabindex="-1"><h3>Messaggio inviato</h3><p>Grazie ${esc(data.name.split(" ")[0])}, ti risponderemo al più presto.${res.id ? ` Codice: <strong>${esc(res.id)}</strong>.` : ""}</p></div>`;
      $(".notice", out).focus();
    } catch (err) {
      S.setBusy(btn, false);
      out.innerHTML = S.fallbackHTML(`${data.topic} – richiesta dal sito Sumisura 3D`, text, S.reasonFor(err));
      S.bindCopy(out, text);
      $(".notice", out).focus();
    }
  });
});
