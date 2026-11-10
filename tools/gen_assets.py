"""Genera i modelli 3D di esempio (GLB) e i relativi render (WebP) per Sumisura 3D.
Uso: python3 tools/gen_assets.py <cartella_sito>
Sono segnaposto: sostituiscili con i tuoi modelli e foto reali.
"""
import json, math, struct, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = next((a for a in sys.argv[1:] if not a.startswith("--")), "site")
os.makedirs(f"{OUT}/assets/models", exist_ok=True)
os.makedirs(f"{OUT}/assets/img/prodotti", exist_ok=True)
os.makedirs(f"{OUT}/assets/img/hero", exist_ok=True)

# ---------------------------------------------------------------- mesh utils
class Mesh:
    def __init__(self):
        self.tris = []  # list of (3x3 array)
    def tri(self, a, b, c):
        self.tris.append(np.array([a, b, c], dtype=float))
    def quad(self, a, b, c, d):
        self.tri(a, b, c); self.tri(a, c, d)
    def extend(self, m):
        self.tris += m.tris
    def arr(self):
        return np.array(self.tris)

def radial_solid(rfun, z0, z1, nt=128, nz=40, cap_bottom=True, cap_top=True):
    """Solido definito da raggio r(theta, z). z verticale (Y in glTF)."""
    m = Mesh()
    th = np.linspace(0, 2 * math.pi, nt, endpoint=False)
    zs = np.linspace(z0, z1, nz + 1)
    P = [[(rfun(t, z) * math.cos(t), z, rfun(t, z) * math.sin(t)) for t in th] for z in zs]
    for j in range(nz):
        for i in range(nt):
            i2 = (i + 1) % nt
            m.quad(P[j][i], P[j][i2], P[j + 1][i2], P[j + 1][i])
    if cap_bottom:
        c = (0, z0, 0)
        for i in range(nt):
            m.tri(c, P[0][(i + 1) % nt], P[0][i])
    if cap_top:
        c = (0, z1, 0)
        for i in range(nt):
            m.tri(c, P[-1][i], P[-1][(i + 1) % nt])
    return m

def ring_extrude(outer, inner, h0, h1, nz=1):
    """Estrude un anello: outer e inner liste (x,z) con lo stesso numero di punti."""
    m = Mesh(); n = len(outer)
    hs = np.linspace(h0, h1, nz + 1)
    for k in range(nz):
        a, b = hs[k], hs[k + 1]
        for i in range(n):
            i2 = (i + 1) % n
            o1, o2 = outer[i], outer[i2]; n1, n2 = inner[i], inner[i2]
            m.quad((o1[0], a, o1[1]), (o2[0], a, o2[1]), (o2[0], b, o2[1]), (o1[0], b, o1[1]))
            m.quad((n2[0], a, n2[1]), (n1[0], a, n1[1]), (n1[0], b, n1[1]), (n2[0], b, n2[1]))
    for i in range(n):
        i2 = (i + 1) % n
        o1, o2 = outer[i], outer[i2]; n1, n2 = inner[i], inner[i2]
        m.quad((o1[0], h1, o1[1]), (o2[0], h1, o2[1]), (n2[0], h1, n2[1]), (n1[0], h1, n1[1]))
        m.quad((n1[0], h0, n1[1]), (n2[0], h0, n2[1]), (o2[0], h0, o2[1]), (o1[0], h0, o1[1]))
    return m

def box(x0, y0, z0, x1, y1, z1, nz=1):
    m = Mesh()
    ys = np.linspace(y0, y1, nz + 1)
    for k in range(nz):
        a, b = ys[k], ys[k + 1]
        m.quad((x0, a, z1), (x1, a, z1), (x1, b, z1), (x0, b, z1))
        m.quad((x1, a, z0), (x0, a, z0), (x0, b, z0), (x1, b, z0))
        m.quad((x1, a, z1), (x1, a, z0), (x1, b, z0), (x1, b, z1))
        m.quad((x0, a, z0), (x0, a, z1), (x0, b, z1), (x0, b, z0))
    m.quad((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0))
    m.quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))
    return m

def triangulate(poly):
    """Ear clipping per poligono semplice CCW in 2D."""
    pts = list(range(len(poly))); out = []
    def area(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    def inside(p, a, b, c):
        return area(a, b, p) >= 0 and area(b, c, p) >= 0 and area(c, a, p) >= 0
    guard = 0
    while len(pts) > 3 and guard < 10000:
        guard += 1
        for k in range(len(pts)):
            i0, i1, i2 = pts[k-1], pts[k], pts[(k+1) % len(pts)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if area(a, b, c) <= 1e-12: continue
            if any(inside(poly[j], a, b, c) for j in pts if j not in (i0, i1, i2)): continue
            out.append((i0, i1, i2)); pts.pop(k); break
    out.append(tuple(pts))
    return out

def profile_extrude(poly, x0, x1, nx=1):
    """Profilo 2D (z, y) CCW estruso lungo X."""
    m = Mesh(); n = len(poly)
    xs = np.linspace(x0, x1, nx + 1)
    for k in range(nx):
        a, b = xs[k], xs[k+1]
        for i in range(n):
            p, q = poly[i], poly[(i+1) % n]
            m.quad((a, p[1], p[0]), (a, q[1], q[0]), (b, q[1], q[0]), (b, p[1], p[0]))
    for (i, j, k) in triangulate(poly):
        A, B, C = poly[i], poly[j], poly[k]
        m.tri((x1, A[1], A[0]), (x1, B[1], B[0]), (x1, C[1], C[0]))
        m.tri((x0, C[1], C[0]), (x0, B[1], B[0]), (x0, A[1], A[0]))
    return m

# ---------------------------------------------------------------- modelli (mm)
def gear(nz=1):
    teeth, R, r_root, hole = 18, 30.0, 25.5, 6.0
    N = teeth * 24
    outer, inner = [], []
    for i in range(N):
        t = 2 * math.pi * i / N
        ph = (t * teeth / (2 * math.pi)) % 1.0
        # profilo trapezoidale del dente
        if ph < 0.18: f = ph / 0.18
        elif ph < 0.45: f = 1
        elif ph < 0.63: f = 1 - (ph - 0.45) / 0.18
        else: f = 0
        r = r_root + (R - r_root) * f
        outer.append((r * math.cos(t), r * math.sin(t)))
        rh = hole
        # cava per chiavetta
        if abs(((t + math.pi) % (2*math.pi)) - math.pi) < 0.28: rh = hole + 2.2
        inner.append((rh * math.cos(t), rh * math.sin(t)))
    m = ring_extrude(outer, inner, 0, 10, nz)
    # mozzo
    hub_o = [(11 * math.cos(2*math.pi*i/N), 11 * math.sin(2*math.pi*i/N)) for i in range(N)]
    m.extend(ring_extrude(hub_o, inner, 10, 14, max(1, nz // 2)))
    return m

def knob(nz=40):
    def r(t, z):
        base = 16 - 2.5 * (z / 22) ** 2
        knurl = 0.9 * abs(math.sin(12 * t)) if z < 17 else 0
        top = 0 if z < 19 else -(z - 19) * 1.6
        return base + knurl + top
    m = radial_solid(r, 0, 22, nt=192, nz=nz)
    return m

def vase(nz=60):
    def r(t, z):
        h = z / 120
        prof = 34 + 14 * math.sin(math.pi * h * 0.95) - 8 * h
        tw = t + h * 1.4
        poly = 1 + 0.07 * math.cos(6 * tw)
        return prof * poly
    m = radial_solid(r, 0, 120, nt=180, nz=nz, cap_top=False)
    def ri(t, z): return max(r(t, z) - 2.0, 1)
    inner = radial_solid(ri, 2, 120, nt=180, nz=max(4, nz // 3), cap_top=False)
    for tr in inner.tris:  # inverti le normali dell'interno
        m.tri(tr[0], tr[2], tr[1])
    # bordo superiore
    th = np.linspace(0, 2*math.pi, 180, endpoint=False)
    for i in range(180):
        a, b = th[i], th[(i+1) % 180]
        ro_a, ro_b, ri_a, ri_b = r(a, 120), r(b, 120), ri(a, 120), ri(b, 120)
        m.quad((ro_a*math.cos(a), 120, ro_a*math.sin(a)), (ri_a*math.cos(a), 120, ri_a*math.sin(a)),
               (ri_b*math.cos(b), 120, ri_b*math.sin(b)), (ro_b*math.cos(b), 120, ro_b*math.sin(b)))
    return m

def stand(nx=1):
    a = math.radians(68); L = 92
    dx, dy = L * math.cos(a), L * math.sin(a)
    poly = [(-30, 0), (62, 0), (62, 4), (17, 4), (17 + dx, 4 + dy), (11 + dx, 4 + dy),
            (11, 4), (-24, 4), (-24, 14), (-30, 14)]
    return profile_extrude(poly, -38, 38, nx)

def organizer(nz=1):
    m = Mesh(); W, D, H, t = 120, 80, 60, 3
    m.extend(box(-W/2, 0, -D/2, W/2, t, D/2))
    m.extend(box(-W/2, 0, D/2 - t, W/2, H, D/2, nz))
    m.extend(box(-W/2, 0, -D/2, W/2, H * 0.55, -D/2 + t, nz))
    m.extend(box(-W/2, 0, -D/2, -W/2 + t, H, D/2, nz))
    m.extend(box(W/2 - t, 0, -D/2, W/2, H, D/2, nz))
    m.extend(box(-W/6, 0, -D/2, -W/6 + t, H * 0.8, D/2, nz))
    m.extend(box(W/6, 0, -D/2, W/6 + t, H, D/2, nz))
    return m

# ---------------------------------------------------------------- GLB writer
def smooth_normals(pos, fn, crease_deg=35):
    """Normali smussate sotto l'angolo di piega, spigoli vivi sopra."""
    key = np.round(pos / 1e-6).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    order = np.argsort(inv, kind="stable")
    bounds = np.flatnonzero(np.diff(inv[order])) + 1
    out = fn.copy(); c = math.cos(math.radians(crease_deg))
    for grp in np.split(order, bounds):
        if len(grp) < 2: continue
        N = fn[grp]
        W = (N @ N.T) > c
        S = W.astype(float) @ N
        S /= (np.linalg.norm(S, axis=1, keepdims=True) + 1e-12)
        out[grp] = S
    return out

def write_glb(mesh, path, color, rough=0.62):
    T = mesh.arr() / 1000.0  # mm -> m
    T = T - np.array([0, T[:, :, 1].min(), 0])
    pos = T.reshape(-1, 3).astype(np.float32)
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    n /= (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    nor = smooth_normals(pos, np.repeat(n, 3, axis=0)).astype(np.float32)
    pb, nb = pos.tobytes(), nor.tobytes()
    bin_ = pb + nb
    gltf = {
        "asset": {"version": "2.0", "generator": "Sumisura3D placeholder generator"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": color + [1.0], "metallicFactor": 0.0, "roughnessFactor": rough}, "doubleSided": True}],
        "buffers": [{"byteLength": len(bin_)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pb), "target": 34962},
            {"buffer": 0, "byteOffset": len(pb), "byteLength": len(nb), "target": 34962}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3",
             "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    bin_ += b"\0" * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bin_)
    return os.path.getsize(path)

# ---------------------------------------------------------------- renderer
def srgb(c): return np.clip(c, 0, 1) ** (1 / 2.2)

def render(mesh, path, color, size=1100, yaw=35, pitch=24, dist=2.6, ss=2, layer=0.4, fov=30, shadow=True, fill_frac=0.74, **_):
    T = mesh.arr().copy()
    T[:, :, 1] -= T[:, :, 1].min()
    V = T.reshape(-1, 3)
    c = (V.max(0) + V.min(0)) / 2
    ext = np.linalg.norm(V.max(0) - V.min(0))
    ya, pa = math.radians(yaw), math.radians(pitch)
    eye = c + dist * ext * 0.5 * np.array([math.sin(ya) * math.cos(pa), math.sin(pa), math.cos(ya) * math.cos(pa)])
    fwd = c - eye; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    S = size * ss
    def proj(P):
        r = P - eye
        z = r @ fwd
        return (r @ right) / z, (r @ up) / z, z
    ux, uy, _ = proj(V)
    # piano d'ombra incluso nel calcolo dell'inquadratura
    span = max(ux.max() - ux.min(), uy.max() - uy.min())
    k = S * fill_frac / span
    ox = S / 2 - k * (ux.max() + ux.min()) / 2
    oy = S / 2 + k * (uy.max() + uy.min()) / 2
    nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12)
    cen = T.mean(1)
    facing = np.einsum("ij,ij->i", nrm, cen - eye) < 0
    nrm[~facing] *= -1
    key = np.array([-0.5, 0.85, 0.55]); key /= np.linalg.norm(key)
    fil = np.array([0.8, 0.3, 0.4]); fil /= np.linalg.norm(fil)
    rim = -fwd + np.array([0, 0.6, 0]); rim /= np.linalg.norm(rim)
    hv = -fwd + key; hv /= np.linalg.norm(hv)
    lam = 0.28 + 0.75 * np.clip(nrm @ key, 0, None) + 0.22 * np.clip(nrm @ fil, 0, None) + 0.35 * np.clip(nrm @ rim, 0, None) ** 3
    spec = 0.2 * np.clip(nrm @ hv, 0, None) ** 28
    side = np.abs(nrm[:, 1]) < 0.8
    stripe = np.where(side, 1 - layer * 0.07 * (0.5 + 0.5 * np.cos(cen[:, 1] * 2 * np.pi / 1.2)), 1)
    cols = srgb(np.array(color)[None, :] * (lam * stripe)[:, None] + spec[:, None])
    X, Y, Z = proj(T.reshape(-1, 3))
    X = (ox + k * X).reshape(-1, 3); Y = (oy - k * Y).reshape(-1, 3); Z = Z.reshape(-1, 3)
    zbuf = np.full((S, S), np.inf); cbuf = np.zeros((S, S, 3)); abuf = np.zeros((S, S))
    for i in range(len(T)):
        xs, ys, zs = X[i], Y[i], Z[i]
        x0, x1 = max(int(xs.min()), 0), min(int(xs.max()) + 1, S - 1)
        y0, y1 = max(int(ys.min()), 0), min(int(ys.max()) + 1, S - 1)
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, bx, cx), (ay, by, cy) = xs, ys
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9: continue
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not m.any(): continue
        z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        upd = m & (z < sub)
        sub[upd] = z[upd]
        cbuf[y0:y1 + 1, x0:x1 + 1][upd] = cols[i]
        abuf[y0:y1 + 1, x0:x1 + 1][upd] = 1
    obj = np.dstack([cbuf * 255, abuf * 255]).astype(np.uint8)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if shadow:
        bp = V[::5].copy(); bp[:, 1] = 0
        sx, sy, _ = proj(bp); sx = ox + k * sx; sy = oy - k * sy
        sh = Image.new("L", (S, S), 0); sd = ImageDraw.Draw(sh)
        cx, cy = (sx.min() + sx.max()) / 2, (sy.min() + sy.max()) / 2
        w, h = (sx.max() - sx.min()) * 0.52, (sy.max() - sy.min()) * 0.5 + S * 0.01
        sd.ellipse([cx - w, cy - h + S * 0.012, cx + w, cy + h + S * 0.012], fill=110)
        sh = sh.filter(ImageFilter.GaussianBlur(S / 45))
        dark = Image.new("RGBA", (S, S), (24, 22, 20, 0)); dark.putalpha(sh)
        img = Image.alpha_composite(img, dark)
    img = Image.alpha_composite(img, Image.fromarray(obj, "RGBA"))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path, "WEBP", quality=86, method=6)
    return path

# ---------------------------------------------------------------- esegui
GRAPHITE = [0.055, 0.058, 0.066]
TITANIO = [0.30, 0.31, 0.33]
ARANCIO = [1.0, 0.11, 0.015]
AVORIO = [0.86, 0.82, 0.74]

items = [
    ("ingranaggio-ricambio", gear, GRAPHITE, True, dict(yaw=30, pitch=38)),
    ("manopola-ricambio", knob, TITANIO, True, dict(yaw=20, pitch=30)),
    ("vaso-geometrico", vase, ARANCIO, True, dict(yaw=25, pitch=18, dist=2.4)),
    ("supporto-smartphone", stand, GRAPHITE, True, dict(yaw=58, pitch=16)),
    ("organizer-scrivania", organizer, AVORIO, True, dict(yaw=32, pitch=34)),
]
GLB_ONLY = "--glb-only" in sys.argv
COLORS_ONLY = "--colors" in sys.argv or "--knob" in sys.argv
for name, fn, col, glb, view in ([] if COLORS_ONLY else items):
    if glb:
        kb = write_glb(fn(1) if fn in (gear, stand, organizer) else fn(12), f"{OUT}/assets/models/{name}.glb", col) / 1024
        print(f"GLB {name}: {kb:.0f} KB")
    if GLB_ONLY: continue
    hi = fn(30) if fn in (gear, organizer) else (fn(1) if fn is stand else fn(70))
    render(hi, f"{OUT}/assets/img/prodotti/{name}.webp", col, **view)
    render(hi, f"{OUT}/assets/img/prodotti/{name}-dettaglio.webp", col, **{**view, "yaw": view["yaw"] + 140, "pitch": view["pitch"] + 6})
    print("render", name)

if GLB_ONLY: sys.exit(0)
if not COLORS_ONLY:
  pass
# hero: inquadrature ravvicinate
if not COLORS_ONLY: render(gear(40), f"{OUT}/assets/img/hero/hero-ingranaggio.webp", GRAPHITE, size=1400, yaw=24, pitch=42, dist=2.1, fill_frac=0.86)
if not COLORS_ONLY: render(vase(100), f"{OUT}/assets/img/hero/hero-vaso.webp", ARANCIO, size=1400, yaw=40, pitch=14, dist=2.2, fill_frac=0.86)
if not COLORS_ONLY: render(knob(90), f"{OUT}/assets/img/hero/hero-manopola.webp", TITANIO, size=1400, yaw=10, pitch=34, dist=2.0, fill_frac=0.82)
if not COLORS_ONLY: print("hero ok")

# ---------------------------------------------------------------- render per colore
# Uso: python3 tools/gen_assets.py <cartella_sito> --colors
# Crea <id>-<colore>.webp e <id>-<colore>-dettaglio.webp (+ versioni -600) per ogni colore.
def hex_lin(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
COLORI = {"nero-opaco": "#3A3C41", "grigio-titanio": "#8B9097", "arancione": "#FF5A1F", "bianco": "#E4E2DC"}
PER_PRODOTTO = {
    "ingranaggio-ricambio": ["nero-opaco", "grigio-titanio", "bianco"],
    "manopola-ricambio": ["nero-opaco", "grigio-titanio", "arancione", "bianco"],
    "vaso-geometrico": ["nero-opaco", "grigio-titanio", "arancione", "bianco"],
    "supporto-smartphone": ["nero-opaco", "grigio-titanio", "arancione", "bianco"],
    "organizer-scrivania": ["nero-opaco", "grigio-titanio", "arancione", "bianco"],
}
# --solo=<colore> genera solo quel colore (es. --solo=bianco)
SOLO = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--solo=")), None)
def colori_di(name): return [c for c in PER_PRODOTTO.get(name, []) if not SOLO or c == SOLO]
def salva_miniature(path):
    im = Image.open(path)
    im.resize((600, 600), Image.LANCZOS).save(path.replace(".webp", "-600.webp"), "WEBP", quality=82, method=6)
    im.resize((300, 300), Image.LANCZOS).save(path.replace(".webp", "-300.webp"), "WEBP", quality=80, method=6)
if "--colors" in sys.argv and "--knob" not in sys.argv:
    for name, fn, col, glb, view in items:
        hi = fn(30) if fn in (gear, organizer) else (fn(1) if fn is stand else fn(70))
        for slug in colori_di(name):
            c = hex_lin(COLORI[slug])
            for suffix, v in (("", view), ("-dettaglio", {**view, "yaw": view["yaw"] + 140, "pitch": view["pitch"] + 6})):
                path = f"{OUT}/assets/img/prodotti/{name}-{slug}{suffix}.webp"
                render(hi, path, c, **v)
                salva_miniature(path)
            print("colore", name, slug, flush=True)

# ---------------------------------------------------------------- manopola: varianti di attacco
# Uso: python3 tools/gen_assets.py <cartella_sito> --knob
# Crea un GLB per attacco e i render <id>-<colore>-<attacco>.webp / -sotto.webp
def knob_attacco(kind, nz=40, nt=192):
    def r(t, z):
        base = 16 - 2.5 * (z / 22) ** 2
        knurl = 0.9 * abs(math.sin(12 * t)) if z < 17 else 0
        top = 0 if z < 19 else -(z - 19) * 1.6
        return base + knurl + top
    if kind == "su-misura":  # pieno: il foro si realizza sulle misure del cliente
        return radial_solid(r, 0, 22, nt=nt, nz=nz)
    m = radial_solid(r, 0, 22, nt=nt, nz=nz, cap_bottom=False)
    R, flat, depth = 3.0, 1.5, 13.0
    def b(t):
        if kind == "albero-a-d":
            c = math.cos(t)
            return min(R, flat / c) if c > 1e-6 else R
        return R
    th = np.linspace(0, 2 * math.pi, nt, endpoint=False)
    O = [(r(t, 0) * math.cos(t), 0, r(t, 0) * math.sin(t)) for t in th]
    I0 = [(b(t) * math.cos(t), 0, b(t) * math.sin(t)) for t in th]
    I1 = [(b(t) * math.cos(t), depth, b(t) * math.sin(t)) for t in th]
    for i in range(nt):
        j = (i + 1) % nt
        m.quad(O[i], I0[i], I0[j], O[j])          # corona inferiore
        m.quad(I0[j], I0[i], I1[i], I1[j])        # pareti del foro
        m.tri((0, depth, 0), I1[j], I1[i])        # fondo del foro
    return m

ATTACCHI = ["albero-a-d", "albero-tondo", "su-misura"]
if "--knob" in sys.argv:
    for a in ([] if SOLO else ATTACCHI):
        kb = write_glb(knob_attacco(a, nz=12), f"{OUT}/assets/models/manopola-ricambio-{a}.glb", TITANIO) / 1024
        print("GLB", a, f"{kb:.0f} KB", flush=True)
    for a in ATTACCHI:
        hi = knob_attacco(a, nz=70)
        for slug in colori_di("manopola-ricambio"):
            c = hex_lin(COLORI[slug])
            for suffix, v, sh in (("", dict(yaw=20, pitch=30), True), ("-sotto", dict(yaw=20, pitch=-58, dist=2.3), False)):
                path = f"{OUT}/assets/img/prodotti/manopola-ricambio-{slug}-{a}{suffix}.webp"
                render(hi, path, c, shadow=sh, **v)
                salva_miniature(path)
            print("render", a, slug, flush=True)
