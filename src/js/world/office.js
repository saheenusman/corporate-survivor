// The office. A compact 32 x 24 m floor with reception, open-plan pods, meeting room,
// manager office, coffee corner, printer nook, cafeteria, restroom, collaboration
// corner and a working elevator. Everything static is batched; only a few things
// animate (clock hands, LEDs, elevator doors, coffee steam, monitors).
import * as THREE from 'three';
import { Batch } from './batch.js';
import { carpetTexture, woodTexture, terrazzoTexture, tileTexture, skylineTexture, makeScreenTextures, buildSignAtlas } from '../render/textures.js';
import { mulberry, damp } from '../core/util.js';

const PI = Math.PI;
const C = {
  wall: '#ebe5da', base: '#c9bfb1', white: '#f4f2ee', frame: '#e9e7e2', ink: '#2e333b',
  deskTop: '#f1eee8', deskLeg: '#3a3f47', divider: '#8fa3a6', wood: '#c89b6d', darkWood: '#7a5236',
  teal: '#3e7c87', mustard: '#e0a83a', coral: '#e2735a', blue: '#2f6fe4', steel: '#b9bec4',
  leaf1: '#4f9a5a', leaf2: '#3d7e4c', leaf3: '#6fb36a', pot: '#e7e1d6', potDark: '#b8674d',
};

export function buildOffice({ quality }) {
  const root = new THREE.Group(); root.name = 'office';
  const S = new Batch();                       // lit, vertex coloured, receives baked AO
  const E = new Batch({ ao: false });          // unlit emissive bits (light panels, LEDs)
  const G = new Batch({ ao: false });          // glass
  const AL = new Batch({ ao: false, uv: true }); // lit atlas signs
  const AU = new Batch({ ao: false, uv: true }); // unlit atlas signs (EXIT etc.)
  const W = new Batch({ ao: false, uv: true });  // windows
  const screenTypes = ['code', 'sheet', 'mail', 'chat', 'deck', 'off', 'player', 'tv', 'vend'];
  const SC = Object.fromEntries(screenTypes.map((t) => [t, new Batch({ ao: false, uv: true })]));
  const colliders = [];
  const anchors = {};
  const rng = mulberry(2024);

  const atlas = buildSignAtlas();
  const R = atlas.rects;
  const col = (minX, maxX, minZ, maxZ, h = 3, cam) => colliders.push({ minX, maxX, minZ, maxZ, h, cam: cam ?? h >= 1.2, on: true });

  // ------------------------------------------------------------------ floors & ceiling
  const floorMats = [];
  const floor = (x0, x1, z0, z1, texture, y = 0, tile = 1) => {
    const t = texture.clone(); t.needsUpdate = true;
    t.repeat.set((x1 - x0) / tile, (z1 - z0) / tile);
    const m = new THREE.MeshLambertMaterial({ map: t });
    floorMats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    mesh.rotation.x = -PI / 2; mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    root.add(mesh);
  };
  const carpet = carpetTexture('#707d8c', 3);
  floor(-16, 16, -12, 12, carpet, 0, 1);
  floor(-16, -8, -12, -5, carpetTexture('#5d7478', 4), 0.003, 1);
  floor(9, 16, -12, -5, woodTexture([132, 92, 62], 6), 0.003, 2);
  floor(-16, -8, 4, 12, woodTexture([196, 152, 104], 5), 0.003, 2);
  floor(-8, 10, 7.4, 12, terrazzoTexture(), 0.003, 2);
  floor(10, 16, 5, 12, tileTexture(), 0.003, 1);
  floor(2.4, 9, -12, -9.6, tileTexture(), 0.004, 0.8);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), new THREE.MeshLambertMaterial({ color: '#8f8b84', emissive: '#a7a39b' }));
  ceil.rotation.x = PI / 2; ceil.position.set(0, 3.0, 0); ceil.matrixAutoUpdate = false; ceil.updateMatrix();
  root.add(ceil);
  for (let x = -14; x <= 14; x += 3.5) for (let z = -10; z <= 10.5; z += 3.5) {
    E.quad(x, 2.972, z, 1.2, 0.6, '#fffaf0', { rx: PI / 2 });
    S.cbox(x, 2.99, z, 1.28, 0.02, 0.68, '#d9d6d0');
  }

  // ------------------------------------------------------------------ walls
  const T = 0.2;
  const wall = (x1, z1, x2, z2, h = 3, color = C.wall, opts = {}) => {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const horiz = Math.abs(z2 - z1) < 1e-3;
    const w = horiz ? Math.abs(x2 - x1) : T, d = horiz ? T : Math.abs(z2 - z1);
    S.box(cx, 0, cz, w, h, d, color);
    if (!opts.noBase) S.box(cx, 0, cz, w + (horiz ? 0 : 0.03), 0.1, d + (horiz ? 0.03 : 0), C.base);
    col(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h, true);
  };
  const accent = (x1, z1, x2, z2, side, color, y0 = 0.1, y1 = 3) => {
    // paint on one face of a wall: side = +1/-1 normal direction
    const horiz = Math.abs(z2 - z1) < 1e-3;
    if (horiz) S.box((x1 + x2) / 2, y0, z1 + side * 0.105, Math.abs(x2 - x1), y1 - y0, 0.01, color);
    else S.box(x1 + side * 0.105, y0, (z1 + z2) / 2, 0.01, y1 - y0, Math.abs(z2 - z1), color);
  };
  const glass = (x1, z1, x2, z2) => {
    const horiz = Math.abs(z2 - z1) < 1e-3;
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const w = horiz ? len : 0.04, d = horiz ? 0.04 : len;
    G.box(cx, 0.05, cz, w, 2.9, d, '#cfe6ee');
    S.box(cx, 0, cz, horiz ? len : 0.08, 0.06, horiz ? 0.08 : len, '#7d858f');
    S.box(cx, 2.92, cz, horiz ? len : 0.08, 0.08, horiz ? 0.08 : len, '#7d858f');
    S.box(cx, 1.12, cz, horiz ? len : 0.05, 0.14, horiz ? 0.05 : len, '#eef2f4');
    const n = Math.max(1, Math.round(len / 1.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = horiz ? Math.min(x1, x2) + t * len : cx, z = horiz ? cz : Math.min(z1, z2) + t * len;
      S.box(x, 0, z, 0.06, 3, 0.07, '#7d858f');
    }
    col(cx - w / 2 - 0.03, cx + w / 2 + 0.03, cz - d / 2 - 0.03, cz + d / 2 + 0.03, 3, true);
  };
  const doorFrame = (x, z, width, horiz) => {
    const c = '#d9d3c8';
    if (horiz) { S.box(x - width / 2 - 0.04, 0, z, 0.08, 2.2, 0.26, c); S.box(x + width / 2 + 0.04, 0, z, 0.08, 2.2, 0.26, c); S.box(x, 2.2, z, width + 0.16, 0.8, 0.22, C.wall); S.box(x, 2.14, z, width + 0.16, 0.08, 0.26, c); }
    else { S.box(x, 0, z - width / 2 - 0.04, 0.26, 2.2, 0.08, c); S.box(x, 0, z + width / 2 + 0.04, 0.26, 2.2, 0.08, c); S.box(x, 2.2, z, 0.22, 0.8, width + 0.16, C.wall); S.box(x, 2.14, z, 0.26, 0.08, width + 0.16, c); }
  };

  // outer walls
  wall(-16, -12, 16, -12);
  wall(-16, 12, 0.5, 12);
  wall(2.5, 12, 16, 12);
  S.box(1.5, 2.35, 12, 2.0, 0.65, T, C.wall);
  wall(-16, -12, -16, 12);
  wall(16, -12, 16, 12);
  // meeting room
  wall(-8, -12, -8, -5);
  accent(-16, -12, -16, -5, 1, '#4f8a8b');
  glass(-16, -5, -12.8, -5); glass(-11.2, -5, -8, -5);
  // manager office
  wall(9, -12, 9, -5);
  accent(16, -12, 16, -5, -1, '#c9745a');
  glass(9, -5, 10, -5); glass(11.6, -5, 16, -5);
  // restroom
  wall(10, 5, 10, 12);
  wall(10, 5, 10.6, 5); wall(11.8, 5, 16, 5);
  doorFrame(11.2, 5, 1.2, true);
  S.box(10.66, 0, 5.62, 0.05, 2.1, 1.12, '#d6cfc3');
  // accents in cafeteria / lobby
  accent(-16, 4, -16, 12, 1, '#e3b04b', 0.1, 3);
  accent(-5, 12, 0.4, 12, -1, '#1d2433', 0.1, 3);
  // cafeteria planter divider
  S.box(-14.1, 0, 4, 3.8, 0.95, 0.45, '#d8cfbf'); col(-16, -12.2, 3.75, 4.25, 0.95);
  for (let x = -15.6; x <= -12.6; x += 0.5) S.sphere(x + rng() * 0.1, 1.05, 4, 0.22, 0.2 + rng() * 0.1, 0.2, rng() > 0.5 ? C.leaf1 : C.leaf2);

  // ------------------------------------------------------------------ windows
  const skyTex = skylineTexture();
  const windowMat = new THREE.MeshBasicMaterial({ map: skyTex, color: 0xffffff });
  const windowRun = (x1, z1, x2, z2, ry) => {
    const horiz = Math.abs(z2 - z1) < 1e-3;
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, y0 = 0.9, y1 = 2.62;
    const off = 0.112;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    const px = cx + (horiz ? 0 : nx * off), pz = cz + (horiz ? nz * off : 0);
    const u0 = rng() * 2;
    W.quad(px, (y0 + y1) / 2, pz, len, y1 - y0, '#ffffff', { ry, uv: { u0, u1: u0 + len / 3.2, v0: 0, v1: 1 } });
    const fx = (dx, dz, w, h, d, y) => S.box(px + dx, y, pz + dz, w, h, d, C.frame, { ry: 0 });
    // sill, head, transom
    if (horiz) { fx(0, nz * 0.06, len + 0.1, 0.06, 0.2, y0 - 0.06); fx(0, 0, len + 0.1, 0.07, 0.06, y1); fx(0, 0, len, 0.04, 0.05, 2.2); }
    else { fx(nx * 0.06, 0, 0.2, 0.06, len + 0.1, y0 - 0.06); fx(0, 0, 0.06, 0.07, len + 0.1, y1); fx(0, 0, 0.05, 0.04, len, 2.2); }
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (i / n) * len;
      if (horiz) fx(t, 0, 0.06, y1 - y0, 0.07, y0); else fx(0, t, 0.07, y1 - y0, 0.06, y0);
    }
    // roller blinds at slightly different heights
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + ((i + 0.5) / n) * len, bw = len / n - 0.08, bh = 0.18 + rng() * 0.5;
      if (horiz) S.box(px + t, y1 - bh, pz + nz * 0.02, bw, bh, 0.02, '#e8e4dc');
      else S.box(px + nx * 0.02, y1 - bh, pz + t, 0.02, bh, bw, '#e8e4dc');
    }
  };
  windowRun(-15.3, -12, -8.7, -12, 0);
  windowRun(-7.6, -12, 2.2, -12, 0);
  windowRun(9.8, -12, 15.3, -12, 0);
  windowRun(16, -3.8, 16, 3.8, -PI / 2);
  windowRun(-15.2, 12, -9.0, 12, PI);
  windowRun(-16, -3.5, -16, -0.8, PI / 2);

  // ------------------------------------------------------------------ helpers: furniture
  const screen = (type, x, y, z, w, h, ry) => SC[type].quad(x, y, z, w, h, '#ffffff', { ry });
  const atlasQuad = (key, x, y, z, w, ry, h, unlit = false) => {
    const r = R[key]; const hh = h || w / r.aspect;
    (unlit ? AU : AL).quad(x, y, z, w, hh, '#ffffff', { ry, uv: r });
  };
  const L = (sx, sz, yaw, lx, lz) => [sx + lx * Math.cos(yaw) + lz * Math.sin(yaw), sz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
  const chair = (x, z, yaw, fabric = '#3d4a5c') => {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2 + yaw; S.box(x + Math.sin(a) * 0.15, 0.03, z + Math.cos(a) * 0.15, 0.05, 0.035, 0.3, C.ink, { ry: a }); }
    S.cyl(x, 0.05, z, 0.028, 0.33, '#8a9099');
    S.box(x, 0.37, z, 0.5, 0.08, 0.48, fabric, { ry: yaw });
    const [bx, bz] = L(x, z, yaw, 0, -0.25);
    S.box(bx, 0.5, bz, 0.46, 0.55, 0.07, fabric, { ry: yaw, rx: -0.08 });
    S.box(bx, 0.44, bz, 0.08, 0.12, 0.05, C.ink, { ry: yaw });
  };
  const deskAt = (sx, sz, yaw, screenType, o = {}) => {
    const P = (lx, lz) => L(sx, sz, yaw, lx, lz);
    let [x, z] = P(0, 0.76);
    S.box(x, 0.715, z, 1.5, 0.035, 0.76, C.deskTop, { ry: yaw });
    S.box(x, 0.70, z, 1.5, 0.015, 0.76, C.wood, { ry: yaw });
    for (const lx of [-0.72, 0.72]) { const [a, b] = P(lx, 0.76); S.box(a, 0, b, 0.04, 0.7, 0.66, C.deskLeg, { ry: yaw }); }
    // monitor
    [x, z] = P(0, 1.0); S.box(x, 0.75, z, 0.22, 0.015, 0.16, C.ink, { ry: yaw });
    [x, z] = P(0, 1.02); S.box(x, 0.75, z, 0.04, 0.3, 0.03, C.ink, { ry: yaw });
    [x, z] = P(0, 0.99); S.box(x, 0.93, z, 0.64, 0.4, 0.028, '#1f232a', { ry: yaw });
    [x, z] = P(0, 0.974); screen(screenType, x, 1.13, z, 0.58, 0.34, yaw + PI);
    // keyboard, mouse
    [x, z] = P(0, 0.52); S.box(x, 0.735, z, 0.42, 0.018, 0.14, '#3a3f47', { ry: yaw }); S.box(x, 0.752, z, 0.39, 0.006, 0.11, '#c9cdd3', { ry: yaw });
    [x, z] = P(0.32, 0.54); S.sphere(x, 0.75, z, 0.03, 0.018, 0.05, '#d9dce0', { ry: yaw });
    // clutter
    if (rng() > 0.3) { [x, z] = P(-0.55, 0.62); S.cyl(x, 0.735, z, 0.04, 0.1, ['#e5484d', '#f4f2ee', '#2f6fe4', '#e0a83a'][(rng() * 4) | 0]); }
    if (rng() > 0.3) { [x, z] = P(0.52, 0.85); for (let i = 0; i < 3; i++) S.box(x, 0.735 + i * 0.006, z, 0.21, 0.005, 0.3, '#fbfbf8', { ry: yaw + (rng() - 0.5) * 0.4 }); }
    const extra = rng();
    if (extra > 0.75) { [x, z] = P(-0.62, 0.95); S.cyl(x, 0.735, z, 0.06, 0.1, C.pot); S.sphere(x, 0.88, z, 0.08, 0.08, 0.08, C.leaf3); }
    else if (extra > 0.5) { [x, z] = P(-0.4, 1.0); S.box(x, 0.735, z, 0.12, 0.15, 0.02, '#8a6443', { ry: yaw, rx: -0.2 }); }
    else if (extra > 0.3) { [x, z] = P(0.62, 1.0); for (let i = 0; i < 3; i++) S.box(x + i * 0.05, 0.735, z, 0.04, 0.26, 0.22, ['#2f6fe4', '#e0a83a', '#2bb39a'][i], { ry: yaw }); }
    if (o.sticky) { [x, z] = P(0.25, 0.97); atlasQuad(o.sticky, x, 1.25, z, 0.09, yaw + PI, 0.09); }
    chair(...P(0, o.chairOffset ?? 0.02), yaw, o.fabric);
  };
  const pod = (cx, cz, occupants = {}) => {
    S.box(cx, 0.735, cz, 3.04, 0.36, 0.04, C.divider);
    S.box(cx, 1.095, cz, 3.06, 0.02, 0.06, '#d9d4cc');
    const seats = [[-0.76, -1.15, 0], [0.76, -1.15, 0], [-0.76, 1.15, PI], [0.76, 1.15, PI]];
    for (const [dx, dz, yaw] of seats) {
      const key = `${dx > 0 ? 'E' : 'W'}${dz > 0 ? 'S' : 'N'}`;
      const occ = occupants[key] || {};
      const types = ['code', 'mail', 'off', 'sheet', 'off', 'chat'];
      deskAt(cx + dx, cz + dz, yaw, occ.screen || types[(rng() * types.length) | 0], occ);
    }
    col(cx - 1.52, cx + 1.52, cz - 0.78, cz + 0.78, 0.76);
  };
  const plant = (x, z, big = false, pot = C.pot) => {
    const s = big ? 1.4 : 1;
    S.cyl(x, 0, z, 0.2 * s, 0.42 * s, pot, { top: 1.15 });
    S.cyl(x, 0.4 * s, z, 0.2 * s, 0.03, '#5b4636');
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + rng();
      const r = 0.12 + rng() * 0.12 * s, y = 0.55 * s + rng() * 0.6 * s;
      S.sphere(x + Math.sin(a) * r, y, z + Math.cos(a) * r, 0.16 * s, 0.24 * s, 0.1 * s, [C.leaf1, C.leaf2, C.leaf3][i % 3], { ry: a, rx: 0.4 });
    }
    S.cone(x, 0.45 * s, z, 0.1 * s, 0.9 * s, C.leaf2);
    col(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s, 1.0);
  };
  const simpleChair = (x, z, yaw, color) => {
    S.box(x, 0.42, z, 0.44, 0.05, 0.42, color, { ry: yaw });
    const [bx, bz] = L(x, z, yaw, 0, -0.2); S.box(bx, 0.47, bz, 0.42, 0.42, 0.04, color, { ry: yaw });
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const [a, b] = L(x, z, yaw, lx, lz); S.cyl(a, 0, b, 0.018, 0.42, C.ink, { seg: 6 }); }
  };

  // ------------------------------------------------------------------ open plan
  pod(-3.6, -1.2, {
    ES: { screen: 'player', sticky: 'sticky_player', fabric: '#2f6fe4', chairOffset: -0.05 },
    WS: { screen: 'chat', sticky: 'sticky_rahul' },
    EN: { screen: 'sheet', sticky: 'sticky_anu' },
  });
  pod(3.6, -1.2, { WN: { screen: 'sheet' }, ES: { screen: 'deck' } });
  pod(-3.6, 3.8, { WN: { screen: 'code' } });
  pod(3.6, 3.8, { ES: { screen: 'mail' } });
  anchors.playerSeat = { x: -2.84, z: -0.05, yaw: PI };
  anchors.playerMonitor = { x: -2.84, z: -1.0, y: 1.1 };
  anchors.rahulMonitor = { x: -4.36, z: -1.0, y: 1.1 };
  anchors.anuMonitor = { x: -2.84, z: -1.4, y: 1.1 };
  plant(-6.8, -4.6); plant(6.9, -4.6, true); plant(-6.9, 7.0); plant(6.9, 7.0);
  plant(0, -0.4); plant(0, 3.8);

  // collaboration corner (east)
  S.box(15.45, 0, 0, 0.7, 0.42, 2.6, C.teal); S.box(15.72, 0.42, 0, 0.18, 0.5, 2.6, C.teal);
  S.box(15.45, 0.42, -1.25, 0.7, 0.2, 0.14, '#356c76'); S.box(15.45, 0.42, 1.25, 0.7, 0.2, 0.14, '#356c76');
  for (const z of [-0.65, 0.65]) S.box(15.4, 0.42, z, 0.62, 0.1, 1.2, '#4a8f9b');
  col(15.05, 16, -1.35, 1.35, 0.9);
  S.cyl(14.2, 0, 0, 0.45, 0.4, C.wood); col(13.8, 14.6, -0.4, 0.4, 0.4);
  S.sphere(12.6, 0.28, -1.9, 0.48, 0.32, 0.48, C.mustard); S.sphere(12.4, 0.28, 1.7, 0.48, 0.3, 0.48, C.coral);
  plant(15.2, -3.8, true, '#2e333b'); anchors.fakePlant = { x: 14.6, z: -3.6, y: 1.2 };
  atlasQuad('plant_tag', 14.93, 0.35, -3.8, 0.26, -PI / 2);
  plant(15.2, 3.9, true, '#2e333b');
  // rolling whiteboard
  S.box(10.2, 0, -2.6, 1.6, 0.04, 0.5, C.ink); S.box(9.45, 0, -2.6, 0.04, 1.9, 0.04, '#9aa0a8'); S.box(10.95, 0, -2.6, 0.04, 1.9, 0.04, '#9aa0a8');
  S.box(10.2, 0.85, -2.6, 1.55, 1.0, 0.04, '#f7f7f4');
  atlasQuad('wb_chart', 10.2, 1.35, -2.575, 1.45, 0, 0.9);
  atlasQuad('wb_chart', 10.2, 1.35, -2.625, 1.45, PI, 0.9);
  col(9.4, 11.0, -2.8, -2.4, 1.9, false);
  anchors.wbChart = { x: 10.2, z: -2.0, y: 1.4 };
  anchors.windowE = { x: 15.3, z: 2.6, y: 1.6 };
  anchors.windowN = { x: -2.5, z: -11.4, y: 1.6 };

  // ------------------------------------------------------------------ coffee corner (north)
  S.box(5.35, 0, -11.62, 5.1, 0.9, 0.62, '#dcd6cc'); S.box(5.35, 0.9, -11.6, 5.2, 0.04, 0.66, '#3a3f47');
  for (let x = 3.05; x < 7.9; x += 0.6) S.box(x, 0.12, -11.3, 0.56, 0.72, 0.01, '#e8e3da');
  col(2.8, 7.9, -12, -11.28, 0.94);
  S.box(3.7, 1.65, -11.78, 1.8, 0.62, 0.36, '#dcd6cc');
  // working coffee machine
  S.box(4.0, 0.94, -11.62, 0.4, 0.52, 0.38, '#2a2d33'); S.box(4.0, 1.46, -11.62, 0.42, 0.06, 0.4, '#6f757d');
  S.box(4.0, 0.94, -11.4, 0.28, 0.03, 0.12, '#6f757d'); S.box(4.0, 1.2, -11.43, 0.1, 0.08, 0.06, '#1b1d21');
  S.cyl(4.0, 0.97, -11.42, 0.035, 0.09, '#f6f3ee');
  E.box(4.12, 1.33, -11.425, 0.1, 0.05, 0.005, '#7fe0c5');
  anchors.coffee = { x: 4.0, z: -10.75, yaw: PI, y: 1.2 };
  // broken coffee machine
  S.box(5.3, 0.94, -11.62, 0.42, 0.56, 0.38, '#8a8f96'); S.box(5.3, 1.5, -11.62, 0.44, 0.05, 0.4, '#5b6068');
  S.box(5.3, 0.94, -11.4, 0.28, 0.03, 0.12, '#5b6068');
  atlasQuad('ooo', 5.3, 1.28, -11.42, 0.34, 0.06);
  atlasQuad('ooo2', 5.3, 1.08, -11.425, 0.26, -0.05);
  anchors.brokenCoffee = { x: 5.3, z: -10.75, y: 1.2 };
  // kettle, mugs, sugar
  S.cyl(6.2, 0.94, -11.65, 0.09, 0.22, '#d8dde2', { top: 0.8 }); S.cyl(6.2, 1.16, -11.65, 0.03, 0.04, C.ink);
  for (let i = 0; i < 4; i++) S.cyl(6.6 + i * 0.13, 0.94, -11.55, 0.04, 0.09, ['#e5484d', '#2f6fe4', '#f4f2ee', '#e0a83a'][i]);
  S.box(7.4, 0.94, -11.65, 0.3, 0.14, 0.2, '#f4f2ee');
  // water dispenser
  S.box(8.45, 0, -11.6, 0.34, 1.02, 0.34, '#f1f1ee'); S.cyl(8.45, 1.02, -11.6, 0.14, 0.4, '#8cc4ec', { top: 0.85 });
  S.box(8.4, 0.72, -11.42, 0.03, 0.05, 0.03, '#2f6fe4'); S.box(8.5, 0.72, -11.42, 0.03, 0.05, 0.03, '#e5484d');
  col(8.25, 8.65, -11.8, -11.4, 1.4);
  anchors.water = { x: 8.45, z: -10.9, yaw: PI, y: 1.2 };
  // high bar table + stools
  S.cyl(6.2, 0, -8.9, 0.22, 0.03, C.ink); S.cyl(6.2, 0.03, -8.9, 0.035, 1.02, '#8a9099'); S.cyl(6.2, 1.05, -8.9, 0.4, 0.04, C.wood);
  col(5.85, 6.55, -9.25, -8.55, 1.08, false);
  // clock
  atlasQuad('clock', 6.3, 2.2, -11.885, 0.52, 0, 0.52);
  const clockHands = [];
  const makeClock = (x, y, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const handMat = new THREE.MeshBasicMaterial({ color: '#1d2433' });
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.01), handMat); h.geometry.translate(0, 0.06, 0.01);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.01), handMat); m.geometry.translate(0, 0.09, 0.015);
    g.add(h); g.add(m); root.add(g); clockHands.push({ h, m });
  };
  makeClock(6.3, 2.2, -11.875, 0);
  anchors.clock = { x: 6.3, z: -10.9, y: 2.0 };

  // ------------------------------------------------------------------ meeting room
  S.box(-12, 0.72, -8.5, 4.2, 0.05, 1.4, C.wood); S.box(-12, 0.7, -8.5, 4.1, 0.02, 1.3, '#a67c52');
  S.box(-13.4, 0, -8.5, 0.5, 0.7, 0.8, '#3a3f47'); S.box(-10.6, 0, -8.5, 0.5, 0.7, 0.8, '#3a3f47');
  col(-14.1, -9.9, -9.2, -7.8, 0.75);
  for (const x of [-13.4, -12, -10.6]) { chair(x, -7.25, PI, '#4f6d7a'); chair(x, -9.75, 0, '#4f6d7a'); }
  chair(-14.55, -8.5, PI / 2, '#c9745a');
  S.box(-15.86, 0.95, -8.5, 0.06, 1.1, 1.9, '#15181d');
  screen('tv', -15.82, 1.5, -8.5, 1.78, 1.02, PI / 2);
  S.box(-8.14, 0.8, -8.5, 0.05, 1.3, 2.6, '#f7f7f4'); S.box(-8.14, 0.8, -8.5, 0.07, 0.04, 2.7, '#9aa0a8');
  atlasQuad('wb_meeting', -8.17, 1.45, -8.5, 2.4, -PI / 2, 1.2);
  anchors.wbMeeting = { x: -8.9, z: -8.5, y: 1.4 };
  atlasQuad('sign_meeting', -10.0, 2.62, -4.95, 1.9, 0, 0.36);
  atlasQuad('sign_meeting', -10.0, 2.62, -5.05, 1.9, PI, 0.36);
  plant(-15.3, -11.2);
  anchors.meetDoor = { x: -12, z: -4.3, y: 1.6 };

  // posters on meeting room's outer wall (faces the open plan)
  atlasQuad('poster_team', -7.89, 1.62, -7.0, 0.74, PI / 2, 1.02);
  atlasQuad('calendar', -7.89, 1.55, -9.6, 0.5, PI / 2, 0.58);
  anchors.posterTeam = { x: -7.2, z: -7.0, y: 1.6 };
  anchors.calendar = { x: -7.2, z: -9.6, y: 1.6 };

  // ------------------------------------------------------------------ manager office
  S.box(13, 0.74, -9, 1.9, 0.05, 0.85, C.darkWood); S.box(13, 0, -8.62, 1.9, 0.74, 0.05, '#5e3f2a');
  S.box(12.1, 0, -9, 0.08, 0.74, 0.8, '#5e3f2a'); S.box(13.9, 0, -9, 0.08, 0.74, 0.8, '#5e3f2a');
  col(12.05, 13.95, -9.43, -8.57, 0.8);
  S.box(13, 0.79, -8.85, 0.22, 0.015, 0.16, C.ink); S.box(13, 0.79, -8.83, 0.04, 0.3, 0.03, C.ink);
  S.box(13, 0.97, -8.86, 0.64, 0.4, 0.028, '#1f232a');
  screen('sheet', 13, 1.17, -8.878, 0.58, 0.34, PI);
  atlasQuad('sticky_pwd', 13.22, 1.3, -8.88, 0.09, PI, 0.09);
  anchors.managerPC = { x: 13.0, z: -9.9, y: 1.15 };
  S.cyl(12.3, 0.765, -9.15, 0.045, 0.1, '#f2f2ee'); S.cyl(12.3, 0.78, -9.15, 0.046, 0.03, '#c0392b');
  chair(13, -10.1, 0, '#1d2433');
  simpleChair(12.4, -7.9, PI, '#c9745a'); simpleChair(13.6, -7.9, PI, '#c9745a');
  S.box(15.72, 0, -8.8, 0.5, 2.1, 2.6, '#8a6443'); col(15.45, 16, -10.1, -7.5, 2.1);
  for (let sh = 0; sh < 4; sh++) {
    S.box(15.55, 0.1 + sh * 0.52, -8.8, 0.46, 0.03, 2.5, '#6e4e34');
    for (let b = 0; b < 14; b++) S.box(15.55, 0.14 + sh * 0.52, -9.9 + b * 0.16 + rng() * 0.02, 0.32, 0.3 + rng() * 0.08, 0.12, ['#2f6fe4', '#e5484d', '#e0a83a', '#2bb39a', '#1d2433'][(rng() * 5) | 0]);
  }
  atlasQuad('poster_eotm', 9.12, 1.6, -8.8, 0.62, PI / 2, 0.78);
  plant(15.3, -11.3, true, '#c9745a');
  atlasQuad('sign_manager', 13.3, 2.62, -4.95, 1.9, 0, 0.36);
  atlasQuad('poster_innov', 8.89, 1.62, -8.0, 0.74, -PI / 2, 1.02);
  anchors.posterInnov = { x: 8.2, z: -8.0, y: 1.6 };
  anchors.mgrDoor = { x: 10.8, z: -4.3, y: 1.6 };

  // ------------------------------------------------------------------ printer nook (west)
  S.box(-15.35, 0, -1.6, 0.62, 0.95, 0.66, '#d7dade'); S.box(-15.35, 0.95, -1.6, 0.66, 0.2, 0.7, '#e9ebee');
  S.box(-15.35, 1.15, -1.62, 0.6, 0.05, 0.55, '#3a3f47');
  for (let i = 0; i < 3; i++) S.box(-15.03, 0.12 + i * 0.26, -1.6, 0.01, 0.02, 0.5, '#9aa0a8');
  S.box(-14.98, 0.62, -1.6, 0.14, 0.03, 0.4, '#c7cbd0');
  S.box(-15.08, 1.02, -1.88, 0.14, 0.12, 0.2, '#3a3f47', { rz: 0.4 });
  col(-15.8, -14.95, -2.0, -1.2, 1.2);
  atlasQuad('printer_label', -15.885, 1.75, -1.6, 0.62, PI / 2);
  anchors.printer = { x: -14.55, z: -1.6, yaw: -PI / 2, y: 1.25 };
  const printerLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: '#36d27c' }));
  printerLed.position.set(-15.02, 1.1, -1.84); root.add(printerLed);
  // paper shelf
  S.box(-15.5, 0, -3.1, 0.6, 1.2, 0.9, '#e2ddd3'); col(-15.8, -15.2, -3.55, -2.65, 1.2);
  for (let i = 0; i < 5; i++) S.box(-15.45, 0.1 + i * 0.22, -3.1, 0.34, 0.12, 0.3 + rng() * 0.2, i % 2 ? '#f7f7f4' : '#e9e2d0');
  // production "server": a dusty tower under a side table
  S.box(-15.45, 0.7, 0.2, 0.7, 0.04, 0.7, '#dcd6cc'); for (const dz of [-0.3, 0.3]) for (const dx of [-0.3, 0.3]) S.box(-15.45 + dx, 0, 0.2 + dz, 0.04, 0.7, 0.04, C.deskLeg);
  S.box(-15.45, 0, 0.2, 0.46, 0.5, 0.24, '#2b2f36'); S.box(-15.2, 0.3, 0.2, 0.01, 0.12, 0.16, '#3a3f47');
  atlasQuad('prod_label', -15.215, 0.38, 0.2, 0.18, PI / 2);
  col(-15.8, -15.1, -0.15, 0.55, 0.74);
  const prodLed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: '#36d27c' }));
  prodLed.position.set(-15.205, 0.46, 0.13); root.add(prodLed);
  anchors.prodBox = { x: -14.6, z: 0.2, y: 0.8 };
  // shredder + bins
  S.box(-15.5, 0, 1.1, 0.36, 0.62, 0.3, '#3a3f47'); S.box(-15.5, 0.62, 1.1, 0.38, 0.05, 0.32, '#1d2433');
  S.cyl(-14.9, 0, 1.2, 0.16, 0.38, '#2f6fe4', { top: 1.15 }); S.cyl(-14.5, 0, 1.2, 0.16, 0.38, '#3a3f47', { top: 1.15 });

  // ------------------------------------------------------------------ cafeteria
  const cafeTable = (x, z, seats) => {
    S.cyl(x, 0, z, 0.26, 0.03, C.ink); S.cyl(x, 0.03, z, 0.04, 0.69, '#8a9099'); S.cyl(x, 0.72, z, 0.55, 0.04, '#f4f2ee');
    col(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 0.76);
    for (const [dx, dz, yaw] of seats) simpleChair(x + dx, z + dz, yaw, [C.mustard, C.teal, C.coral, '#2f6fe4'][(rng() * 4) | 0]);
    // pendant
    S.cyl(x, 2.25, z, 0.008, 0.75, '#222');
    S.cone(x, 2.0, z, 0.26, 0.28, C.mustard, { rx: PI });
    E.sphere(x, 1.96, z, 0.07, 0.05, 0.07, '#fff3c4');
  };
  cafeTable(-13.6, 7.2, [[0, -0.75, 0], [0, 0.75, PI]]);
  cafeTable(-10.4, 7.2, [[0, -0.75, 0], [0, 0.75, PI]]);
  cafeTable(-12.0, 10.2, [[0, -0.75, 0], [-0.75, 0, PI / 2], [0.75, 0, -PI / 2]]);
  // counter + lunch trays
  S.box(-15.62, 0, 7.7, 0.66, 0.9, 4.2, '#dcd6cc'); S.box(-15.6, 0.9, 7.7, 0.7, 0.04, 4.3, '#3a3f47');
  col(-16, -15.25, 5.55, 9.85, 0.94);
  for (let i = 0; i < 3; i++) { S.box(-15.55, 0.94, 7.3 + i * 0.55, 0.4, 0.06, 0.45, '#c9ced4'); S.sphere(-15.55, 1.0, 7.3 + i * 0.55, 0.14, 0.05, 0.16, ['#d89b3a', '#e6d3a3', '#7fae5b'][i]); }
  anchors.lunch = { x: -14.75, z: 7.85, yaw: -PI / 2, y: 1.2 };
  S.box(-15.55, 0.94, 6.1, 0.46, 0.3, 0.55, '#e9ecef'); S.box(-15.31, 0.97, 6.0, 0.01, 0.22, 0.34, '#1d2433');
  atlasQuad('microwave_note', -15.885, 1.6, 6.1, 0.5, PI / 2);
  anchors.microwave = { x: -14.8, z: 6.1, y: 1.4 };
  S.box(-15.5, 0, 10.95, 0.72, 1.9, 0.8, '#e9ecef'); S.box(-15.13, 1.0, 11.2, 0.03, 0.6, 0.04, '#9aa0a8'); S.box(-15.13, 0.25, 11.2, 0.03, 0.4, 0.04, '#9aa0a8');
  col(-15.9, -15.1, 10.5, 11.4, 1.9);
  atlasQuad('fridge_note', -15.135, 1.35, 10.8, 0.2, PI / 2, 0.2);
  anchors.fridge = { x: -14.5, z: 10.8, y: 1.4 };
  atlasQuad('menu', -15.885, 1.85, 8.2, 1.1, PI / 2, 0.79);
  anchors.menu = { x: -14.8, z: 8.9, y: 1.8 };
  // vending machine
  S.box(-8.95, 0, 11.55, 0.95, 1.95, 0.75, '#c0392b'); S.box(-8.95, 1.72, 11.17, 0.9, 0.18, 0.01, '#8e2a20');
  screen('vend', -9.08, 1.05, 11.172, 0.62, 1.1, PI);
  S.box(-8.62, 0.9, 11.17, 0.16, 0.3, 0.01, '#2b3140');
  col(-9.45, -8.45, 11.15, 12, 1.95);
  anchors.vending = { x: -8.95, z: 10.65, yaw: 0, y: 1.2 };
  atlasQuad('sign_cafe', -12.1, 2.55, 4.23, 1.7, 0, 0.32);
  atlasQuad('sign_cafe', -12.1, 2.55, 4.17, 1.7, PI, 0.32);
  S.box(-12.1, 2.72, 4.2, 0.01, 0.28, 0.01, '#222');

  // ------------------------------------------------------------------ lobby / reception
  S.box(-2.5, 0, 8.45, 2.8, 1.05, 0.12, C.blue); S.box(-2.5, 1.05, 8.55, 3.0, 0.05, 0.42, C.wood);
  for (const x of [-3.9, -1.1]) S.box(x, 0, 8.8, 0.12, 1.05, 0.8, C.blue);
  S.box(-2.5, 0.72, 9.2, 2.6, 0.035, 0.6, C.deskTop);
  col(-4.0, -1.0, 8.35, 9.5, 1.1);
  S.box(-2.2, 0.75, 9.3, 0.5, 0.32, 0.025, '#1f232a'); screen('mail', -2.2, 0.93, 9.285, 0.46, 0.27, PI);
  chair(-2.5, 9.85, PI, '#2f6fe4');
  atlasQuad('logo', -2.5, 2.05, 11.885, 2.4, PI, 0.6);
  plant(-4.7, 11.3, true); plant(5.6, 11.3);
  simpleChair(-6.8, 11.4, PI, C.teal); simpleChair(-6.2, 11.4, PI, C.teal); simpleChair(-7.4, 11.4, PI, C.teal);
  atlasQuad('poster_quick', 6.6, 1.62, 11.885, 0.66, PI, 0.91);
  anchors.posterQuick = { x: 6.6, z: 10.9, y: 1.6 };
  anchors.reception = { x: -2.5, z: 7.9 };

  // elevator: frame, cabin, doors, indicator
  S.box(0.4, 0, 11.9, 0.14, 2.45, 0.3, '#9aa0a8'); S.box(2.6, 0, 11.9, 0.14, 2.45, 0.3, '#9aa0a8'); S.box(1.5, 2.3, 11.9, 2.34, 0.12, 0.3, '#9aa0a8');
  S.box(1.5, -0.02, 12.9, 2.0, 0.02, 1.8, '#6b6f75');
  S.box(0.45, 0, 12.9, 0.1, 3, 1.8, '#c3c8ce'); S.box(2.55, 0, 12.9, 0.1, 3, 1.8, '#c3c8ce'); S.box(1.5, 0, 13.85, 2.1, 3, 0.1, '#b6bcc3');
  S.box(1.5, 0.9, 13.78, 1.8, 0.04, 0.05, '#e9ecef');
  E.quad(1.5, 2.34, 12.9, 1.2, 1.0, '#fff8e8', { rx: PI / 2 });
  S.box(1.5, 2.36, 12.9, 2.0, 0.02, 1.8, '#dcdfe2');
  col(0.4, 0.5, 12, 13.9, 3); col(2.5, 2.6, 12, 13.9, 3); col(0.4, 2.6, 13.8, 14, 3);
  atlasQuad('elevator_panel', 2.95, 1.25, 11.885, 0.18, PI, 0.3);
  anchors.elevator = { x: 1.5, z: 11.05, yaw: 0, y: 1.6 };
  const doorMat = new THREE.MeshLambertMaterial({ color: '#b9bec4' });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.28, 0.06), doorMat);
  const doorR = doorL.clone();
  doorL.position.set(1.0, 1.14, 11.97); doorR.position.set(2.0, 1.14, 11.97);
  root.add(doorL); root.add(doorR);
  const doorCol = { minX: 0.5, maxX: 2.5, minZ: 11.9, maxZ: 12.05, h: 3, cam: true, on: true };
  colliders.push(doorCol);
  const indicatorCanvas = document.createElement('canvas'); indicatorCanvas.width = 128; indicatorCanvas.height = 48;
  const indTex = new THREE.CanvasTexture(indicatorCanvas); indTex.colorSpace = THREE.SRGBColorSpace;
  const indicator = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: indTex }));
  indicator.position.set(1.5, 2.55, 11.885); indicator.rotation.y = PI; root.add(indicator);
  const drawIndicator = (floorNo, dir) => {
    const g = indicatorCanvas.getContext('2d');
    g.fillStyle = '#10141b'; g.fillRect(0, 0, 128, 48);
    g.fillStyle = '#ffb14a'; g.font = 'bold 32px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(String(floorNo), 70, 36);
    if (dir) { g.beginPath(); if (dir > 0) { g.moveTo(22, 34); g.lineTo(36, 14); g.lineTo(50, 34); } else { g.moveTo(22, 14); g.lineTo(36, 34); g.lineTo(50, 14); } g.fill(); }
    indTex.needsUpdate = true;
  };
  drawIndicator(13, 0);
  // stair exit door
  S.box(4.0, 0, 11.84, 1.0, 2.15, 0.06, '#6d8a7a'); S.box(4.0, 1.0, 11.79, 0.8, 0.05, 0.04, '#c3c8ce');
  S.box(3.46, 0, 11.9, 0.08, 2.2, 0.2, '#d9d3c8'); S.box(4.54, 0, 11.9, 0.08, 2.2, 0.2, '#d9d3c8'); S.box(4.0, 2.15, 11.9, 1.16, 0.08, 0.2, '#d9d3c8');
  atlasQuad('exit', 4.0, 2.45, 11.79, 0.5, PI, 0.19, true);
  atlasQuad('stairs_note', 4.25, 1.45, 11.805, 0.22, PI);
  anchors.stairs = { x: 4.0, z: 11.1, yaw: 0, y: 1.6 };

  // ------------------------------------------------------------------ restroom
  for (const z of [7.1, 9.3]) { S.box(15.05, 0.15, z, 1.9, 1.85, 0.04, '#9fb4bf'); }
  S.box(14.12, 0.15, 6.1, 0.04, 1.85, 0.4, '#9fb4bf');
  S.box(14.12, 0.15, 10.9, 0.04, 1.85, 2.2, '#9fb4bf');
  S.box(14.12, 0.15, 8.2, 0.04, 1.85, 0.3, '#9fb4bf');
  S.box(13.7, 0.15, 7.7, 0.04, 1.85, 0.75, '#b8cbd4', { ry: 0.5 });
  S.box(13.7, 0.15, 8.75, 0.04, 1.85, 0.75, '#b8cbd4', { ry: -0.5 });
  col(14.1, 16, 7.05, 7.15, 2); col(14.1, 16, 9.25, 9.35, 2); col(14.1, 14.14, 9.4, 12, 2); col(14.1, 14.14, 5, 6.3, 2);
  for (const z of [6.1, 8.2]) { S.cyl(15.5, 0, z + 0.0, 0.2, 0.42, '#fbfbf8'); S.box(15.8, 0.4, z, 0.2, 0.4, 0.4, '#fbfbf8'); }
  anchors.stall = { x: 13.3, z: 8.2, yaw: PI / 2, y: 1.3 };
  S.box(12.2, 0, 11.7, 2.6, 0.85, 0.55, '#dcd6cc'); S.box(12.2, 0.85, 11.68, 2.7, 0.04, 0.6, '#f4f2ee');
  for (const x of [11.5, 12.9]) { S.sphere(x, 0.9, 11.62, 0.2, 0.06, 0.16, '#ffffff'); S.box(x, 0.89, 11.84, 0.03, 0.18, 0.03, '#c3c8ce'); }
  col(10.9, 13.5, 11.4, 12, 0.9);
  S.box(12.2, 1.15, 11.87, 2.4, 0.9, 0.02, '#aebfca');
  atlasQuad('mirror', 12.2, 1.9, 11.855, 0.46, PI);
  anchors.sink = { x: 12.2, z: 10.95, yaw: 0, y: 1.4 };
  S.box(10.13, 1.2, 9.5, 0.12, 0.3, 0.26, '#e9ecef');
  atlasQuad('wash', 10.115, 1.75, 8.2, 0.5, PI / 2);
  atlasQuad('sign_restroom', 12.9, 2.2, 4.885, 0.8, PI, 0.24);
  anchors.washSign = { x: 10.8, z: 8.2, y: 1.7 };

  // ------------------------------------------------------------------ build meshes
  const materials = {};
  materials.static = new THREE.MeshLambertMaterial({ vertexColors: true });
  materials.emissive = new THREE.MeshBasicMaterial({ vertexColors: true });
  materials.glass = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false });
  const atlasTex = atlas.texture();
  materials.atlas = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true });
  materials.atlasUnlit = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
  materials.window = windowMat;
  const staticMesh = S.mesh(materials.static, { shadows: quality.shadows });
  root.add(staticMesh);
  root.add(E.mesh(materials.emissive));
  root.add(AL.mesh(materials.atlas));
  root.add(AU.mesh(materials.atlasUnlit));
  const winMesh = W.mesh(windowMat); root.add(winMesh);
  const glassMesh = G.mesh(materials.glass); glassMesh.renderOrder = 5; root.add(glassMesh);
  const screenTex = makeScreenTextures();
  const screenMats = {};
  for (const t of screenTypes) {
    if (!SC[t].vc) continue;
    screenMats[t] = new THREE.MeshBasicMaterial({ map: screenTex[t], vertexColors: true });
    root.add(SC[t].mesh(screenMats[t]));
  }

  // coffee steam (cheap sprites)
  const steam = [];
  if (quality.fx) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const st = new THREE.CanvasTexture(c);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0 }));
      sp.scale.set(0.12, 0.12, 1); sp.position.set(4.0, 1.08, -11.42); sp.userData.t = i / 4;
      root.add(sp); steam.push(sp);
    }
  }

  // ------------------------------------------------------------------ runtime
  const elevator = { open: 0, target: 0, holdUntil: 0, floorAnim: 0 };
  let ledT = 0;
  let redMode = false;
  const originalMaps = Object.fromEntries(Object.entries(screenMats).map(([k, m]) => [k, m.map]));

  const world = {
    root, colliders, anchors, screenMats, materials, windowMat, staticMesh,
    elevator,
    openElevator(seconds = 4) { elevator.target = 1; elevator.holdUntil = performance.now() + seconds * 1000; },
    closeElevator() { elevator.target = 0; elevator.holdUntil = 0; },
    setIncident(on) {
      redMode = on;
      for (const [k, m] of Object.entries(screenMats)) {
        if (['tv', 'vend'].includes(k)) continue;
        m.map = on ? screenTex.red : originalMaps[k]; m.needsUpdate = true;
      }
    },
    update(dt, minutes) {
      // clocks follow game time
      const h = (minutes / 60) % 12, m = minutes % 60;
      for (const c of clockHands) { c.h.rotation.z = -(h / 12) * PI * 2; c.m.rotation.z = -(m / 60) * PI * 2; }
      ledT += dt;
      printerLed.material.color.set(Math.sin(ledT * 3) > 0 ? '#36d27c' : '#10331f');
      prodLed.material.color.set(redMode ? (Math.sin(ledT * 12) > 0 ? '#ff3b3b' : '#3b0a0a') : (Math.sin(ledT * 7.3) > 0.3 ? '#36d27c' : '#123d22'));
      if (screenMats.code) screenMats.code.map.offset.y = (ledT * 0.03) % 1;
      if (screenMats.chat) screenMats.chat.map.offset.y = -((ledT * 0.02) % 1);
      if (elevator.holdUntil && performance.now() > elevator.holdUntil) { elevator.target = 0; elevator.holdUntil = 0; }
      elevator.open = damp(elevator.open, elevator.target, 3.2, dt);
      const o = elevator.open;
      doorL.position.x = 1.0 - o * 0.92; doorR.position.x = 2.0 + o * 0.92;
      doorCol.on = o < 0.75;
      for (const s of steam) {
        s.userData.t = (s.userData.t + dt * 0.35) % 1;
        const t = s.userData.t;
        s.position.y = 1.1 + t * 0.35; s.position.x = 4.0 + Math.sin(t * 6 + s.id) * 0.03;
        s.material.opacity = Math.sin(t * PI) * 0.35; s.scale.setScalar(0.08 + t * 0.12);
      }
    },
    drawIndicator,
  };
  return world;
}
