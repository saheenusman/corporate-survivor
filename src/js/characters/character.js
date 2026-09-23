// Procedural stylised humans.
//
// Each character is ONE SkinnedMesh (one draw call) built from shaped parts that are
// rigidly bound to a small skeleton: body, limbs, face rig (brows, eyelids via eye
// scale, two-piece mouth for smiles/frowns) and clothing/accessories. Vertex colours
// keep everything on a single shared material, which matters a lot on phones.
import * as THREE from 'three';
import { Animator } from './animator.js';
import { mulberry } from '../core/util.js';

const BONE_DEFS = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.95, 0]],
  ['spine', 'hips', [0, 0.08, 0]],
  ['chest', 'spine', [0, 0.2, 0]],
  ['neck', 'chest', [0, 0.25, 0]],
  ['head', 'neck', [0, 0.07, 0]],
  ['armL', 'chest', [0.19, 0.2, 0]],
  ['foreL', 'armL', [0, -0.28, 0]],
  ['handL', 'foreL', [0, -0.25, 0]],
  ['armR', 'chest', [-0.19, 0.2, 0]],
  ['foreR', 'armR', [0, -0.28, 0]],
  ['handR', 'foreR', [0, -0.25, 0]],
  ['thighL', 'hips', [0.09, -0.03, 0]],
  ['shinL', 'thighL', [0, -0.44, 0]],
  ['footL', 'shinL', [0, -0.42, 0]],
  ['thighR', 'hips', [-0.09, -0.03, 0]],
  ['shinR', 'thighR', [0, -0.44, 0]],
  ['footR', 'shinR', [0, -0.42, 0]],
  ['browL', 'head', [0.05, 0.2, 0.121]],
  ['browR', 'head', [-0.05, 0.2, 0.121]],
  ['eyeL', 'head', [0.05, 0.152, 0.126]],
  ['eyeR', 'head', [-0.05, 0.152, 0.126]],
  ['mouthL', 'head', [0, 0.074, 0.138]],
  ['mouthR', 'head', [0, 0.074, 0.138]],
];

// Shared unit geometries (scaled per part via matrices).
const U = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLo: new THREE.SphereGeometry(1, 9, 7),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
};
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

class Parts {
  constructor(bones) {
    this.bones = bones;
    this.index = new Map(bones.map((b, i) => [b.name, i]));
    this.byName = Object.fromEntries(bones.map((b) => [b.name, b]));
    this.list = [];
  }
  // opts: p (pos), r (euler), s (scale), q (quaternion)
  add(geo, bone, color, o = {}) {
    const p = o.p || [0, 0, 0], s = o.s || [1, 1, 1];
    const q = o.q || tmpQ.setFromEuler(tmpE.set(...(o.r || [0, 0, 0]))).clone();
    const local = new THREE.Matrix4().compose(V(...p), q, V(...s));
    this.list.push({ geo, bone, color: new THREE.Color(color), local });
  }
  ell(bone, color, p, s, r) { this.add(U.sphere, bone, color, { p, s, r }); }
  ellLo(bone, color, p, s, r) { this.add(U.sphereLo, bone, color, { p, s, r }); }
  box(bone, color, p, s, r) { this.add(U.box, bone, color, { p, s, r }); }
  // tapered cylinder along -Y from bone origin
  limb(bone, color, rTop, rBot, len, y0 = 0, sx = 1, sz = 1) {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 10);
    this.add(g, bone, color, { p: [0, y0 - len / 2, 0], s: [sx, 1, sz] });
  }
  // box stretched between two points (for straps, lanyards)
  seg(bone, color, a, b, w, t) {
    const A = V(...a), B = V(...b);
    const d = B.clone().sub(A); const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
    const mid = A.add(B).multiplyScalar(0.5);
    this.add(U.box, bone, color, { p: [mid.x, mid.y, mid.z], q, s: [w, len + t * 0.5, t] });
  }
  chain(bone, color, pts, w, t) { for (let i = 0; i < pts.length - 1; i++) this.seg(bone, color, pts[i], pts[i + 1], w, t); }

  build() {
    let vc = 0, ic = 0;
    for (const p of this.list) { vc += p.geo.attributes.position.count; ic += p.geo.index.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3);
    const si = new Uint16Array(vc * 4), sw = new Float32Array(vc * 4);
    const idx = vc > 65000 ? new Uint32Array(ic) : new Uint16Array(ic);
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    for (const p of this.list) {
      const bone = this.byName[p.bone];
      const bi = this.index.get(p.bone);
      const world = new THREE.Matrix4().multiplyMatrices(bone.matrixWorld, p.local);
      nm.getNormalMatrix(world);
      const P = p.geo.attributes.position, N = p.geo.attributes.normal, I = p.geo.index;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(world);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        const k = (vo + i) * 3;
        pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
        nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
        col[k] = p.color.r; col[k + 1] = p.color.g; col[k + 2] = p.color.b;
        si[(vo + i) * 4] = bi; sw[(vo + i) * 4] = 1;
      }
      for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo;
      vo += P.count; io += I.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
}

function lathe(pts, segs = 14) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return c;
}

// ------------------------------------------------------------------ body builder
function buildBody(P, L) {
  const w = L.build || 1;
  const has = (a) => (L.acc || []).includes(a);
  const top = L.top || L.shirt;
  const skin = L.skin, hair = L.hair;
  const belly = L.belly || 0;

  // pelvis + belt
  P.add(lathe([[0.157, 0.03], [0.162, -0.03], [0.152, -0.09], [0.118, -0.135], [0.06, -0.158], [0.01, -0.162]]), 'hips', L.pants, { s: [w, 1, 0.78 + belly * 0.05] });
  if (!L.untucked) P.add(U.cyl, 'hips', L.belt || '#2a2522', { p: [0, 0.015, 0], s: [0.163 * w, 0.034, 0.126 + belly * 0.03] });

  // torso: lower (spine) + upper (chest). Lathe profiles give a real silhouette.
  const lowPts = L.untucked
    ? [[0.178, -0.17], [0.17, -0.1], [0.16 + belly * 0.05, 0.02], [0.154 + belly * 0.04, 0.1], [0.16, 0.21]]
    : [[0.15, -0.1], [0.157 + belly * 0.05, -0.02], [0.154 + belly * 0.05, 0.08], [0.16, 0.21]];
  P.add(lathe(lowPts), 'spine', top, { s: [w, 1, (L.untucked ? 0.8 : 0.72) + belly * 0.2] });
  if (L.untucked) P.add(new THREE.CircleGeometry(1, 14), 'spine', shade(top, 0.8), { p: [0, -0.169, 0], r: [Math.PI / 2, 0, 0], s: [0.177 * w, 0.142, 1] });
  P.add(lathe([[0.16, -0.02], [0.172, 0.08], [0.18, 0.16], [0.165, 0.21], [0.12, 0.25], [0.06, 0.28], [0.03, 0.29]]), 'chest', top, { s: [w, 1, 0.72] });

  // neck
  P.limb('neck', skin, 0.047, 0.052, 0.13, 0.1);

  // collar / neckline
  if (L.collar !== false && !has('blazer')) {
    const cc = shade(top, 1.08);
    P.box('chest', cc, [0.045, 0.262, 0.075], [0.075, 0.034, 0.012], [-0.5, 0.35, 0.55]);
    P.box('chest', cc, [-0.045, 0.262, 0.075], [0.075, 0.034, 0.012], [-0.5, -0.35, -0.55]);
    P.box('chest', cc, [0, 0.27, -0.055], [0.12, 0.04, 0.014], [0.35, 0, 0]);
  }
  if (has('blazer')) {
    P.box('chest', L.inner || '#f3f1ec', [0, 0.16, 0.121], [0.075, 0.17, 0.012], [-0.18, 0, 0]);
    const lap = shade(top, 0.8);
    P.seg('chest', lap, [0.055, 0.25, 0.09], [0.012, 0.06, 0.132], 0.032, 0.012);
    P.seg('chest', lap, [-0.055, 0.25, 0.09], [-0.012, 0.06, 0.132], 0.032, 0.012);
    P.ellLo('chest', '#d8c9a3', [0, 0.03, 0.128], [0.008, 0.008, 0.006]);
  }
  if (has('tie')) {
    P.box('chest', L.tieColor || '#b7332e', [0, 0.232, 0.103], [0.036, 0.032, 0.02]);
    P.box('chest', L.tieColor || '#b7332e', [0, 0.1, 0.13], [0.042, 0.24, 0.008], [-0.1, 0, 0]);
    P.box('chest', shade(L.tieColor || '#b7332e', 0.7), [0, 0.1, 0.1352], [0.043, 0.02, 0.004], [-0.1, 0, 0.5]);
  }

  // arms
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    const sleeve = L.sleeveColor || top;
    P.ell('arm' + S, sleeve, [0, -0.012, 0], [0.057 * w, 0.058, 0.058]);
    if (L.sleeve === 'short') {
      P.limb('arm' + S, sleeve, 0.06, 0.056, 0.14, 0.0);
      P.limb('arm' + S, skin, 0.049, 0.045, 0.16, -0.12);
    } else {
      P.limb('arm' + S, sleeve, 0.056, 0.048, 0.29, 0.0);
    }
    if (L.sleeve === 'rolled') P.limb('arm' + S, shade(sleeve, 0.93), 0.056, 0.056, 0.055, -0.225);
    const foreC = L.sleeve === 'long' ? sleeve : skin;
    P.ell('fore' + S, foreC, [0, 0, 0], [0.047, 0.047, 0.047]);
    P.limb('fore' + S, foreC, 0.046, 0.038, 0.25, 0.0);
    if (L.sleeve === 'long') P.limb('fore' + S, L.cuff || shade(sleeve, 1.1), 0.042, 0.042, 0.035, -0.215);
    // hand: thin in X (palm faces the body), thumb forward
    P.ell('hand' + S, skin, [0, -0.052, 0.004], [0.024, 0.062, 0.043]);
    P.ellLo('hand' + S, skin, [s * 0.006, -0.03, 0.038], [0.014, 0.03, 0.014], [0.4, 0, 0]);
  }

  // legs + shoes
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    P.ell('thigh' + S, L.pants, [0, -0.02, 0], [0.083 * w, 0.08, 0.08]);
    P.limb('thigh' + S, L.pants, 0.082 * w, 0.06, 0.45, 0.0);
    P.ell('shin' + S, L.pants, [0, 0, 0], [0.059, 0.059, 0.059]);
    P.limb('shin' + S, L.pants, 0.058, 0.05, 0.41, 0.0);
    const sh = L.shoes, so = L.sole || shade(sh, 0.85);
    P.limb('foot' + S, sh, 0.05, 0.054, 0.05, 0.03);
    P.box('foot' + S, sh, [0, -0.024, 0.035], [0.098, 0.074, 0.2]);
    P.ell('foot' + S, sh, [0, -0.034, 0.128], [0.049, 0.036, 0.058]);
    P.box('foot' + S, so, [0, -0.057, 0.04], [0.108, 0.024, 0.262]);
    if (L.sneakers) {
      P.box('foot' + S, '#f7f5f0', [0, 0.017, 0.078], [0.052, 0.01, 0.1], [0.25, 0, 0]);
      P.box('foot' + S, L.shoeAccent || '#2f6fe4', [s * 0.05, -0.02, 0.03], [0.006, 0.03, 0.09]);
    }
  }

  // head
  const skinD = shade(skin, 0.86);
  P.ell('head', skin, [0, 0.13, 0], [0.135, 0.152, 0.142]);
  P.ell('head', L.jaw || skin, [0, 0.06, 0.035], [0.1, 0.08, 0.1]);
  P.ellLo('head', skinD, [0.134, 0.125, 0], [0.02, 0.036, 0.03]);
  P.ellLo('head', skinD, [-0.134, 0.125, 0], [0.02, 0.036, 0.03]);
  P.ellLo('head', shade(skin, 0.95), [0, 0.112, 0.14], [0.02, 0.03, 0.024]);
  // eyes (scaled for blinking via bone)
  for (const S of ['L', 'R']) {
    P.ell('eye' + S, '#1c1411', [0, 0, 0], [0.017, 0.024, 0.01]);
    P.ellLo('eye' + S, '#ffffff', [0.005, 0.008, 0.008], [0.005, 0.005, 0.004]);
    P.box('brow' + S, L.browColor || hair, [0, 0, 0], [0.052, 0.013, 0.012]);
  }
  if (has('eyebags')) {
    P.ellLo('head', skinD, [0.05, 0.126, 0.126], [0.021, 0.007, 0.006]);
    P.ellLo('head', skinD, [-0.05, 0.126, 0.126], [0.021, 0.007, 0.006]);
  }
  const lip = L.lip || '#5a2a22';
  P.box('mouthL', lip, [0.0145, 0, 0], [0.029, 0.008, 0.008]);
  P.box('mouthR', lip, [-0.0145, 0, 0], [0.029, 0.008, 0.008]);

  buildHair(P, L);

  if (has('glasses')) {
    const gc = L.glassesColor || '#2a2626';
    for (const s of [1, -1]) {
      P.add(new THREE.TorusGeometry(1, 0.17, 5, 14), 'head', gc, { p: [s * 0.05, 0.152, 0.143], s: [0.03, 0.026, 0.03] });
      P.seg('head', gc, [s * 0.08, 0.156, 0.138], [s * 0.136, 0.15, 0.02], 0.006, 0.006);
    }
    P.box('head', gc, [0, 0.158, 0.147], [0.03, 0.006, 0.006]);
  }
  if (has('mustache')) P.box('head', L.mustache || hair, [0, 0.094, 0.14], [0.072, 0.017, 0.02], [0, 0, 0]);
  if (has('headphones')) {
    P.add(new THREE.TorusGeometry(1, 0.12, 6, 18), 'chest', '#1f2023', { p: [0, 0.272, 0.0], r: [Math.PI / 2, 0, 0], s: [0.105, 0.105, 0.105] });
    for (const s of [1, -1]) P.add(U.cyl, 'chest', '#d4483b', { p: [s * 0.08, 0.262, 0.065], r: [Math.PI / 2 - 0.3, 0, s * 0.35], s: [0.038, 0.032, 0.038] });
  }
  if (has('id')) {
    const blue = '#2f6fe4';
    for (const s of [1, -1]) P.chain('chest', blue, [[s * 0.052, 0.272, 0.058], [s * 0.036, 0.19, 0.131], [s * 0.012, 0.075, 0.14]], 0.012, 0.004);
    P.box('chest', '#f7f7f4', [0, 0.034, 0.143], [0.056, 0.078, 0.006]);
    P.box('chest', blue, [0, 0.064, 0.1465], [0.056, 0.018, 0.002]);
    P.box('chest', shade(skin, 1.05), [-0.013, 0.033, 0.1465], [0.019, 0.023, 0.002]);
    P.box('chest', '#9aa2ad', [0.012, 0.038, 0.1465], [0.02, 0.004, 0.002]);
    P.box('chest', '#9aa2ad', [0.012, 0.028, 0.1465], [0.016, 0.004, 0.002]);
  }
  if (has('backpack')) {
    const bc = L.bag || '#3b4250', ac = L.bagAccent || '#e0a83a';
    P.box('chest', bc, [0, 0.06, -0.19], [0.27, 0.34, 0.13]);
    P.ellLo('chest', bc, [0, 0.23, -0.19], [0.135, 0.03, 0.065]);
    P.box('chest', shade(bc, 0.85), [0, -0.03, -0.262], [0.2, 0.14, 0.04]);
    P.box('chest', ac, [0, 0.13, -0.19], [0.275, 0.028, 0.134]);
    P.box('chest', ac, [0.07, -0.03, -0.284], [0.03, 0.05, 0.006]);
    for (const s of [1, -1]) P.chain('chest', shade(bc, 0.8), [[s * 0.085, 0.215, -0.12], [s * 0.095, 0.272, -0.02], [s * 0.095, 0.2, 0.112], [s * 0.1, 0.0, 0.1]], 0.03, 0.012);
  }
}

function buildHair(P, L) {
  const hc = L.hair, style = L.hairStyle || 'short';
  const cap = (tilt = -0.8, cover = 0.56) =>
    P.add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, cover * Math.PI), 'head', hc, { p: [0, 0.13, -0.003], r: [tilt, 0, 0], s: [0.145, 0.163, 0.153] });
  const rng = mulberry(L.seed || 7);
  if (style === 'messy') {
    cap();
    for (let i = 0; i < 9; i++) {
      const az = (i / 9) * Math.PI * 2 + rng() * 0.5;
      const el = 0.55 + rng() * 0.7;
      const x = Math.sin(az) * Math.cos(el) * 0.14, z = Math.cos(az) * Math.cos(el) * 0.145, y = 0.13 + Math.sin(el) * 0.158;
      P.ell('head', hc, [x, y, z - 0.01], [0.055, 0.028, 0.07], [rng() - 0.5 + 0.3, az, (rng() - 0.5) * 1.2]);
    }
    P.ell('head', hc, [0.03, 0.262, 0.105], [0.07, 0.028, 0.05], [0.7, 0.3, -0.4]);
    P.ell('head', hc, [-0.045, 0.255, 0.1], [0.06, 0.026, 0.05], [0.8, -0.4, 0.3]);
  } else if (style === 'side') {
    cap(-0.75);
    P.ell('head', hc, [0.025, 0.268, 0.075], [0.115, 0.042, 0.075], [0.35, 0, -0.3]);
    P.ell('head', hc, [0.0, 0.24, -0.1], [0.12, 0.05, 0.06]);
  } else if (style === 'bun') {
    cap(-0.72);
    P.ell('head', hc, [0, 0.27, -0.11], [0.066, 0.06, 0.06]);
    P.add(U.cyl, 'head', L.hairTie || '#c04a5a', { p: [0, 0.24, -0.095], r: [0.9, 0, 0], s: [0.04, 0.02, 0.04] });
  } else if (style === 'long') {
    cap(-0.72);
    P.ell('head', hc, [0, 0.04, -0.1], [0.14, 0.2, 0.07]);
    P.ell('head', hc, [0.123, 0.07, -0.01], [0.032, 0.14, 0.065]);
    P.ell('head', hc, [-0.123, 0.07, -0.01], [0.032, 0.14, 0.065]);
    P.ell('head', hc, [0.0, 0.265, 0.095], [0.1, 0.03, 0.05], [0.6, 0, 0.25]);
  } else if (style === 'ponytail') {
    cap(-0.72);
    P.ell('head', hc, [0, 0.08, -0.175], [0.042, 0.14, 0.042], [0.35, 0, 0]);
    P.add(U.cyl, 'head', L.hairTie || '#2f6fe4', { p: [0, 0.195, -0.155], r: [0.9, 0, 0], s: [0.035, 0.018, 0.035] });
  } else if (style === 'balding') {
    P.add(new THREE.SphereGeometry(1, 16, 5, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0.34 * Math.PI, 0.34 * Math.PI), 'head', hc, { p: [0, 0.13, 0], s: [0.147, 0.163, 0.152] });
  } else {
    cap(-0.78, 0.58);
    P.ell('head', hc, [0, 0.262, 0.09], [0.1, 0.032, 0.055], [0.5, 0, 0]);
  }
}

// ------------------------------------------------------------------ props
function propMesh(material, build) {
  const parts = [];
  const add = (g, color, p, s = [1, 1, 1], r = [0, 0, 0]) => parts.push({ g, color: new THREE.Color(color), m: new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s)) });
  build(add);
  const geos = parts.map(({ g, color, m }) => {
    const c = g.clone(); c.applyMatrix4(m);
    const n = c.attributes.position.count; const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    c.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return c.index ? c.toNonIndexed() : c;
  });
  let count = 0; geos.forEach((g) => (count += g.attributes.position.count));
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.visible = false;
  return mesh;
}

const PROP_BUILDERS = {
  cup: (a) => {
    a(new THREE.CylinderGeometry(0.036, 0.028, 0.1, 10), '#f6f3ee', [0, 0, 0]);
    a(new THREE.CylinderGeometry(0.0365, 0.033, 0.04, 10), '#9b6a45', [0, 0.005, 0]);
    a(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 10), '#e9e4dc', [0, 0.056, 0]);
  },
  mug: (a) => {
    a(new THREE.CylinderGeometry(0.04, 0.038, 0.09, 10), '#f2f2ee', [0, 0, 0]);
    a(new THREE.TorusGeometry(0.024, 0.007, 5, 10), '#f2f2ee', [0.045, 0, 0]);
    a(new THREE.CylinderGeometry(0.041, 0.041, 0.03, 10), '#c0392b', [0, 0.01, 0]);
  },
  phone: (a) => {
    a(new THREE.BoxGeometry(0.048, 0.095, 0.008), '#22252b', [0, 0, 0]);
    a(new THREE.BoxGeometry(0.042, 0.085, 0.002), '#7fb2ff', [0, 0, 0.005]);
  },
  clipboard: (a) => {
    a(new THREE.BoxGeometry(0.2, 0.28, 0.01), '#8a6443', [0, 0, 0]);
    a(new THREE.BoxGeometry(0.17, 0.23, 0.004), '#f7f6f2', [0, -0.015, 0.007]);
    a(new THREE.BoxGeometry(0.07, 0.03, 0.02), '#9aa0a8', [0, 0.13, 0.008]);
  },
};

// Where each prop sits in the hand and whether it should stay upright in world space.
const PROP_MOUNT = {
  cup: { bone: 'handR', p: [0.0, -0.075, 0.05], upright: true },
  mug: { bone: 'handR', p: [0.0, -0.075, 0.05], upright: true },
  phone: { bone: 'handR', p: [0.012, -0.07, 0.045], r: [-0.3, -0.25, 0] },
  clipboard: { bone: 'handL', p: [0.02, -0.1, 0.08], r: [0.2, 0.1, 0] },
};

// ------------------------------------------------------------------ blob shadow
let blobTex = null;
function getBlobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(20,18,30,0.55)'); grd.addColorStop(0.55, 'rgba(20,18,30,0.25)'); grd.addColorStop(1, 'rgba(20,18,30,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// ------------------------------------------------------------------ Character
export class Character {
  constructor(look, shared) {
    this.look = look;
    this.id = look.id;
    const bones = BONE_DEFS.map(([name, , p]) => { const b = new THREE.Bone(); b.name = name; b.position.set(...p); return b; });
    const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
    BONE_DEFS.forEach(([name, parent]) => { if (parent) byName[parent].add(byName[name]); });
    const root = byName.root;
    root.updateMatrixWorld(true);

    const parts = new Parts(bones);
    buildBody(parts, look);
    const geo = parts.build();
    const mesh = new THREE.SkinnedMesh(geo, shared.skinMat);
    mesh.add(root);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.mesh = mesh;
    this.bones = byName;
    this.restHipsY = byName.hips.position.y;

    this.group = new THREE.Group();
    this.group.name = look.id;
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.inner.add(mesh);
    const sc = look.height || 1;
    this.inner.scale.set(sc * (look.build || 1) ** 0.3, sc, sc);

    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), shared.blobMat);
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1;
    this.group.add(blob);
    this.blob = blob;

    this.props = {};
    for (const [k, b] of Object.entries(PROP_BUILDERS)) {
      if (!(look.props || []).includes(k)) continue;
      const m = propMesh(shared.propMat, b);
      const mount = PROP_MOUNT[k];
      m.position.set(...mount.p);
      if (mount.r) m.rotation.set(...mount.r);
      byName[mount.bone].add(m);
      this.props[k] = m;
    }

    this.yaw = 0;
    this.anim = new Animator(this);
  }

  get position() { return this.group.position; }
  setYaw(y) { this.yaw = y; this.group.rotation.y = y; }
  showProp(name, on) { if (this.props[name]) this.props[name].visible = on; }
  hideAllProps() { for (const k in this.props) this.props[k].visible = false; }

  update(dt) {
    this.anim.update(dt);
    for (const [k, m] of Object.entries(this.props)) {
      if (!m.visible || !PROP_MOUNT[k].upright) continue;
      // Keep drinks upright regardless of arm pose.
      m.parent.updateWorldMatrix(true, false);
      const pq = new THREE.Quaternion(); m.parent.getWorldQuaternion(pq);
      const wanted = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0));
      m.quaternion.copy(pq.invert().multiply(wanted));
    }
  }
}

export function createSharedMaterials() {
  return {
    skinMat: new THREE.MeshLambertMaterial({ vertexColors: true }),
    propMat: new THREE.MeshLambertMaterial({ vertexColors: true }),
    blobMat: new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}
