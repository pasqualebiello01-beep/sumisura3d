# Sumisura 3D: sito web

Sito statico (HTML, CSS, JavaScript) con un piccolo server Node.js senza dipendenze che riceve le richieste di preventivo e i messaggi di contatto.

## Avvio

Serve Node.js 18 o superiore.

```bash
cd sumisura3d
node server.js
```

Poi apri http://localhost:8080. Per cambiare porta usa `PORT=3000 node server.js`.

Le richieste inviate dal carrello e dalla pagina Contatti vengono salvate in `data/richieste.jsonl`, una riga JSON per ogni richiesta, con un codice del tipo `S3D-261110-A1B2`. La cartella `data/` non è accessibile dal browser.

**Hosting statico** (senza server): il sito funziona, ma il pagamento Stripe no, perché richiede il Worker Cloudflare o `server.js`. Puoi caricare tutto tranne `server.js`, `data/` e `tools/`. In questo caso imposta `quoteEndpoint` e `contactEndpoint` in `assets/js/config.js` sull'indirizzo di un servizio di moduli che accetta richieste POST in JSON. Se l'invio non riesce, il sito non dichiara mai la richiesta come inviata: propone di mandarla via email o WhatsApp, oppure di copiare il riepilogo.

## Contatti e WhatsApp
Il numero WhatsApp, Instagram (@sumisura3d.it) e gli orari si trovano in `assets/js/config.js`. Email e telefono sono vuoti, quindi non vengono mostrati. Il numero WhatsApp non compare mai come testo: sul sito c'è solo la scritta "WhatsApp", che apre la chat.

Quando un cliente invia il modulo Contatti o la richiesta di preventivo dal carrello, il sito apre WhatsApp verso quel numero con il messaggio già scritto: il cliente deve solo premere Invia nella chat. L'invio non può essere completamente automatico, perché WhatsApp non permette a un sito di mandare messaggi al posto del cliente senza la WhatsApp Business API, che è a pagamento e richiede un account verificato. Se usi `node server.js`, una copia di ogni richiesta viene salvata anche in `data/richieste.jsonl`.

## Dove modificare

| Cosa | File |
|---|---|
| Email, WhatsApp, telefono, indirizzo, P.IVA, link recensioni | `assets/js/config.js` |
| Prodotti, prezzi, varianti, testi, immagini, modelli 3D, spedizione | `assets/js/products.js` |
| Chiave Stripe | segreto `STRIPE_SECRET_KEY` sul server (mai nei file) |
| Categorie del catalogo | `assets/js/products.js` (`S3D_CATEGORIES`) |
| Colori e caratteri | `assets/css/style.css` (variabili in cima al file) |
| Testi di homepage, Chi siamo, FAQ, Spedizioni, Privacy | i rispettivi file `.html` |
| Logo | `assets/js/app.js` (costante `LOGO`), `assets/img/logo.svg`, `assets/img/favicon.svg` |

I testi tra parentesi quadre evidenziati in arancione sono **segnaposto da completare**. Quando hai finito, imposta `showPlaceholders: false` in `config.js`: così spariscono anche i badge "Esempio".

### Prodotti
Ogni prodotto in `products.js` ha un `id` (usato nel link `prodotto.html#id`), un prezzo base e varianti con eventuale sovrapprezzo (`priceDelta`). Con `price: null` il prodotto compare "Su preventivo". Come variante predefinita viene selezionata la prima opzione senza sovrapprezzo.

### Colori
I colori sono definiti in `products.js`, in `S3D_COLORS` (nome → codice colore). Per dare a un prodotto la scelta del colore usa `coloreVariante("id-prodotto", "Nome", ["Nero opaco", "Arancione"])`. Quando il cliente sceglie un colore:
- foto e miniature passano alle immagini di quel colore: `assets/img/prodotti/<id>-<colore>.webp` e `<id>-<colore>-dettaglio.webp`, più le versioni `-600`, ad esempio `vaso-geometrico-nero-opaco.webp`;
- il modello 3D viene ricolorato all'istante con il codice colore;
- carrello, vetrina in homepage e richiesta di preventivo mostrano il colore scelto.

Per aggiungere un colore, inseriscilo in `S3D_COLORS` e carica le sue foto con il nome giusto. Se le foto di un colore mancano, il 3D si ricolora comunque, ma le immagini non vengono trovate: carica sempre le foto di ogni colore che offri.

### Varianti che cambiano la forma (es. l'attacco della manopola)
Un'opzione può avere un proprio modello 3D (`model`). Quando il cliente la sceglie, la vista 3D carica quel modello. Sulla variante, `view: 1` dice quale foto mostrare quando cambia: per la manopola è la vista da sotto, partendo dalla seconda foto, e anche il 3D parte inquadrato da sotto.

Se le foto dipendono da più scelte insieme, ad esempio colore e attacco, usa `imageVariants` e `imageViews` (vedi "Manopola zigrinata" in `products.js`). In quel caso le foto si chiamano `<id>-<colore>-<attacco>.webp` e `<id>-<colore>-<attacco>-sotto.webp`, ad esempio `manopola-ricambio-nero-opaco-albero-tondo-sotto.webp`, più le versioni `-600`.

### Immagini
Metti le foto in `assets/img/prodotti/`. Il formato consigliato è WebP quadrato da 1100×1100 px su sfondo neutro o scontornato. Per ogni foto aggiungi anche le miniature con suffisso `-600` e `-300`, per esempio `vaso-600.webp` e `vaso-300.webp`. Le schede le usano per caricare velocemente sul telefono; se mancano, il sito ripiega da solo sull'immagine grande. Compila sempre il campo `alt`.

### Modelli 3D
Metti i file `.glb` (o `.gltf`) in `assets/models/` e indica il percorso nel campo `model`. Con `model: null` la scheda mostra solo le foto, senza la vista 3D.

Il visualizzatore è integrato nel sito (`assets/js/viewer3d.js`, WebGL, nessuna libreria esterna) e scarica il modello solo quando l'utente apre "Vista 3D". Supporta mesh, gerarchia dei nodi, colore e texture del colore base. **Non supporta la compressione Draco/Meshopt**: esporta senza compressione e, per caricamenti rapidi, resta sotto i 3–5 MB per modello, riducendo i poligoni se serve. Se il file non si carica, al suo posto compare la foto con un avviso.

### Pagamenti con Stripe
- **Prodotti del catalogo**: si ordinano e pagano dal carrello con **Stripe Checkout**. Il cliente inserisce indirizzo e dati di pagamento nella pagina di Stripe; la spedizione (6,99 €, Poste Italiane, solo Italia) viene aggiunta in automatico.
- **Pezzi su misura**: prodotti con `price: null`, con un'opzione `custom: true` (es. manopola con attacco "Su misura") oppure a cui il cliente ha scritto una **nota di modifica**. Non si pagano online: dal carrello parte il preventivo su WhatsApp. Se il carrello contiene entrambi i tipi, la pagina li divide da sola.
- **Sicurezza**: il browser invia solo prodotto, opzioni e quantità. I prezzi vengono ricalcolati sul server da `assets/js/products.js`, quindi non si possono manomettere. Con una chiave `sk_live_…` i prodotti di esempio (`placeholder: true`) vengono rifiutati.
- **Dopo il pagamento** il cliente arriva su `ordine-confermato.html`, che verifica il pagamento con Stripe e toglie dal carrello i prodotti pagati.
- **Ordini**: li trovi nella dashboard di Stripe, con prodotti, opzioni, note, indirizzo e telefono del cliente. Dalle impostazioni di Stripe puoi attivare le email di notifica per te e le ricevute per i clienti.
- Spedizione e paesi serviti si cambiano in `products.js` (`S3D_SHIPPING`).

#### Pubblicare su Cloudflare Workers (consigliato)
I file `worker.js`, `wrangler.toml` e `.assetsignore` sono già pronti. Il Worker serve il sito e gestisce `/api/checkout` e `/api/order`; i file del server non vengono pubblicati.
1. Crea un account Stripe e copia la **chiave segreta di test** (`sk_test_…`) dalla sezione chiavi API della dashboard.
2. Dalla cartella del sito, con Node.js installato:
   ```bash
   npx wrangler login
   npx wrangler secret put STRIPE_SECRET_KEY   # incolla la chiave sk_test_…
   npx wrangler deploy
   ```
3. Collega il dominio sumisura3d.it al Worker dal pannello Cloudflare e controlla che `SITE_URL` in `wrangler.toml` corrisponda.
4. Fai un ordine di prova con la carta di test Stripe `4242 4242 4242 4242` (qualsiasi data futura e CVC).
5. Per incassare davvero: sostituisci i prodotti di esempio con i tuoi, poi ripeti `npx wrangler secret put STRIPE_SECRET_KEY` con la chiave `sk_live_…`.

La chiave segreta non va **mai** scritta nei file del sito, né in `config.js` né in `wrangler.toml`.

#### Alternativa: Cloudflare Pages
La cartella `functions/` contiene le stesse rotte per Pages. Inserisci `STRIPE_SECRET_KEY` (come segreto) e `SITE_URL` nelle variabili d'ambiente del progetto Pages. Con Pages vengono pubblicati anche i file tecnici come `lib/` e `server.js`: non contengono segreti, ma il Worker resta la soluzione più pulita.

#### Prova in locale
```bash
STRIPE_SECRET_KEY=sk_test_... node server.js
```
Il server Node usa la stessa logica del Worker (`lib/checkout.mjs`).

### Notifiche email
`server.js` salva le richieste ma non invia email. Per riceverne una a ogni richiesta, collega il tuo servizio SMTP o di invio email nel punto segnato `notify(record)`.

## Contenuti di esempio
I contenuti di esempio non vengono dal brand, quindi vanno sostituiti:
- i 6 prodotti, i prezzi e i testi delle schede;
- le immagini e i modelli 3D, generati con `tools/gen_assets.py`;
- il logo a cubo, una ricostruzione provvisoria in attesa del logo originale.

I dati reali usati provengono dalle indicazioni del brand: 8 anni di attività, oltre 1.000 progetti, ricambi, prototipi e progetti su misura, consegna in 1–2 giorni dalla realizzazione, contatti via WhatsApp e sito, Instagram @SuMisura3D.

## Note tecniche
- **SEO**: title e description per pagina, Open Graph, `sitemap.xml`, `robots.txt`, dati strutturati (Organization, FAQPage e Product). Le schede prodotto usano un URL con `#id`. Se vuoi che ogni prodotto venga indicizzato separatamente, crea una pagina HTML per ciascun prodotto oppure fai generare le pagine al server.
- **Privacy e terze parti**: l'unico servizio esterno è Google Fonts. Per non usarlo, scarica i caratteri e aggiorna il link in testa alle pagine.
- **Accessibilità**: navigazione da tastiera, focus visibile, link "Vai al contenuto", errori dei moduli annunciati, rispetto di "riduci movimento" (niente scorrimento automatico, animazioni o parallasse).
- **Movimento**: l'immagine della hero "si stampa" a strati al primo caricamento. I cambi di inquadratura usano una scia orizzontale, la vetrina in homepage fa crescere il prodotto scelto con un pannello che entra da destra, e nei browser compatibili l'immagine passa dalla scheda alla pagina prodotto con una transizione continua.

## Nota sulla velocità della home
Per caricare la home più in fretta, il CSS è copiato direttamente dentro `index.html` (blocco `<style id="css-in-pagina">`).
Le altre pagine continuano a usare `assets/css/style.css`.
Se modifichi `assets/css/style.css`, rilancia `node tools/inline-css.mjs` (oppure chiedi di aggiornare la home), altrimenti la home resta con lo stile vecchio.

## Parte legale (da completare prima di vendere)
- In `assets/js/config.js` compila i dati aziendali: `legalName`, `vatNumber`, `legalAddress`, `legalEmail` (e se li hai `pec`, `rea`). Compaiono nel footer, nelle Condizioni di vendita, nella privacy e nel modulo di recesso.
- In Stripe: Impostazioni → Email clienti → attiva "Pagamenti riusciti", così ogni cliente riceve la conferma dell'ordine via email.
- Recesso: le richieste fatte con "Recedi dal contratto qui" vengono registrate nei metadati del pagamento in Stripe (campi `recesso_...`). Rispondi al cliente via email con l'indirizzo per la restituzione.
- Google Fonts si carica solo se il visitatore accetta il banner cookie.

## Foto nella pagina di pagamento Stripe
Stripe non mostra le immagini WebP: il server usa le copie JPG in `assets/img/checkout/` (stesso nome della foto, estensione .jpg). La prima volta che una variante viene ordinata, il server carica la foto direttamente su Stripe e crea un prodotto Stripe con id che inizia per `s3d_` (lo vedi in Catalogo prodotti): dagli ordini successivi lo riusa. Non cancellare quei prodotti mentre il sito è attivo; se lo fai, vengono ricreati al primo ordine.
Quando aggiungi o cambi le foto dei prodotti, crea anche le copie JPG con `python tools/checkout-images.py` (oppure chiedi di farlo).
