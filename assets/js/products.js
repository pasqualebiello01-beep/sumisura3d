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
  "Arancione": "#FF5A1F"
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
const TRE_COLORI = ["Nero opaco", "Grigio titanio", "Arancione"];

export const S3D_PRODUCTS = [
  {
    id: "ingranaggio-ricambio",
    name: "Ingranaggio di ricambio",
    category: "ricambi",
    price: 18,
    short: "Ingranaggio a denti dritti ricostruito sulle misure del pezzo originale.",
    description: [
      "Testo di esempio. Descrivi qui il prodotto reale: a cosa serve, su quali apparecchi si monta e quali misure servono per ordinarlo.",
      "Per un ricambio diverso da questo, aggiungi le misure o il modello dell'apparecchio nel campo note: valutiamo la fattibilità prima di confermare il prezzo."
    ],
    images: [
      { src: "assets/img/prodotti/ingranaggio-ricambio.webp", alt: "Ingranaggio nero a 18 denti con mozzo centrale e cava per chiavetta" },
      { src: "assets/img/prodotti/ingranaggio-ricambio-dettaglio.webp", alt: "Ingranaggio nero visto dal lato opposto" }
    ],
    model: "assets/models/ingranaggio-ricambio.glb",
    variants: [
      coloreVariante("ingranaggio-ricambio", "Ingranaggio di ricambio", ["Nero opaco", "Grigio titanio"]),
      { name: "Diametro", options: [{ label: "40 mm", priceDelta: -4 }, { label: "60 mm", priceDelta: 0 }, { label: "80 mm", priceDelta: 6 }] }
    ],
    specs: [
      { label: "Denti", value: "18 (modello di esempio)" },
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
      "Testo di esempio. Indica qui per quali apparecchi è pensata e come si sceglie l'attacco corretto.",
      "Scegli l'attacco per vedere il foro sotto la manopola. Con \"Su misura\" la manopola arriva piena e il foro viene realizzato sulle misure che indichi nel campo note."
    ],
    images: [{ src: "assets/img/prodotti/manopola-ricambio.webp", alt: "Manopola grigia cilindrica con zigrinatura verticale" }],
    model: "assets/models/manopola-ricambio-albero-a-d.glb",
    variants: [
      coloreVariante("manopola-ricambio", "Manopola zigrinata", ["Grigio titanio", "Nero opaco", "Arancione"]),
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
    specs: [{ label: "Diametro", value: "32 mm (modello di esempio)" }],
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
      "Testo di esempio. Racconta qui forma, dimensioni e uso del prodotto reale."
    ],
    images: [
      { src: "assets/img/prodotti/vaso-geometrico.webp", alt: "Vaso arancione con superficie a spirale" },
      { src: "assets/img/prodotti/vaso-geometrico-dettaglio.webp", alt: "Vaso arancione visto dal retro" }
    ],
    model: "assets/models/vaso-geometrico.glb",
    variants: [
      coloreVariante("vaso-geometrico", "Vaso torsione", ["Arancione", "Nero opaco", "Grigio titanio"]),
      { name: "Altezza", options: [{ label: "12 cm", priceDelta: 0 }, { label: "18 cm", priceDelta: 10 }] }
    ],
    specs: [{ label: "Altezza", value: "12 cm (modello di esempio)" }],
    featured: true,
    placeholder: true
  },
  {
    id: "supporto-smartphone",
    name: "Supporto per smartphone",
    category: "accessori",
    price: 14,
    short: "Supporto da scrivania inclinato, con bordo di appoggio.",
    description: ["Testo di esempio. Indica compatibilità e dimensioni del prodotto reale."],
    images: [
      { src: "assets/img/prodotti/supporto-smartphone.webp", alt: "Supporto nero per smartphone con schienale inclinato" },
      { src: "assets/img/prodotti/supporto-smartphone-dettaglio.webp", alt: "Supporto nero visto di lato" }
    ],
    model: "assets/models/supporto-smartphone.glb",
    variants: [coloreVariante("supporto-smartphone", "Supporto per smartphone", TRE_COLORI)],
    specs: [{ label: "Larghezza", value: "76 mm (modello di esempio)" }],
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
      "Testo di esempio. Descrivi qui dimensioni, scomparti e uso del prodotto reale."
    ],
    images: [
      { src: "assets/img/prodotti/organizer-scrivania.webp", alt: "Organizer color avorio con quattro scomparti" },
      { src: "assets/img/prodotti/organizer-scrivania-dettaglio.webp", alt: "Organizer color avorio visto dal retro" }
    ],
    model: "assets/models/organizer-scrivania.glb",
    variants: [coloreVariante("organizer-scrivania", "Organizer da scrivania", TRE_COLORI)],
    specs: [{ label: "Dimensioni", value: "120 × 80 × 60 mm (modello di esempio)" }],
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
      "Descrivi nel campo note cosa ti serve: misure, quantità, uso previsto. Se hai foto, disegni o file 3D, indicalo nella richiesta e ti diremo come inviarceli.",
      "Il prezzo dipende dal progetto e te lo comunichiamo nel preventivo."
    ],
    images: [
      { src: "assets/img/prodotti/ingranaggio-ricambio-dettaglio.webp", alt: "Esempio di pezzo tecnico stampato in 3D" }
    ],
    model: null,
    variants: [
      { name: "Tipo di richiesta", options: [{ label: "Prototipo", priceDelta: 0 }, { label: "Ricambio", priceDelta: 0 }, { label: "Oggetto personalizzato", priceDelta: 0 }] }
    ],
    specs: [],
    featured: false,
    placeholder: false
  }
];

/* Rende i dati disponibili agli altri script del sito */
if (typeof window !== "undefined") {
  Object.assign(window, { S3D_PRODUCTS, S3D_CATEGORIES, S3D_COLORS, S3D_SHIPPING });
}
