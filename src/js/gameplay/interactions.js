// Contextual interactions: finds the best nearby interactable in front of the
// player, drives the big context button label (TALK / SIT / PRINT ...) and a
// small floating marker in the world so players see what they are targeting.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { wrapAngle } from '../core/util.js';

function markerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(29,36,51,0.9)'; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd84d'; g.beginPath(); g.moveTo(32, 16); g.lineTo(46, 32); g.lineTo(32, 48); g.lineTo(18, 32); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Interactions {
  constructor(scene) {
    this.items = [];
    this.current = null;
    this.t = 0; this.acc = 0;
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(), depthTest: false, transparent: true }));
    this.marker.scale.set(0.2, 0.2, 1); this.marker.renderOrder = 20; this.marker.visible = false;
    scene.add(this.marker);
  }
  register(item) { this.items.push(item); return item; }

  update(dt, player, locked) {
    this.t += dt; this.acc += dt;
    if (locked) { this.current = null; this.marker.visible = false; return; }
    if (this.acc > 0.1) {
      this.acc = 0;
      let best = null, bestScore = Infinity;
      const px = player.pos.x, pz = player.pos.z, yaw = player.yaw;
      for (const it of this.items) {
        if (it.enabled && !it.enabled()) continue;
        const p = it.pos ? it.pos() : it;
        const dx = p.x - px, dz = p.z - pz, d = Math.hypot(dx, dz);
        const r = it.r || CONFIG.INTERACT_RANGE;
        if (d > r) continue;
        const label = typeof it.label === 'function' ? it.label() : it.label;
        if (!label) continue;
        const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw));
        if (player.state === 'free' && d > 0.9 && ang > 1.9) continue;
        const score = d + ang * 0.45 + (it.priority || 0);
        if (score < bestScore) { bestScore = score; best = { it, label, p }; }
      }
      this.current = best;
    }
    const c = this.current;
    if (c) {
      const p = c.it.pos ? c.it.pos() : c.it;
      this.marker.visible = true;
      this.marker.position.set(p.x, (p.y || 1.2) + 0.35 + Math.sin(this.t * 3.2) * 0.05, p.z);
    } else this.marker.visible = false;
  }

  use(game) { if (this.current) this.current.it.use(game); }
}
