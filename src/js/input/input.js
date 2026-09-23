// Touch-first input. Left side of the screen = floating joystick, right side =
// camera swipe. Both work simultaneously via Pointer Events (multi-touch).
// Mouse: drag anywhere to look. Keyboard: WASD/arrows, Shift run, E interact.
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';

export class Input {
  constructor(layer, joyBase, joyKnob) {
    this.layer = layer;
    this.joyBase = joyBase;
    this.joyKnob = joyKnob;
    this.move = { x: 0, y: 0 };
    this.lookDX = 0; this.lookDY = 0;
    this.keys = new Set();
    this.joyId = null; this.lookId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.joyRadius = 60;
    this.lastLook = { x: 0, y: 0 };
    this.enabled = false;
    this.touchUsed = false;
    this.lastLookTime = 0;

    const opts = { passive: false };
    layer.addEventListener('pointerdown', (e) => this.down(e), opts);
    window.addEventListener('pointermove', (e) => this.moveEv(e), opts);
    window.addEventListener('pointerup', (e) => this.up(e), opts);
    window.addEventListener('pointercancel', (e) => this.up(e), opts);
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.reset(); });
    // iOS: block pinch-zoom / double-tap zoom gestures on the game layer.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  reset() {
    this.joyId = null; this.lookId = null;
    this.move.x = 0; this.move.y = 0;
    this.joyBase.classList.remove('active');
    this.placeJoyIdle();
  }

  placeJoyIdle() {
    const r = this.joyRadius;
    const left = Math.max(28, window.innerWidth * 0.04) + r + this.safeLeft();
    const top = window.innerHeight - r - Math.max(26, window.innerHeight * 0.06);
    this.setJoy(left, top, 0, 0);
  }

  safeLeft() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--sal');
    return parseFloat(v) || 0;
  }

  setJoy(x, y, kx, ky) {
    this.joyBase.style.transform = `translate(${x - this.joyRadius}px, ${y - this.joyRadius}px)`;
    this.joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchUsed = true;
    const isMouse = e.pointerType === 'mouse';
    const leftZone = e.clientX < window.innerWidth * 0.42;
    if (!isMouse && leftZone && this.joyId === null) {
      this.joyId = e.pointerId;
      const r = this.joyRadius;
      const x = clamp(e.clientX, r + 8, window.innerWidth * 0.42);
      const y = clamp(e.clientY, r + 8, window.innerHeight - r - 8);
      this.joyOrigin = { x, y };
      this.joyBase.classList.add('active');
      this.setJoy(x, y, 0, 0);
      this.updateJoy(e.clientX, e.clientY);
      bus.emit('input-used', 'move');
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
    }
    try { this.layer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  updateJoy(px, py) {
    let dx = px - this.joyOrigin.x, dy = py - this.joyOrigin.y;
    const d = Math.hypot(dx, dy), r = this.joyRadius;
    if (d > r) { dx = (dx / d) * r; dy = (dy / d) * r; }
    const dead = 0.12;
    let mx = dx / r, my = -dy / r;
    const m = Math.hypot(mx, my);
    if (m < dead) { mx = 0; my = 0; }
    this.move.x = mx; this.move.y = my;
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  moveEv(e) {
    if (e.pointerId === this.joyId) { e.preventDefault(); this.updateJoy(e.clientX, e.clientY); }
    else if (e.pointerId === this.lookId) {
      e.preventDefault();
      this.lookDX += e.clientX - this.lastLook.x;
      this.lookDY += e.clientY - this.lastLook.y;
      this.lastLook = { x: e.clientX, y: e.clientY };
      this.lastLookTime = performance.now();
      if (Math.abs(this.lookDX) + Math.abs(this.lookDY) > 12) bus.emit('input-used', 'look');
    }
  }

  up(e) {
    if (e.pointerId === this.joyId) {
      this.joyId = null; this.move.x = 0; this.move.y = 0;
      this.joyBase.classList.remove('active');
      this.placeJoyIdle();
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  }

  keyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    this.keys.add(e.code);
    if (!this.enabled) return;
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { bus.emit('key-interact'); e.preventDefault(); }
    if (e.code === 'Escape' || e.code === 'KeyP') bus.emit('key-pause');
    if (e.code === 'Tab' || e.code === 'KeyT') { bus.emit('key-tasks'); e.preventDefault(); }
    if (e.code.startsWith('Digit')) bus.emit('key-choice', parseInt(e.code.slice(5), 10) - 1);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) bus.emit('input-used', 'move');
  }

  // Returns movement vector (x = right, y = forward), magnitude 0..1, plus run flag.
  getMove() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    let kx = 0, ky = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) ky += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (kx || ky) { const m = Math.hypot(kx, ky); x = kx / m; y = ky / m; }
    const mag = Math.min(1, Math.hypot(x, y));
    const run = (kx || ky) ? (k.has('ShiftLeft') || k.has('ShiftRight')) : mag > 0.86;
    return { x, y, mag, run };
  }

  consumeLook() { const d = { x: this.lookDX, y: this.lookDY }; this.lookDX = 0; this.lookDY = 0; return d; }
}
