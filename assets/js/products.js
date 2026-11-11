/* =====================================================================
   CATALOGO PRODOTTI
   ---------------------------------------------------------------------
   Questo file è letto sia dal sito sia dal server del checkout (Cloudflare):
   i prezzi pagati con Stripe vengono calcolati da qui, non dal browser.

   Tutti i prodotti qui sotto sono ESEMPI (placeholder: true).
   Sostituiscili con i tuoi: nomi, prezzi, testi, immagini e modelli 3D.

   Campi:
   id          identificativo univoco, solo minuscole e trattini (usato nell'URL)
   name        nome del prodotto
   category    uno degli id in S3D_CATEGORIES
   price       prezzo base in euro (numero) oppure null = "Su preventivo" (solo WhatsApp)
   short       frase breve per le schede
   description array di paragrafi
   images      [{ src, alt }]  la prima è l'immagine principale.
               Formato consigliato: WebP 1100×1100 + versione "-600" per le schede
   model       percorso di un file .glb/.gltf oppure null (nessuna vista 3D)
   variants    [{ name, options: [{ label, priceDelta, color, images }] }]
               priceDelta in euro. Facoltativi: color (esadecimale, ricolora il
               modello 3D) e images (foto mostrate quando l'opzione è scelta).
               Per i colori usa coloreVariante(id, nome, [colori]) qui sotto.
               Altri facoltativi: model (modello 3D da usare con quell'opzione) e,
               sulla variante, view: n (quando cambia, mostra la foto numero n, da 0).
               custom: true sull'opzione = pezzo su misura: non si paga online,
               va richiesto con un preventivo su WhatsApp. Lo stesso vale per
               qualsiasi prodotto a cui il cliente aggiunge una nota di modifica.
   imageVariants / imageViews  (facoltativi) foto che dipendono da più varianti,
               vedi "Manopola zigrinata" e il README.
   specs       [{ label, value }]  dettagli tecnici: inserisci solo dati verificati
   featured    true = mostrato in homepage
   placeholder true = mostra il badge "Esempio" (rimuovi sui prodotti reali).
               Con le chiavi Stripe "live" i prodotti di esempio NON si possono pagare.
   ===================================================================== */

/* Spedizione aggiunta al checkout Stripe e mostrata nel carrello */
export const S3D_SHIPPING = { amount: 6.99, label: "Poste Italiane", countries: ["IT"] };

export const S3D_CATEGORIES = [
  { id: "ricambi", name: "Ricambi", description: "Pezzi fuori produzione o introvabili, ricostruiti su misura." },
  { id: "casa", name: "Casa e design", description: "Oggetti per la casa e l'ufficio." },
  { id: "accessori", name: "Accessori", description: "Supporti e piccoli accessori di uso quotidiano." },
  { id: "su-misura", name: "Su misura", description: "Prototipi e progetti realizzati sulla tua idea." }
];

/* Colori disponibili: nome mostrato → colore usato per il pallino e per il modello 3D */
export const S3D_COLORS = {
  "Nero opaco": "#3A3C41",
  "Grigio titanio": "#8B9097",
  "Arancione": "#FF5A1F",
  "Bianco": "#E4E2DC"
};

/**
 * Crea la variante "Colore" con le foto di ogni colore.
 * Le foto si chiamano  assets/img/prodotti/<id>-<colore>.webp  e  <id>-<colore>-dettaglio.webp
 * (es. vaso-geometrico-nero-opaco.webp), più le versioni "-600" per le schede.
 * Il primo colore dell'elenco è quello mostrato di default.
 */
function coloreVariante(id, nome, colori) {
  const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    name: "Colore",
    options: colori.map((label) => ({
      label,
      priceDelta: 0,
      color: S3D_COLORS[label],
      images: [
        { src: `assets/img/prodotti/${id}-${slug(label)}.webp`, alt: `${nome}, colore ${label.toLowerCase()}` },
        { src: `assets/img/prodotti/${id}-${slug(label)}-dettaglio.webp`, alt: `${nome}, colore ${label.toLowerCase()}, vista dal retro` }
      ]
    }))
  };
}
const TRE_COLORI = ["Nero opaco", "Grigio titanio", "Arancione", "Bianco"];

export const S3D_PRODUCTS = [
  {
    id: "ingranaggio-ricambio",
    name: "Ingranaggio di ricambio",
    category: "ricambi",
    price: 18,
    short: "Ingranaggio a denti dritti ricostruito sulle misure del pezzo originale.",
    description: [
      "Un ingranaggio consumato o con un dente rotto può fermare un intero apparecchio, e spesso il ricambio originale non si trova più. Questo ingranaggio a denti dritti, con mozzo centrale e cava per chiavetta, è pensato proprio per rimettere in funzione meccanismi come piccoli elettrodomestici, giocattoli, tapparelle, stampanti e attrezzi da laboratorio.",
      "Lo stampiamo in 3D strato dopo strato con un materiale tecnico adatto a lavorare sotto sforzo, così i denti restano precisi e resistenti all'usura. Scegli il colore e il diametro che ti servono: il prezzo si aggiorna in automatico.",
      "Il tuo ingranaggio ha un numero di denti, uno spessore o un foro diversi? Scrivi le misure o il modello dell'apparecchio nel campo note: il pezzo diventa su misura e ti mandiamo il preventivo su WhatsApp prima di realizzarlo."
    ],
    images: [
      { src: "assets/img/prodotti/ingranaggio-ricambio.webp", alt: "Ingranaggio nero a 18 denti con mozzo centrale e cava per chiavetta" },
      { src: "assets/img/prodotti/ingranaggio-ricambio-dettaglio.webp", alt: "Ingranaggio nero visto dal lato opposto" }
    ],
    model: "assets/models/ingranaggio-ricambio.glb",
    variants: [
      coloreVariante("ingranaggio-ricambio", "Ingranaggio di ricambio", ["Nero opaco", "Grigio titanio", "Bianco"]),
      { name: "Diametro", options: [{ label: "40 mm", priceDelta: -4 }, { label: "60 mm", priceDelta: 0 }, { label: "80 mm", priceDelta: 6 }] }
    ],
    specs: [
      { label: "Tecnologia", value: "Stampa 3D FDM" },
      { label: "Denti", value: "18" },
      { label: "Spessore", value: "10 mm + mozzo 4 mm" }
    ],
    featured: true,
    placeholder: true
  },
  {
    id: "manopola-ricambio",
    name: "Manopola zigrinata",
    category: "ricambi",
    price: 9,
    short: "Manopola di ricambio con presa zigrinata, per elettrodomestici e attrezzature.",
    description: [
      "La manopola di forno, piano cottura, lavatrice o di un'attrezzatura da lavoro si è rotta o è andata persa? Questa manopola cilindrica con presa zigrinata si impugna bene anche con le mani bagnate o unte e ridà un aspetto ordinato all'apparecchio.",
      "Scegli l'attacco giusto per il tuo perno: \"Albero a D\" per i perni con un lato piatto, il più comune su forni e fornelli; \"Albero tondo\" per i perni cilindrici. Selezionando l'attacco vedi la foto e il modello 3D del foro sotto la manopola.",
      "Se il tuo perno ha una forma o una misura diversa, scegli \"Su misura\" e indica nel campo note il diametro del perno e il modello dell'apparecchio: realizziamo il foro sulle tue misure e ti mandiamo il preventivo su WhatsApp."
    ],
    images: [{ src: "assets/img/prodotti/manopola-ricambio.webp", alt: "Manopola grigia cilindrica con zigrinatura verticale" }],
    model: "assets/models/manopola-ricambio-albero-a-d.glb",
    variants: [
      coloreVariante("manopola-ricambio", "Manopola zigrinata", ["Grigio titanio", "Nero opaco", "Arancione", "Bianco"]),
      {
        name: "Attacco",
        view: 1, // quando cambia l'attacco mostra la foto da sotto
        options: [
          { label: "Albero a D", priceDelta: 0, model: "assets/models/manopola-ricambio-albero-a-d.glb" },
          { label: "Albero tondo", priceDelta: 0, model: "assets/models/manopola-ricambio-albero-tondo.glb" },
          { label: "Su misura", priceDelta: 3, custom: true, model: "assets/models/manopola-ricambio-su-misura.glb" }
        ]
      }
    ],
    // Foto per ogni combinazione: manopola-ricambio-<colore>-<attacco>.webp e ...-sotto.webp
    imageVariants: ["Colore", "Attacco"],
    imageViews: [
      { suffix: "", label: "vista dall'alto" },
      { suffix: "-sotto", label: "vista da sotto, con il foro di attacco" }
    ],
    specs: [{ label: "Tecnologia", value: "Stampa 3D FDM" }, { label: "Diametro", value: "32 mm" }],
    featured: true,
    placeholder: true
  },
  {
    id: "vaso-geometrico",
    name: "Vaso torsione",
    category: "casa",
    price: 29,
    short: "Vaso con pareti a torsione che giocano con la luce.",
    description: [
      "Un vaso dalle linee morbide che sembra ruotare su sé stesso: le pareti a torsione creano giochi di luce e ombra che cambiano durante il giorno. È perfetto per fiori secchi, piante grasse, pennelli o come oggetto decorativo su una mensola, una libreria o la scrivania.",
      "La stampa 3D a strati lascia sulla superficie una texture sottile e regolare, che rende ogni vaso un pezzo dal carattere artigianale. Puoi sceglierlo in tre colori e in due altezze, 12 o 18 cm.",
      "Per fiori freschi con acqua ti consigliamo di inserire all'interno un piccolo contenitore in vetro. Vuoi un'altezza o un colore diverso? Scrivilo nel campo note e ti mandiamo un preventivo."
    ],
    images: [
      { src: "assets/img/prodotti/vaso-geometrico.webp", alt: "Vaso arancione con superficie a spirale" },
      { src: "assets/img/prodotti/vaso-geometrico-dettaglio.webp", alt: "Vaso arancione visto dal retro" }
    ],
    model: "assets/models/vaso-geometrico.glb",
    variants: [
      coloreVariante("vaso-geometrico", "Vaso torsione", ["Arancione", "Nero opaco", "Grigio titanio", "Bianco"]),
      { name: "Altezza", options: [{ label: "12 cm", priceDelta: 0 }, { label: "18 cm", priceDelta: 10 }] }
    ],
    specs: [{ label: "Tecnologia", value: "Stampa 3D FDM" }, { label: "Altezza", value: "12 o 18 cm" }],
    featured: true,
    placeholder: true
  },
  {
    id: "supporto-smartphone",
    name: "Supporto per smartphone",
    category: "accessori",
    price: 14,
    short: "Supporto da scrivania inclinato, con bordo di appoggio.",
    description: [
      "Un supporto semplice e stabile per tenere il telefono in piedi sulla scrivania, sul comodino o in cucina. Lo schienale inclinato lascia lo schermo ben visibile mentre lavori, segui una ricetta, guardi un video o fai una videochiamata.",
      "Il bordo di appoggio trattiene il telefono in modo sicuro e la base larga evita che si ribalti. Va bene per la maggior parte degli smartphone, anche con la cover.",
      "Disponibile in tre colori. Hai un tablet o ti serve un'inclinazione diversa? Indicalo nel campo note e lo realizziamo su misura."
    ],
    images: [
      { src: "assets/img/prodotti/supporto-smartphone.webp", alt: "Supporto nero per smartphone con schienale inclinato" },
      { src: "assets/img/prodotti/supporto-smartphone-dettaglio.webp", alt: "Supporto nero visto di lato" }
    ],
    model: "assets/models/supporto-smartphone.glb",
    variants: [coloreVariante("supporto-smartphone", "Supporto per smartphone", TRE_COLORI)],
    specs: [{ label: "Tecnologia", value: "Stampa 3D FDM" }, { label: "Larghezza", value: "76 mm" }],
    featured: true,
    placeholder: true
  },
  {
    id: "organizer-scrivania",
    name: "Organizer da scrivania",
    category: "casa",
    price: 24,
    short: "Organizer a scomparti per penne, cavi e piccoli oggetti.",
    description: [
      "Penne, evidenziatori, cavi, chiavette USB, graffette: tutto al suo posto e sempre a portata di mano. Questo organizer a scomparti di diverse altezze mette ordine sulla scrivania di casa o dell'ufficio senza occupare troppo spazio.",
      "Ha un design pulito, con linee essenziali che stanno bene in qualsiasi ambiente, ed è stampato in 3D in un unico pezzo, robusto e leggero. Puoi sceglierlo in tre colori, per abbinarlo alla tua postazione.",
      "Ti servono scomparti diversi, il tuo nome o il logo della tua attività? Scrivilo nel campo note: lo progettiamo su misura e ti mandiamo il preventivo su WhatsApp."
    ],
    images: [
      { src: "assets/img/prodotti/organizer-scrivania.webp", alt: "Organizer color avorio con quattro scomparti" },
      { src: "assets/img/prodotti/organizer-scrivania-dettaglio.webp", alt: "Organizer color avorio visto dal retro" }
    ],
    model: "assets/models/organizer-scrivania.glb",
    variants: [coloreVariante("organizer-scrivania", "Organizer da scrivania", TRE_COLORI)],
    specs: [{ label: "Tecnologia", value: "Stampa 3D FDM" }, { label: "Dimensioni", value: "120 × 80 × 60 mm" }],
    featured: false,
    placeholder: true
  },
  {
    id: "progetto-su-misura",
    name: "Prototipo o progetto su misura",
    category: "su-misura",
    price: null,
    short: "Parti da un'idea, un disegno o un pezzo rotto: lo realizziamo per te.",
    description: [
      "Hai un'idea da trasformare in oggetto, un prototipo da testare o un pezzo rotto che non si trova più? Lo progettiamo e lo stampiamo in 3D per te, anche in un solo esemplare.",
      "Descrivi nel campo note cosa ti serve: misure, quantità, uso previsto e, se lo sai, dove verrà utilizzato il pezzo (all'interno, all'aperto, vicino a fonti di calore). Se hai foto, disegni o file 3D, indicalo nella richiesta e ti diremo come inviarceli.",
      "In base all'uso scegliamo insieme il materiale più adatto tra PLA, PETG, ABS e ASA. Il prezzo dipende dal progetto e te lo comunichiamo nel preventivo su WhatsApp prima di iniziare."
    ],
    images: [
      { src: "assets/img/prodotti/progetto-su-misura.webp", alt: "Schizzo con le misure su un foglio a quadretti e lo stesso oggetto stampato in 3D accanto" }
    ],
    model: null,
    variants: [
      { name: "Tipo di richiesta", options: [{ label: "Prototipo", priceDelta: 0 }, { label: "Ricambio", priceDelta: 0 }, { label: "Oggetto personalizzato", priceDelta: 0 }] }
    ],
    specs: [{ label: "Tecnologia", value: "Stampa 3D FDM" }, { label: "Materiali", value: "PLA, PETG, ABS, ASA" }],
    featured: false,
    placeholder: false
  }
];

/* Rende i dati disponibili agli altri script del sito */
if (typeof window !== "undefined") {
  Object.assign(window, { S3D_PRODUCTS, S3D_CATEGORIES, S3D_COLORS, S3D_SHIPPING });
}
