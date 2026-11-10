/* =====================================================================
   Sumisura 3D — visualizzatore 3D integrato (WebGL, nessuna dipendenza)
   Supporta file .glb e .gltf (buffer incorporati o esterni), gerarchia dei
   nodi, colore base e texture del colore base dei materiali.
   Non supporta la compressione Draco/Meshopt: esporta i modelli senza
   compressione (vedi README).

   Uso: const v = S3DViewer.create(container, { src, onProgress, onLoad, onError })
        v.zoom(1.25) · v.reset() · v.setAutoRotate(true) · v.destroy()
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ matrici */
  const M4 = {
    ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
    },
    lookAt(e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
    },
    trs(t, r, s) {
      t = t || [0, 0, 0]; r = r || [0, 0, 0, 1]; s = s || [1, 1, 1];
      const [x, y, z, w] = r, x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
        (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
        (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
    },
    // matrice normale (inversa trasposta 3x3)
    normal(m) {
      const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
      const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
      const det = a * A + b * B + c * C || 1;
      return [A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
        (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
    }
  };

  /* ------------------------------------------------------------ quaternioni (rotazione libera a 360°) */
  const Q = {
    axis(ax, ang) { const h = ang / 2, s = Math.sin(h); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)]; },
    mul(a, b) {
      return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    },
    norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
      if (d > 0.9995) return Q.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
    },
    angle(a, b) { return 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))); }
  };

  /* ------------------------------------------------------------ lettura glTF */
  const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

  async function loadSource(src, onProgress) {
    // Dati incorporati (usati dall'anteprima online), altrimenti download con avanzamento
    const embedded = window.S3D_MODEL_DATA && window.S3D_MODEL_DATA[src];
    if (embedded) {
      const bin = atob(embedded), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      onProgress && onProgress(1);
      return u.buffer;
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error("Il file del modello non è stato trovato (" + res.status + ").");
    const total = Number(res.headers.get("Content-Length")) || 0;
    if (!res.body || !total) { const b = await res.arrayBuffer(); onProgress && onProgress(1); return b; }
    const reader = res.body.getReader(); const chunks = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length; onProgress && onProgress(Math.min(1, got / total));
    }
    const out = new Uint8Array(got); let o = 0;
    chunks.forEach((c) => { out.set(c, o); o += c.length; });
    return out.buffer;
  }

  async function parseGLTF(buffer, baseUrl) {
    const dv = new DataView(buffer);
    let json, bin = null;
    if (buffer.byteLength >= 12 && dv.getUint32(0, true) === 0x46546C67) {
      const len = dv.getUint32(8, true); let off = 12;
      while (off < len) {
        const cl = dv.getUint32(off, true), ct = dv.getUint32(off + 4, true);
        const data = buffer.slice(off + 8, off + 8 + cl);
        if (ct === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
        else if (ct === 0x004E4942) bin = data;
        off += 8 + cl;
      }
    } else {
      json = JSON.parse(new TextDecoder().decode(buffer));
    }
    if (!json) throw new Error("Il file non è un modello glTF valido.");
    if ((json.extensionsRequired || []).some((e) => /draco|meshopt/i.test(e))) {
      throw new Error("Il modello usa una compressione non supportata (Draco/Meshopt).");
    }
    const buffers = await Promise.all((json.buffers || []).map(async (b, i) => {
      if (!b.uri) return bin;
      if (b.uri.startsWith("data:")) { const s = atob(b.uri.split(",")[1]); const u = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); return u.buffer; }
      const r = await fetch(new URL(b.uri, baseUrl)); if (!r.ok) throw new Error("Manca un file del modello: " + b.uri); return r.arrayBuffer();
    }));
    return { json, buffers };
  }

  function readAccessor(g, idx) {
    const a = g.json.accessors[idx];
    const n = SIZE[a.type], Ctor = COMP[a.componentType];
    const out = new Float32Array(a.count * n);
    if (a.bufferView == null) return out;
    const bv = g.json.bufferViews[a.bufferView];
    const buf = g.buffers[bv.buffer];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const esz = Ctor.BYTES_PER_ELEMENT, stride = bv.byteStride || esz * n;
    const dv = new DataView(buf);
    const get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[a.componentType];
    const norm = a.normalized ? NORM[a.componentType] : 0;
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
      let v = dv[get](base + i * stride + k * esz, true);
      if (norm) v = Math.max(v / norm, -1);
      out[i * n + k] = v;
    }
    return out;
  }
  function readIndices(g, idx) {
    const a = g.json.accessors[idx], bv = g.json.bufferViews[a.bufferView];
    const Ctor = COMP[a.componentType];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const src = new Ctor(g.buffers[bv.buffer].slice(off, off + a.count * Ctor.BYTES_PER_ELEMENT));
    return Uint32Array.from(src);
  }

  /** Converte la scena in primitive pronte per la GPU (coordinate mondo) */
  function buildPrimitives(g) {
    const { json } = g; const prims = [];
    const scene = json.scenes ? json.scenes[json.scene || 0] : { nodes: (json.nodes || []).map((_, i) => i) };
    const visit = (ni, parent) => {
      const node = json.nodes[ni];
      const local = node.matrix ? node.matrix.slice() : M4.trs(node.translation, node.rotation, node.scale);
      const world = M4.mul(parent, local);
      if (node.mesh != null) {
        const nm = M4.normal(world);
        json.meshes[node.mesh].primitives.forEach((p) => {
          if (p.mode != null && p.mode !== 4) return; // solo triangoli
          if (p.attributes.POSITION == null) return;
          let pos = readAccessor(g, p.attributes.POSITION);
          let nor = p.attributes.NORMAL != null ? readAccessor(g, p.attributes.NORMAL) : null;
          let uv = p.attributes.TEXCOORD_0 != null ? readAccessor(g, p.attributes.TEXCOORD_0) : null;
          let idx = p.indices != null ? readIndices(g, p.indices) : null;
          if (!nor) { // normali piatte
            if (idx) {
              const P = new Float32Array(idx.length * 3), U = uv ? new Float32Array(idx.length * 2) : null;
              idx.forEach((v, i) => { P.set(pos.subarray(v * 3, v * 3 + 3), i * 3); if (U) U.set(uv.subarray(v * 2, v * 2 + 2), i * 2); });
              pos = P; uv = U; idx = null;
            }
            nor = new Float32Array(pos.length);
            for (let i = 0; i < pos.length; i += 9) {
              const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
              const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
              let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
              const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
              for (let k = 0; k < 3; k++) { nor[i + k * 3] = nx; nor[i + k * 3 + 1] = ny; nor[i + k * 3 + 2] = nz; }
            }
          }
          // trasforma in coordinate mondo
          for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i], y = pos[i + 1], z = pos[i + 2];
            pos[i] = world[0] * x + world[4] * y + world[8] * z + world[12];
            pos[i + 1] = world[1] * x + world[5] * y + world[9] * z + world[13];
            pos[i + 2] = world[2] * x + world[6] * y + world[10] * z + world[14];
            const a = nor[i], b = nor[i + 1], c = nor[i + 2];
            nor[i] = nm[0] * a + nm[1] * b + nm[2] * c;
            nor[i + 1] = nm[3] * a + nm[4] * b + nm[5] * c;
            nor[i + 2] = nm[6] * a + nm[7] * b + nm[8] * c;
          }
          const mat = p.material != null && json.materials ? json.materials[p.material] : {};
          const pbr = mat.pbrMetallicRoughness || {};
          prims.push({
            pos, nor, uv, idx,
            color: pbr.baseColorFactor || [0.8, 0.8, 0.8, 1],
            rough: pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.6,
            metal: pbr.metallicFactor != null ? pbr.metallicFactor : 0,
            texIndex: pbr.baseColorTexture ? pbr.baseColorTexture.index : null
          });
        });
      }
      (node.children || []).forEach((c) => visit(c, world));
    };
    (scene.nodes || []).forEach((n) => visit(n, M4.ident()));
    if (!prims.length) throw new Error("Il modello non contiene geometrie visualizzabili.");
    return prims;
  }

  async function loadImage(g, texIndex, baseUrl) {
    const tex = g.json.textures && g.json.textures[texIndex];
    if (!tex || tex.source == null) return null;
    const im = g.json.images[tex.source];
    let blob;
    if (im.bufferView != null) {
      const bv = g.json.bufferViews[im.bufferView];
      blob = new Blob([g.buffers[bv.buffer].slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)], { type: im.mimeType || "image/png" });
    } else if (im.uri) {
      const r = await fetch(im.uri.startsWith("data:") ? im.uri : new URL(im.uri, baseUrl)); blob = await r.blob();
    } else return null;
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    } catch (e) { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  /* ------------------------------------------------------------ shader */
  const VS = `
    attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;
    uniform mat4 uVP; uniform mat4 uModel; varying vec3 vNor; varying vec3 vPos; varying vec2 vUv;
    void main(){ vec4 w = uModel * vec4(aPos, 1.0); vNor = mat3(uModel) * aNor; vPos = w.xyz; vUv = aUv; gl_Position = uVP * w; }`;
  const FS = `
    precision mediump float;
    varying vec3 vNor; varying vec3 vPos; varying vec2 vUv;
    uniform vec3 uEye; uniform vec4 uColor; uniform float uRough; uniform float uMetal;
    uniform sampler2D uTex; uniform float uUseTex; uniform vec3 uKey; uniform vec3 uFill;
    void main(){
      vec3 N = normalize(vNor); vec3 V = normalize(uEye - vPos);
      if (dot(N, V) < 0.0) N = -N; // facce visibili da entrambi i lati
      vec4 base = uColor;
      if (uUseTex > 0.5) { vec4 t = texture2D(uTex, vUv); base *= vec4(pow(t.rgb, vec3(2.2)), t.a); }
      vec3 albedo = base.rgb * (1.0 - uMetal * 0.6);
      float hemi = 0.5 + 0.5 * N.y;
      vec3 amb = mix(vec3(0.10, 0.10, 0.10), vec3(0.42, 0.42, 0.44), hemi);
      float dk = max(dot(N, uKey), 0.0), df = max(dot(N, uFill), 0.0);
      float shin = mix(90.0, 6.0, uRough);
      vec3 H = normalize(uKey + V);
      float spec = pow(max(dot(N, H), 0.0), shin) * mix(0.55, 0.06, uRough);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.28;
      vec3 specCol = mix(vec3(1.0), base.rgb, uMetal);
      vec3 col = albedo * (amb + dk * 1.0 + df * 0.28) + specCol * spec + mix(vec3(rim), base.rgb * rim * 1.6, 0.6);
      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= 1.12 / (1.0 + L * 0.35); // compressione delle alte luci che conserva la tinta
      gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), base.a);
    }`;
  const VS_SH = `attribute vec2 aP; uniform mat4 uVP; uniform vec3 uC; uniform float uR; varying vec2 vP;
    void main(){ vP = aP; gl_Position = uVP * vec4(uC.x + aP.x * uR, uC.y, uC.z + aP.y * uR, 1.0); }`;
  const FS_SH = `precision mediump float; varying vec2 vP; uniform float uA;
    void main(){ float d = length(vP); gl_FragColor = vec4(0.08, 0.07, 0.06, uA * smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.25, d)); }`;

  function compile(gl, vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
    return { p, loc, attr: (name) => gl.getAttribLocation(p, name) };
  }

  /* ------------------------------------------------------------ viewer */
  function create(container, opts) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    canvas.className = "viewer-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", opts.label || "Modello 3D interattivo");
    canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline-offset:-3px";
    container.appendChild(canvas);

    const glOpts = { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false };
    const gl = canvas.getContext("webgl2", glOpts) || canvas.getContext("webgl", glOpts) || canvas.getContext("experimental-webgl", glOpts);
    const api = { src: opts.src, zoom() {}, reset() {}, setAutoRotate() {}, setColor() {}, isAutoRotating: () => false, destroy() { canvas.remove(); } };
    if (!gl) { setTimeout(() => opts.onError && opts.onError(new Error("Il browser non supporta la grafica 3D (WebGL).")), 0); return api; }
    const isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    const uintExt = isGL2 || gl.getExtension("OES_element_index_uint");

    let prog, shProg, meshes = [], center = [0, 0, 0], radius = 1, floorY = 0;
    // La camera resta fissa e leggermente rialzata; ruota il modello, in ogni direzione e senza limiti
    const ELEV = 0.42;
    // vista iniziale: 3/4 dall'alto, oppure da sotto (per mostrare fori e attacchi)
    const Q0 = opts.startBelow ? Q.norm(Q.mul(Q.axis([1, 0, 0], -1.3), Q.axis([0, 1, 0], -0.5))) : Q.axis([0, 1, 0], -Math.PI * 0.18);
    const view0 = { q: Q0, dist: 1 };
    const cam = { q: Q0.slice(), dist: 1 };
    let target = { q: Q0.slice(), dist: 1 };
    const corners = [];
    const hexToLin = (h) => {
      if (!h) return null;
      h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return [0, 2, 4].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    };
    let colorOverride = hexToLin(opts.color);
    let autoRotate = !reduce && opts.autoRotate !== false, lastInteract = 0, raf = 0, destroyed = false, ready = false;
    const fov = 0.6;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      requestRender();
    }
    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    ro ? ro.observe(canvas) : window.addEventListener("resize", resize);

    function draw() {
      raf = 0;
      if (destroyed || !ready) return;
      const now = performance.now();
      if (autoRotate && now - lastInteract > 2500) target.q = Q.norm(Q.mul(Q.axis([0, 1, 0], 0.0045), target.q));
      // smorzamento verso l'obiettivo
      const k = reduce ? 1 : 0.18;
      cam.q = Q.slerp(cam.q, target.q, k); cam.dist += (target.dist - cam.dist) * k;
      const moving = Q.angle(cam.q, target.q) + Math.abs(target.dist - cam.dist) / radius > 0.0005;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const eye = [center[0], center[1] + cam.dist * Math.sin(ELEV), center[2] + cam.dist * Math.cos(ELEV)];
      const R = M4.trs(null, cam.q, null);
      const model = M4.mul(M4.trs(center), M4.mul(R, M4.trs([-center[0], -center[1], -center[2]])));
      // ombra sotto il punto più basso del modello ruotato
      let low = Infinity;
      corners.forEach((c) => { const y = model[1] * c[0] + model[5] * c[1] + model[9] * c[2] + model[13]; if (y < low) low = y; });
      floorY = low;
      const proj = M4.persp(fov, canvas.width / canvas.height, radius * 0.02, cam.dist + radius * 10);
      const vp = M4.mul(proj, M4.lookAt(eye, center, [0, 1, 0]));
      // luci legate alla camera, così il modello resta leggibile da ogni lato
      const fx = 0, fz = 1;
      const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      const key = norm([fx * 0.6 - fz * 0.55, 0.85, fz * 0.6 + fx * 0.55]);
      const fill = norm([fx * 0.5 + fz * 0.7, 0.25, fz * 0.5 - fx * 0.7]);

      // ombra morbida sul piano
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(shProg.p);
      gl.uniformMatrix4fv(shProg.loc.uVP, false, vp);
      gl.uniform3f(shProg.loc.uC, center[0], floorY, center[2]); gl.uniform1f(shProg.loc.uR, radius * 1.15); gl.uniform1f(shProg.loc.uA, 0.42);
      gl.bindBuffer(gl.ARRAY_BUFFER, shProg.buf); const ap = shProg.attr("aP");
      gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(ap);

      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.loc.uVP, false, vp);
      gl.uniformMatrix4fv(prog.loc.uModel, false, model);
      gl.uniform3fv(prog.loc.uEye, eye); gl.uniform3fv(prog.loc.uKey, key); gl.uniform3fv(prog.loc.uFill, fill);
      const aPos = prog.attr("aPos"), aNor = prog.attr("aNor"), aUv = prog.attr("aUv");
      meshes.forEach((m) => {
        gl.uniform4fv(prog.loc.uColor, colorOverride ? [colorOverride[0], colorOverride[1], colorOverride[2], m.color[3]] : m.color); gl.uniform1f(prog.loc.uRough, m.rough); gl.uniform1f(prog.loc.uMetal, m.metal);
        gl.uniform1f(prog.loc.uUseTex, m.tex ? 1 : 0);
        if (m.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.uniform1i(prog.loc.uTex, 0); }
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0);
        if (aUv >= 0) { if (m.uv) { gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0); } else { gl.disableVertexAttribArray(aUv); gl.vertexAttrib2f(aUv, 0, 0); } }
        if (m.color[3] < 1) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
        if (m.idx) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.drawElements(gl.TRIANGLES, m.count, m.idxType, 0); }
        else gl.drawArrays(gl.TRIANGLES, 0, m.count);
      });
      if (moving || (autoRotate && !document.hidden)) requestRender();
    }
    function requestRender() { if (!raf && !destroyed) raf = requestAnimationFrame(draw); }

    /* -------- interazione: trascina, rotella, pizzico, tastiera */
    const pointers = new Map(); let pinch0 = 0, dist0 = 0;
    // trascinamento orizzontale: giro attorno all'asse verticale; verticale: ribalta in avanti/indietro
    const rotate = (dx, dy) => {
      const right = [1, 0, 0];
      target.q = Q.norm(Q.mul(Q.axis(right, dy), Q.mul(Q.axis([0, 1, 0], dx), target.q)));
    };
    const clampDist = (d) => Math.max(radius * 1.15, Math.min(view0.dist * 3, d));
    const touch = () => { lastInteract = performance.now(); requestRender(); };
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.style.cursor = "grabbing";
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = target.dist; }
      touch();
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      if (pointers.size === 1) {
        rotate((e.clientX - p.x) * 0.009, (e.clientY - p.y) * 0.009);
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 2 && pinch0) { const [a, b] = [...pointers.values()]; target.dist = clampDist(dist0 * pinch0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))); }
      touch();
    });
    const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; if (!pointers.size) canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); target.dist = clampDist(target.dist * Math.exp(e.deltaY * 0.0012)); touch(); }, { passive: false });
    canvas.addEventListener("dblclick", () => api.reset());
    canvas.addEventListener("keydown", (e) => {
      const step = 0.15; let used = true;
      if (e.key === "ArrowLeft") rotate(-step, 0); else if (e.key === "ArrowRight") rotate(step, 0);
      else if (e.key === "ArrowUp") rotate(0, -step); else if (e.key === "ArrowDown") rotate(0, step);
      else if (e.key === "+" || e.key === "=") target.dist = clampDist(target.dist * 0.85); else if (e.key === "-") target.dist = clampDist(target.dist * 1.18);
      else if (e.key === "0" || e.key === "Home") api.reset(); else used = false;
      if (used) { e.preventDefault(); touch(); }
    });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (destroyed) return; ready = false; opts.onError && opts.onError(new Error("La grafica 3D si è interrotta.")); });
    document.addEventListener("visibilitychange", requestRender);

    api.zoom = (f) => { target.dist = clampDist(target.dist / f); touch(); };
    api.reset = () => { target = { q: view0.q.slice(), dist: view0.dist }; touch(); };
    api.setAutoRotate = (on) => { autoRotate = !!on; lastInteract = 0; requestRender(); };
    api.isAutoRotating = () => autoRotate;
    /** Ricolora il modello (colore esadecimale), null = colori originali del file */
    api.setColor = (hex) => { colorOverride = hexToLin(hex); requestRender(); };
    api.destroy = () => { destroyed = true; cancelAnimationFrame(raf); ro && ro.disconnect(); document.removeEventListener("visibilitychange", requestRender); const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); canvas.remove(); };

    /* -------- caricamento */
    (async () => {
      try {
        prog = compile(gl, VS, FS);
        shProg = compile(gl, VS_SH, FS_SH);
        shProg.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, shProg.buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

        const baseUrl = new URL(opts.src, location.href);
        const buffer = await loadSource(opts.src, opts.onProgress);
        if (destroyed) return;
        const g = await parseGLTF(buffer, baseUrl);
        const prims = buildPrimitives(g);
        let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const p of prims) {
          for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.pos[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
          const mesh = { color: p.color, rough: p.rough, metal: p.metal };
          mesh.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos); gl.bufferData(gl.ARRAY_BUFFER, p.pos, gl.STATIC_DRAW);
          mesh.nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor); gl.bufferData(gl.ARRAY_BUFFER, p.nor, gl.STATIC_DRAW);
          if (p.uv) { mesh.uv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.bufferData(gl.ARRAY_BUFFER, p.uv, gl.STATIC_DRAW); }
          if (p.idx) {
            const big = p.idx.some((v) => v > 65535);
            if (big && !uintExt) throw new Error("Il modello è troppo grande per questo browser.");
            mesh.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? p.idx : Uint16Array.from(p.idx), gl.STATIC_DRAW);
            mesh.idxType = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; mesh.count = p.idx.length;
          } else mesh.count = p.pos.length / 3;
          if (p.texIndex != null && p.uv) {
            const img = await loadImage(g, p.texIndex, baseUrl);
            if (img) {
              const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
              const pot = (n) => (n & (n - 1)) === 0;
              if (isGL2 || (pot(img.width) && pot(img.height))) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
              else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
              mesh.tex = t;
            }
          }
          meshes.push(mesh);
        }
        center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
        radius = Math.max(1e-6, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
        floorY = min[1];
        for (let i = 0; i < 8; i++) corners.push([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
        view0.dist = radius / Math.sin(fov / 2) * (opts.startBelow ? 0.88 : 1.05);
        cam.dist = view0.dist * 1.25; target = { q: view0.q.slice(), dist: view0.dist }; // breve avvicinamento iniziale
        ready = true; resize(); requestRender();
        opts.onLoad && opts.onLoad();
      } catch (err) {
        if (!destroyed) opts.onError && opts.onError(err);
      }
    })();
    return api;
  }

  window.S3DViewer = { create };
})();
