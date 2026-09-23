// Renderer + lighting. Lighting is deliberately cheap: hemisphere fill + one
// directional "sun" (shadows only on High). Colour temperature and intensity
// follow the in-game clock: cool morning -> neutral noon -> warm, dim evening.
import * as THREE from 'three';
import { QUALITY } from '../config.js';
import { clamp } from '../core/util.js';

export function createRenderer(canvas, qualityName) {
  const q = QUALITY[qualityName] || QUALITY.medium;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q.aa, powerPreference: 'high-performance', stencil: false, alpha: false });
  } catch (e) {
    console.error('WebGL unavailable', e);
    return null;
  }
  renderer.setClearColor('#20242c');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  applyQuality(renderer, qualityName);
  return renderer;
}

export function applyQuality(renderer, qualityName, scale = 1) {
  const q = QUALITY[qualityName] || QUALITY.medium;
  const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * scale;
  renderer.setPixelRatio(Math.max(0.6, dpr));
}

const KEYS = [
  { t: 537, sun: '#fff1de', si: 1.35, sky: '#e4efff', ground: '#8c7c6a', hi: 2.35, win: '#ffffff', az: 0.9, el: 0.95 },
  { t: 720, sun: '#fff8ee', si: 1.45, sky: '#f1f2ef', ground: '#8f7d6a', hi: 2.4, win: '#fffaf1', az: 0.2, el: 1.2 },
  { t: 900, sun: '#ffe6c2', si: 1.4, sky: '#f8ecdc', ground: '#937c66', hi: 2.25, win: '#ffe7c8', az: -0.5, el: 1.0 },
  { t: 1005, sun: '#ffcc92', si: 1.25, sky: '#f4dcc4', ground: '#8f735e', hi: 2.0, win: '#ffc896', az: -0.9, el: 0.75 },
  { t: 1050, sun: '#ffb27a', si: 1.05, sky: '#e9cdb8', ground: '#86695a', hi: 1.75, win: '#ffa877', az: -1.1, el: 0.55 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
function lerpColor(out, a, b, t) { cA.set(a); cB.set(b); return out.copy(cA).lerp(cB, t); }

export class Lighting {
  constructor(scene, qualityName) {
    this.hemi = new THREE.HemisphereLight(0xe4efff, 0x8c7c6a, 2.3);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1de, 1.3);
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun); scene.add(this.sun.target);
    const s = this.sun.shadow;
    s.mapSize.set(1024, 1024);
    s.camera.left = -11; s.camera.right = 11; s.camera.top = 11; s.camera.bottom = -11;
    s.camera.near = 1; s.camera.far = 40; s.bias = -0.0008; s.normalBias = 0.03;
    this.setQuality(qualityName);
    this.alarm = 0;
    this.focus = new THREE.Vector3();
    this.windowTint = new THREE.Color('#ffffff');
  }
  setQuality(qualityName) {
    const q = QUALITY[qualityName] || QUALITY.medium;
    this.sun.castShadow = q.shadows;
  }
  update(minutes, focus, windowMat, dt) {
    let i = 0;
    while (i < KEYS.length - 2 && minutes > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((minutes - a.t) / (b.t - a.t), 0, 1);
    lerpColor(this.sun.color, a.sun, b.sun, t);
    this.sun.intensity = a.si + (b.si - a.si) * t;
    lerpColor(this.hemi.color, a.sky, b.sky, t);
    lerpColor(this.hemi.groundColor, a.ground, b.ground, t);
    this.hemi.intensity = a.hi + (b.hi - a.hi) * t;
    lerpColor(this.windowTint, a.win, b.win, t);
    if (this.alarm > 0) {
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      this.hemi.color.lerp(cA.set('#ff6b6b'), 0.35 * p * this.alarm);
      this.alarm = Math.max(0, this.alarm - dt * 0.05);
    }
    if (windowMat) windowMat.color.copy(this.windowTint);
    const az = a.az + (b.az - a.az) * t, el = a.el + (b.el - a.el) * t;
    if (focus) this.focus.copy(focus);
    const f = this.focus;
    this.sun.position.set(f.x + Math.sin(az) * Math.cos(el) * 14, f.y + Math.sin(el) * 14, f.z + Math.cos(az) * Math.cos(el) * 6 - 4);
    this.sun.target.position.copy(f);
  }
}
