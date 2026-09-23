// Third-person camera rig with three modes:
//  follow - orbit behind the player, touch-drag to rotate, collides with walls
//  shot   - cinematic framing for dialogue/cutscenes (smoothly blended)
//  orbit  - slow attract-mode orbit for the title screen
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/util.js';
import { rayCast } from '../world/collision.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), dir = new THREE.Vector3();

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera; this.world = world;
    this.yaw = 0; this.pitch = CONFIG.CAMERA.pitch;
    this.dist = CONFIG.CAMERA.distance; this.curDist = this.dist;
    this.mode = 'follow';
    this.pos = camera.position.clone();
    this.look = new THREE.Vector3();
    this.shot = { pos: new THREE.Vector3(), target: new THREE.Vector3(), k: 3.5 };
    this.orbitT = 0;
    this.lastLook = 0;
    this.shake = 0;
    this.snap = true;
  }

  setShot(pos, target, k = 3.5) { this.mode = 'shot'; this.shot.pos.copy(pos); this.shot.target.copy(target); this.shot.k = k; }
  follow(snap = false) { this.mode = 'follow'; if (snap) this.snap = true; }
  faceBehind(yaw) { this.yaw = yaw + Math.PI; }

  // Frame two characters in conversation from the side, like a sitcom two-shot.
  twoShot(a, b, ha = 1.55, hb = 1.55) {
    const mid = v1.set((a.x + b.x) / 2, (ha + hb) / 2 - 0.1, (a.z + b.z) / 2);
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.max(0.8, Math.hypot(dx, dz));
    let px = -dz / d, pz = dx / d;
    // choose the side that is closer to the current camera (less jarring)
    const cx = this.cam.position.x - mid.x, cz = this.cam.position.z - mid.z;
    if (px * cx + pz * cz < 0) { px = -px; pz = -pz; }
    const back = 2.3 + d * 0.8;
    const pos = v2.set(mid.x + px * back - dx * 0.1, mid.y + 0.62, mid.z + pz * back - dz * 0.1);
    // pull in if a wall is in the way
    dir.copy(pos).sub(mid); const len = dir.length(); dir.normalize();
    const t = rayCast(mid, dir, len, this.world.colliders);
    pos.copy(mid).addScaledVector(dir, Math.max(0.8, t - 0.25));
    // aim below the faces so they sit in the top half, above the dialogue box
    this.setShot(pos, v1.set(mid.x, mid.y - 0.55, mid.z), 3.2);
  }

  update(dt, player, input, settings, reducedMotion) {
    const cam = this.cam;
    if (this.mode === 'orbit') {
      this.orbitT += dt * 0.05;
      const cx = -1.5, cz = 1.0, r = 9.5;
      this.pos.set(cx + Math.sin(this.orbitT) * r, 4.6, cz + Math.cos(this.orbitT) * r);
      this.look.set(cx, 0.9, cz - 1);
      cam.position.copy(this.pos); cam.lookAt(this.look);
      return;
    }
    if (this.mode === 'shot') {
      const k = this.snap ? 1e3 : this.shot.k; this.snap = false;
      this.pos.x = damp(this.pos.x, this.shot.pos.x, k, dt); this.pos.y = damp(this.pos.y, this.shot.pos.y, k, dt); this.pos.z = damp(this.pos.z, this.shot.pos.z, k, dt);
      this.look.x = damp(this.look.x, this.shot.target.x, k, dt); this.look.y = damp(this.look.y, this.shot.target.y, k, dt); this.look.z = damp(this.look.z, this.shot.target.z, k, dt);
      cam.position.copy(this.pos); cam.lookAt(this.look);
      this.yaw = Math.atan2(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
      return;
    }
    // follow
    const sens = settings.sensitivity || 1;
    if (input) {
      const d = input.consumeLook();
      if (d.x || d.y) {
        this.yaw -= d.x * 0.0058 * sens;
        this.pitch += d.y * 0.0042 * sens * (settings.invertY ? -1 : 1);
        this.pitch = clamp(this.pitch, CONFIG.CAMERA.minPitch, CONFIG.CAMERA.maxPitch);
        this.lastLook = performance.now();
      }
      // gentle auto-align behind the player while walking (never fights the thumb)
      const mv = input.getMove();
      if (mv.mag > 0.3 && player.state === 'free' && performance.now() - this.lastLook > 1400) {
        const behind = player.yaw + Math.PI;
        const diff = Math.abs(wrapAngle(behind - this.yaw));
        if (diff < 2.3) this.yaw = dampAngle(this.yaw, behind, 0.9 * mv.mag, dt);
      }
    }
    const seated = player.state === 'seated';
    const h = seated ? 1.2 : CONFIG.CAMERA.height;
    const wantDist = seated ? 1.9 : this.dist;
    const target = v1.set(player.pos.x, h, player.pos.z);
    const pitch = seated ? Math.max(this.pitch, 0.28) : this.pitch;
    dir.set(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    const hit = rayCast(target, dir, wantDist + 0.3, this.world.colliders);
    const allowed = Math.max(0.35, Math.min(wantDist, hit - 0.28));
    if (allowed < this.curDist || this.snap) this.curDist = allowed; else this.curDist = damp(this.curDist, allowed, 4, dt);
    const desired = v2.copy(target).addScaledVector(dir, this.curDist);
    desired.y = clamp(desired.y, 0.4, 2.8);
    const k = this.snap ? 1e3 : 14; this.snap = false;
    this.pos.x = damp(this.pos.x, desired.x, k, dt); this.pos.y = damp(this.pos.y, desired.y, k, dt); this.pos.z = damp(this.pos.z, desired.z, k, dt);
    this.look.x = damp(this.look.x, target.x, 16, dt); this.look.y = damp(this.look.y, target.y + 0.05, 16, dt); this.look.z = damp(this.look.z, target.z, 16, dt);
    cam.position.copy(this.pos);
    if (this.shake > 0 && !reducedMotion) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.08; cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    cam.lookAt(this.look);
    player.ch.mesh.visible = this.curDist > 0.62;
  }
}
