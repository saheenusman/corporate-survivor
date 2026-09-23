// Player controller: camera-relative movement, acceleration, turning, sitting,
// scripted walks (e.g. into the elevator) and stat-driven body language.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { damp, dampAngle, clamp } from '../core/util.js';
import { resolveCircle, pushFromCircles } from '../world/collision.js';
import { Audio } from '../audio/audio.js';
import { G } from '../state/game-state.js';

export class Player {
  constructor(character, world) {
    this.ch = character;
    this.world = world;
    this.vel = new THREE.Vector3();
    this.state = 'free';
    this.seat = null;
    this.script = null;
    this.targetYaw = character.yaw;
    this.stepFlip = false;
    character.anim.onStep = () => { if (this.state === 'free' || this.state === 'scripted') Audio.play('step'); };
  }
  get pos() { return this.ch.group.position; }
  get yaw() { return this.ch.yaw; }

  place(x, z, yaw) { this.pos.set(x, 0, z); this.ch.setYaw(yaw); this.targetYaw = yaw; this.vel.set(0, 0, 0); }

  sit(seat, pose = 'sit') {
    this.state = 'seated'; this.seat = seat;
    this.pos.set(seat.x, 0, seat.z); this.ch.setYaw(seat.yaw); this.targetYaw = seat.yaw;
    this.vel.set(0, 0, 0); this.ch.anim.speed = 0;
    this.ch.anim.setBase(pose);
  }
  stand() {
    if (this.state !== 'seated') return;
    const s = this.seat;
    this.state = 'free';
    this.pos.x = s.x - Math.sin(s.yaw) * 0.55; this.pos.z = s.z - Math.cos(s.yaw) * 0.55;
    this.ch.anim.setBase('idle');
    this.seat = null;
  }
  walkTo(points, onDone, speed = 1.6) { this.state = 'scripted'; this.script = { points: points.slice(), onDone, speed }; }

  update(dt, input, camYaw, npcCircles) {
    const anim = this.ch.anim;
    const st = G.state.stats;
    if (this.state === 'free') {
      const m = input.getMove();
      let speed = 0;
      const tired = st.energy < 12;
      if (m.mag > 0.12) speed = (m.run && !tired ? CONFIG.PLAYER.run : CONFIG.PLAYER.walk * clamp(m.mag * 1.25, 0.45, 1)) * (tired ? 0.7 : 1);
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      let dx = fx * m.y + rx * m.x, dz = fz * m.y + rz * m.x;
      const dl = Math.hypot(dx, dz);
      if (dl > 1e-4) { dx /= dl; dz /= dl; this.targetYaw = Math.atan2(dx, dz); }
      this.vel.x = damp(this.vel.x, dx * speed, speed > this.vel.length() ? 10 : 14, dt);
      this.vel.z = damp(this.vel.z, dz * speed, speed > this.vel.length() ? 10 : 14, dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      pushFromCircles(this.pos, CONFIG.PLAYER.radius, npcCircles);
      resolveCircle(this.pos, CONFIG.PLAYER.radius, this.world.colliders);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.2) this.ch.setYaw(dampAngle(this.ch.yaw, this.targetYaw, 12, dt));
      anim.speed = sp;
      if (anim.base !== 'phone' && anim.base !== 'drink') anim.setBase(st.energy < 25 ? 'tired' : 'idle');
    } else if (this.state === 'seated') {
      anim.speed = 0;
    } else if (this.state === 'scripted') {
      const s = this.script;
      const p = s.points[0];
      if (!p) { this.state = 'locked'; anim.speed = 0; s.onDone && s.onDone(); }
      else {
        const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { s.points.shift(); if (p.yaw !== undefined) this.targetYaw = p.yaw; }
        else {
          const v = Math.min(s.speed, d / dt);
          this.pos.x += (dx / d) * v * dt; this.pos.z += (dz / d) * v * dt;
          this.targetYaw = Math.atan2(dx, dz);
          anim.speed = s.speed;
        }
        this.ch.setYaw(dampAngle(this.ch.yaw, this.targetYaw, 8, dt));
      }
    } else {
      anim.speed = damp(anim.speed, 0, 10, dt);
      this.ch.setYaw(dampAngle(this.ch.yaw, this.targetYaw, 6, dt));
    }
    anim.setMood(st.sanity < 25 ? 'worried' : st.energy < 30 ? 'tired' : 'neutral');
    this.ch.update(dt);
  }
}
