/* =====================================================================
   CONFIGURAZIONE SUMISURA 3D
   Modifica qui contatti, dati aziendali e canali di invio dei moduli.
   I campi vuoti ("") non vengono mostrati sul sito oppure compaiono
   come segnaposto evidenziato finché showPlaceholders è true.
   ===================================================================== */
window.S3D_CONFIG = {
  brand: "Sumisura 3D",
  siteUrl: "https://sumisura3d.it",

  // --- Contatti (DA COMPLETARE) -------------------------------------
  email: "",            // vuoto = non mostrata sul sito
  phone: "",            // vuoto = non mostrato sul sito
  whatsapp: "393518148844",  // solo cifre, con prefisso 39 e senza "+" (sul sito compare solo la scritta "WhatsApp")
  instagram: "https://www.instagram.com/sumisura3d.it/",
  instagramHandle: "@sumisura3d.it",
  tiktok: "https://www.tiktok.com/@sumisura3d.it",
  address: "",          // es. "Via Roma 1, 00100 Città (XX)"
  openingHours: "Aperto 24 ore",

  // --- Dati legali (OBBLIGATORI per vendere online in Italia) --------
  // Compaiono nel footer di ogni pagina e nelle Condizioni di vendita.
  legalName: "",        // nome e cognome della ditta o ragione sociale, es. "Mario Rossi" o "Sumisura 3D di Mario Rossi"
  vatNumber: "",        // Partita IVA (obbligatoria in home page per legge)
  legalAddress: "",     // sede legale, es. "Via Roma 1, 80100 Napoli (NA)"
  legalEmail: "",       // email per clienti, reclami e recesso (obbligatoria)
  pec: "",              // PEC (facoltativa ma consigliata)
  rea: "",              // numero REA, se iscritto al Registro Imprese (es. "NA-123456")
  vatNote: "Prezzi IVA inclusa, ove dovuta.", // se sei in regime forfettario puoi lasciare questa frase

  // --- Invio moduli ---------------------------------------------------
  // Con il numero WhatsApp impostato, "Invia" apre WhatsApp con il messaggio già scritto
  // verso quel numero (il cliente deve solo premere Invia nella chat).
  // Gli endpoint qui sotto, se attivi, ricevono in più una copia della richiesta da archiviare.
  // Con "node server.js" questi endpoint salvano le richieste in data/richieste.jsonl.
  // Su hosting statico puoi puntarli a un servizio di form (es. Formspree):
  // il servizio deve accettare POST JSON. Se l'invio fallisce il sito propone
  // email / WhatsApp / copia del riepilogo, senza dichiarare la richiesta inviata.
  quoteEndpoint: "/api/preventivo",
  contactEndpoint: "/api/contatto",

  // --- Recensioni -----------------------------------------------------
  reviewUrl: "",        // link alla pagina recensioni (es. Google Business). Vuoto = sezione nascosta.

  // --- Visualizzazione ------------------------------------------------
  currency: "EUR",
  priceNote: "Prezzi IVA inclusa, ove dovuta. Paghi online con Stripe. Spedizione con Poste Italiane: 6,99 €.", // il costo vero è in products.js (S3D_SHIPPING)
  customNote: "Non si paga online: ti mandiamo il preventivo su WhatsApp.",

  // --- Pagamenti Stripe -------------------------------------------------
  // Il checkout è gestito dal server (Cloudflare Worker o server.js): la chiave segreta
  // Stripe NON va mai inserita qui, ma nelle variabili segrete (vedi README).
  checkoutEndpoint: "/api/checkout",
  orderEndpoint: "/api/order",
  withdrawalEndpoint: "/api/recesso",
  showPlaceholders: false, // true mostra i badge "Esempio" e i segnaposto evidenziati

  // --- Animazioni avanzate (GSAP, Lenis) ------------------------------------
  // Da dove caricare le librerie. Per ospitarle sul tuo sito invece che dal CDN jsDelivr,
  // copia gsap.min.js, ScrollTrigger.min.js, SplitText.min.js e lenis.min.js in assets/vendor/
  // e scrivi qui: vendorBase: "assets/vendor/"
  vendorBase: "https://cdn.jsdelivr.net/npm/",
  advancedMotion: true      // false = solo gli effetti di base, senza librerie esterne
};
