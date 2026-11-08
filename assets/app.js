
(() => {
const byId = id => document.getElementById(id);
const menu = byId('menuBtn');
const nav = byId('nav');
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
const links = [...nav.querySelectorAll('a')];
links.forEach(link => link.addEventListener('click', () => {
  if (menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus({preventScroll:true});
  }
}));
nav.closest('header').addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});
function markSection() {
  for (const link of links) {
    if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', markSection);
markSection();

})();



(() => {
const byId = id => document.getElementById(id);
const products = new Map([...document.querySelectorAll('[data-product]')].map(card => [
  card.dataset.product,
  {...card.dataset, price: Number(card.dataset.price), image: card.querySelector('img').src}
]));
const cartKey = 'su-misura-3d-cart-v1';
const quantities = new Map();
let cartStorage;
try {
  const storage = window.localStorage;
  const probe = cartKey + ':test';
  storage.setItem(probe, '1');
  storage.removeItem(probe);
  cartStorage = storage;
  const saved = JSON.parse(storage.getItem(cartKey) || '{}');
  for (const [id, qty] of Object.entries(saved || {})) {
    if (products.has(id) && Number.isInteger(qty) && qty > 0 && qty <= 99) quantities.set(id, qty);
  }
} catch { /* Il carrello resta disponibile in memoria. */ }
const euro = new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'});
const cart = byId('cart');
const items = byId('cartItems');
function renderCart() {
  let count = 0;
  let total = 0;
  items.replaceChildren();
  for (const [id, qty] of quantities) {
    const product = products.get(id);
    count += qty;
    total += product.price * qty;
    const row = document.createElement('article');
    row.className = 'cart-item';
    row.innerHTML = `<img alt=""><div><p><strong></strong></p><p class="variant"></p><p class="line-price"></p><div class="qty"><button type="button" data-change="-1">−</button><span></span><button type="button" data-change="1">+</button><button type="button" class="remove-item" data-change="remove">Rimuovi</button></div></div>`;
    row.querySelector('img').src = product.image;
    row.querySelector('strong').textContent = product.title;
    row.querySelector('.variant').textContent = product.variant;
    row.querySelector('.line-price').textContent = product.quote ? 'Su preventivo' : `${euro.format(product.price / 100)} cad. · ${euro.format(product.price * qty / 100)}`;
    row.querySelector('.qty span').textContent = String(qty);
    row.querySelectorAll('[data-change]').forEach((button, i) => {
      button.dataset.item = id;
      button.setAttribute('aria-label', `${['Diminuisci quantità', 'Aumenta quantità', 'Rimuovi'][i]}: ${product.title}`);
    });
    items.append(row);
  }
  byId('cartCount').textContent = String(count);
  byId('cartTotal').textContent = euro.format(total / 100);
  byId('cartPricedTotal').hidden = total === 0;
  byId('openCheckout').hidden = total === 0;
  byId('cartQuote').hidden = ![...quantities.keys()].some(id => products.get(id).quote);
  byId('cartFooter').hidden = count === 0;
  byId('cartStorageStatus').textContent = cartStorage
    ? 'Carrello salvato automaticamente in questo browser.'
    : 'Il browser blocca il salvataggio. Il carrello rimane disponibile finché questa pagina è aperta.';
  if (!count) items.textContent = 'Il carrello è vuoto. Esplora il catalogo per aggiungere un articolo.';
}
function updateCart(id, qty) {
  if (qty > 0) quantities.set(id, Math.min(qty, 99));
  else quantities.delete(id);
  try { cartStorage?.setItem(cartKey, JSON.stringify(Object.fromEntries(quantities))); }
  catch { cartStorage = undefined; }
  renderCart();
}
const checkout = byId('checkout');
const shade = byId('cartShade');
const toggle = byId('cartToggle');
const storefront = document.querySelector('main');
const header = document.querySelector('.site-header');
const footer = document.querySelector('.site-footer');
let opener;
function showCart(event) {
  opener = document.activeElement;
  cart.hidden = shade.hidden = false;
  storefront.inert = header.inert = footer.inert = checkout.inert = true;
  document.body.classList.add('cart-is-open');
  toggle.setAttribute('aria-expanded', 'true');
  byId('closeCart').focus();
  event?.preventDefault();
}
function closeCart(restoreFocus = true) {
  if (cart.hidden && location.hash !== '#cart') return;
  cart.hidden = shade.hidden = true;
  storefront.inert = header.inert = footer.inert = checkout.inert = false;
  document.body.classList.remove('cart-is-open');
  toggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) opener?.focus();
}
toggle.addEventListener('click', event => {
  byId('cartFeedback').textContent = '';
  showCart(event);
});
byId('closeCart').onclick = event => {
  if (location.hash !== '#cart') event.preventDefault();
  closeCart();
};
shade.onclick = () => closeCart();
byId('keepExploring').onclick = () => closeCart();
cart.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (location.hash === '#cart') location.hash = 'prodotti';
    closeCart();
  }
  if (event.key !== 'Tab') return;
  const controls = [...cart.querySelectorAll('button, a[href]')].filter(el => !el.closest('[hidden]'));
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
function renderCheckout() {
  const list = byId('checkoutItems');
  list.replaceChildren();
  let hasPricedProducts = false;
  let hasQuoteProducts = false;
  for (const [id, qty] of quantities) {
    const product = products.get(id);
    if (!product) continue;
    if (product.quote) hasQuoteProducts = true;
    else hasPricedProducts = true;

    const line = document.createElement('li');
    line.className = 'checkout-product';
    const photo = document.createElement('img');
    photo.className = 'checkout-product-image';
    photo.src = product.image;
    photo.alt = `Foto: ${product.title}`;
    photo.width = 112;
    photo.height = 75;
    photo.decoding = 'async';

    const detail = document.createElement('div');
    detail.className = 'checkout-product-detail';
    const title = document.createElement('strong');
    title.textContent = product.title;
    const variant = document.createElement('span');
    variant.textContent = product.variant;
    const quantity = document.createElement('small');
    quantity.textContent = `Quantità: ${qty}`;
    detail.append(title, variant, quantity);

    const amount = document.createElement('strong');
    amount.className = 'checkout-product-price';
    amount.textContent = product.quote ? 'Su preventivo' : euro.format(qty * product.price / 100);
    line.append(photo, detail, amount);
    list.append(line);
  }
  byId('checkoutTotal').textContent = byId('cartTotal').textContent;
  byId('quoteCheckout').hidden = !hasQuoteProducts;
  byId('checkoutPricedTotal').hidden = !hasPricedProducts;
  byId('checkoutPayment').hidden = !hasPricedProducts;
  document.querySelectorAll('.stripe-pay-cart').forEach(link => {
    link.hidden = !quantities.has(link.dataset.stripeProduct);
  });
  byId('checkoutEmpty').hidden = quantities.size > 0;
}
function showRoute() {
  const inCheckout = location.hash === '#checkout';
  if (location.hash === '#cart') {
    showCart();
    return;
  }
  closeCart(false);
  storefront.hidden = inCheckout;
  checkout.hidden = !inCheckout;
  if (inCheckout) {
    renderCheckout();
    checkout.focus({preventScroll: true});
    window.scrollTo({top:0, left:0, behavior:'instant'});
  }
}
byId('openCheckout').onclick = () => {
  if (location.hash === '#checkout') showRoute();
};
window.addEventListener('hashchange', showRoute);
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', event => {
  const id = button.dataset.add;
  const product = products.get(id);
  if (!product) return;
  updateCart(id, (quantities.get(id) || 0) + 1);
  byId('cartFeedback').textContent = product.title + ' · nel carrello';
  showCart(event);
}));
items.addEventListener('click', event => {
  const button = event.target.closest('[data-change]');
  if (!button) return;
  const {item, change} = button.dataset;
  updateCart(item, change === 'remove' ? 0 : (quantities.get(item) || 0) + Number(change));
  (items.querySelector(`[data-item="${item}"][data-change="${change}"]`) || byId('closeCart')).focus();
});
function prepareQuote() {
  closeCart(false);
  const entries = [...quantities].filter(([id]) => products.get(id).quote);
  const field = byId('cMsg');
  if (!field.value && entries.length) {
    field.value = 'Vorrei un preventivo per:\n' + entries.map(([id, qty]) => `${qty} × ${products.get(id).title}`).join('\n') + '\n\nMisure, materiali e uso previsto: ';
    byId('cTopic').value = entries.length === 1 ? (entries[0][0] === '2' ? 'Personalizzati' : 'Ricambi e componenti') : 'Altro';
  }
}
byId('cartQuote').addEventListener('click', prepareQuote);
byId('checkoutQuoteLink').addEventListener('click', prepareQuote);
renderCart();
document.body.classList.add('cart-enhanced');
showRoute();
document.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
  byId('cTopic').value = button.dataset.topic;
  location.hash = 'contatti';
  byId('cTopic').focus({preventScroll:true});
}));

})();



(() => {
const byId = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduced.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      if (!reduced.matches && target.animate) target.animate([{opacity: .65}, {opacity: 1}], {duration: 260, delay: Number(target.dataset.revealDelay), easing: 'ease-out'});
      observer.unobserve(target);
    }
  }, {threshold: .12});
  document.querySelectorAll('.head, .card').forEach((node, index) => {
    node.dataset.revealDelay = String(node.classList.contains('card') ? (index % 4) * 65 : 0);
    observer.observe(node);
  });
}


const contact = byId('contactForm');
const contactLink = byId('contactWhatsapp');
const whatsappUrl = contactLink.href;
function prepareContactMessage() {
  const details = [
    ['Nome', 'cName'],
    ['Email', 'cMail'],
    ['Richiesta', 'cTopic'],
    ['Dettagli', 'cMsg']
  ].map(([label, id]) => [label, byId(id).value.trim()])
    .filter(([, value]) => value)
    .map(([label, value]) => label + ': ' + value);
  contactLink.href = details.length
    ? whatsappUrl + '?text=' + encodeURIComponent(['Ciao Manuel, ti contatto da Su Misura 3D.', '', ...details].join('\n'))
    : whatsappUrl;
}
contactLink.addEventListener('click', event => {
  if (!contact.reportValidity()) {
    event.preventDefault();
    return;
  }
  prepareContactMessage();
});
contact.addEventListener('submit', event => {
  event.preventDefault();
  contactLink.click();
});
})();



/* Hero live: 3 fotografie reali, transizioni leggere e pause automatiche.
   Il primo fotogramma resta gia visibile senza JavaScript. */
(() => {
  const container = document.getElementById('heroMedia');
  if (!container) return;
  const slides = [...container.querySelectorAll('.frame')];
  if (slides.length < 2) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const broken = new Set();
  let index = Math.max(0, slides.findIndex(node => node.classList.contains('is-active')));
  let visible = true;
  let timer = null;
  const images = slides.map(slide => slide.querySelector('img'));

  const setSlide = next => {
    if (next === index || broken.has(next)) return;
    const image = images[next];
    if (!image) return;
    if (!image.complete) {
      image.addEventListener('load', () => setSlide(next), {once:true});
      return;
    }
    if (!image.naturalWidth) {broken.add(next); return;}
    slides[index].classList.remove('is-active');
    slides[next].classList.add('is-active');
    index = next;
  };
  const advance = () => {
    for (let step = 1; step < slides.length; step++) {
      const next = (index + step) % slides.length;
      if (!broken.has(next)) {setSlide(next); break;}
    }
  };
  const refresh = () => {
    const shouldRun = visible && !document.hidden && !motion.matches;
    if (!shouldRun && timer !== null) {clearInterval(timer); timer = null;}
    if (shouldRun && timer === null) timer = setInterval(advance, 5200);
  };
  images.forEach((img, i) => {
    img?.addEventListener('error', () => {
      broken.add(i);
      if (i === index) advance();
    });
    if (i === 0 && img?.complete && !img.naturalWidth) broken.add(i);
  });
  const warmLater = () => {
    // Dopo la prima visualizzazione, preleva le altre 2 foto (dimensioni ridotte).
    for (const img of images.slice(1)) if (img) img.loading = 'eager';
  };
  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) requestIdleCallback(warmLater, {timeout: 2300});
    else setTimeout(warmLater, 1200);
  }, {once:true});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      refresh();
    }, {threshold: .03});
    observer.observe(container);
  }
  document.addEventListener('visibilitychange', refresh);
  motion.addEventListener?.('change', refresh);
  refresh();
})();
