SU MISURA 3D — VERSIONE MOBILE + IMMAGINI LIVE (NOVEMBRE 2026)

COSA TROVI
- index.html: homepage completa (testi, prodotti, carrello, checkout, contatti).
- assets/site.css: grafica completa.
- assets/app.js: menu mobile, carrello, preventivo WhatsApp e cambio fotografie della home.
- assets/*.webp: 16 immagini vere gia ottimizzate (2 risoluzioni per foto).

PUBBLICAZIONE
1. Esegui il backup dell'attuale sito.
2. Carica index.html e l'INTERA cartella assets/ nella stessa directory web.
   Esempio: public_html/index.html, public_html/assets/site.css,
   public_html/assets/app.js, public_html/assets/hero-1-800.webp.
3. NON caricare soltanto index.html: senza assets/ si perdono foto, stile e script.
4. Svuota la cache CDN/hosting e controlla la home su smartphone.
5. Verifica carrello, pagamenti e pagine legali in staging prima dell'uso pubblico.

OTTIMIZZAZIONI
- Foto WebP realmente presenti nello ZIP, con srcset e lazy loading sotto la piega.
- L'immagine principale usa fetchpriority=high ed e caricata subito.
- Dimensioni reali delle immagini impostate nell'HTML per contenere il CLS.
- Slideshow LIVE mobile/desktop: solo dissolvenza opacity, pausa quando la
  pagina non e visibile e rispetto di prefers-reduced-motion.
- Il CSS critico della homepage e immediato; CSS esteso e JS in file separati.
- Controllo validazione modulo prima dell'apertura di WhatsApp.
- Link WhatsApp e Stripe originali lasciati invariati.

ATTENZIONE PRIMA DI VENDERE
- I link Stripe sono link di pagamento del SINGOLO prodotto; quantita e totale
  combinato del carrello non sono sincronizzati automaticamente con Stripe.
  Verifica sempre importo e quantita prima di pagare; per acquisti multipli
  serve un checkout server-side o link Stripe configurati correttamente.
- Le pagine legali nel codice originale includono BOZZE da completare.
- Il punteggio PageSpeed reale dipende anche da server, cache, CDN e rete.
  Non e possibile garantirti 90-100 prima della pubblicazione e misurazione.

ANTEPRIMA
Apri index.html insieme a assets/ in una cartella. Per provare il carrello con
storage e file locali, e preferibile un semplice server HTTP in staging.


AGGIORNAMENTO CHECKOUT (8 novembre 2026):
- Foto reali dei prodotti in #checkout e nei checkout dei singoli prodotti.
- Rimosso il pulsante “Scarica riepilogo”.
- Conservato il pagamento via link Stripe per singolo prodotto: attenzione, quantità e totale non sono sincronizzati con Stripe.
- Per pubblicare: caricare index.html e TUTTA la cartella assets/ (non solo index.html).


AGGIORNAMENTO PREZZO VASO – 8 NOVEMBRE 2026
- Vaso geometrico (Verde salvia): 67,00 € / pezzo.
- Link Stripe del solo vaso sostituito con: https://buy.stripe.com/7sY00i0XZ7jV55x7aLbo404
- Aggiornati catalogo, carrello JS, quantitativi/sottototali statici e checkout.
- Tutti gli altri prodotti, prezzi e link Stripe invariati.
- Controlla che la pagina Stripe mostri 67,00 € prima di accettare ordini; il prezzo di Stripe non si modifica dal codice del sito.
- I link Stripe aprono ancora il singolo prodotto: il numero di articoli nel carrello non viene trasferito a Stripe.
