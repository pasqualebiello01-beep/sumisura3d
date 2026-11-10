"""Crea le copie JPG delle foto prodotto per la pagina di pagamento Stripe (che non mostra i WebP).
Uso: python tools/checkout-images.py   (rilancialo quando aggiungi o cambi le foto dei prodotti)"""
from PIL import Image
import os, re
root = os.path.join(os.path.dirname(__file__), "..")
src = os.path.join(root, "assets/img/prodotti"); dst = os.path.join(root, "assets/img/checkout")
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith(".webp") or re.search(r"-(300|600)\.webp$", f) or "-dettaglio" in f or f.endswith("-sotto.webp"):
        continue
    im = Image.open(os.path.join(src, f)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    out = bg.convert("RGB"); out.thumbnail((500, 500), Image.LANCZOS)
    out.save(os.path.join(dst, f[:-5] + ".jpg"), "JPEG", quality=82, optimize=True, progressive=True)
    print("ok", f)
