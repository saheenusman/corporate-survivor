// Procedural, blendable animation.
// Every state is a function returning bone rotations relative to the bind pose.
// States cross-fade with exponential weights so characters never snap between poses.
// Faces are driven separately: expression targets + blinking + lip flap while talking.
import { clamp, damp, wrapAngle } from '../core/util.js';

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const sin = Math.sin, cos = Math.cos, max = Math.max, abs = Math.abs;

// Legs for seated poses: seat top ~0.45m, feet on the floor.
const SIT_LEGS = { thighL: [-1.52, 0, 0.05], thighR: [-1.52, 0, -0.05], shinL: [1.42, 0, 0], shinR: [1.42, 0, 0], footL: [0.08, 0, 0], footR: [0.08, 0, 0], hy: -0.4 };

function idleBase(t) {
  const b = sin(t * 1.7) * 0.022, sway = sin(t * 0.45);
  return {
    hips: [0, 0, sway * 0.018], spine: [0.02, 0, -sway * 0.012], chest: [b * 0.7, 0, 0],
    head: [0.03 + sin(t * 0.6) * 0.02, sin(t * 0.29) * 0.1, 0],
    armL: [0.03, 0, 0.1 + b], armR: [0.03, 0, -0.1 - b], foreL: [-0.16, 0, 0], foreR: [-0.16, 0, 0],
    thighL: [0, 0, 0.025 + sway * 0.012], thighR: [0, 0, -0.025 + sway * 0.012],
  };
}

function walkCycle(c, run) {
  const p = c.phase, s = sin(p), co = cos(p);
  const a = run ? 1 : clamp(c.speed / 1.4, 0.35, 1);
  if (run) {
    return {
      hips: [0, -s * 0.14, 0], spine: [0.2, s * 0.08, 0], chest: [0.02, s * 0.12, 0], head: [-0.14, -s * 0.1, 0],
      thighL: [-0.85 * s, 0, 0.03], thighR: [0.85 * s, 0, -0.03],
      shinL: [0.25 + 1.25 * max(0, co), 0, 0], shinR: [0.25 + 1.25 * max(0, -co), 0, 0],
      footL: [-0.35 * s, 0, 0], footR: [0.35 * s, 0, 0],
      armL: [0.75 * s, 0, 0.12], armR: [-0.75 * s, 0, -0.12], foreL: [-1.25, 0, 0], foreR: [-1.25, 0, 0],
      hy: -0.05 + 0.07 * abs(co),
    };
  }
  const thL = -0.5 * s * a, thR = 0.5 * s * a;
  const shL = (0.08 + 0.72 * max(0, co)) * a, shR = (0.08 + 0.72 * max(0, -co)) * a;
  return {
    hips: [0, -s * 0.1 * a, 0], spine: [0.05, s * 0.05 * a, 0], chest: [0, s * 0.08 * a, 0], head: [-0.02, -s * 0.07 * a, 0],
    thighL: [thL, 0, 0.02], thighR: [thR, 0, -0.02], shinL: [shL, 0, 0], shinR: [shR, 0, 0],
    footL: [-(thL + shL) * 0.7, 0, 0], footR: [-(thR + shR) * 0.7, 0, 0],
    armL: [0.42 * s * a, 0, 0.09], armR: [-0.42 * s * a, 0, -0.09],
    foreL: [-0.2 - 0.3 * max(0, -s) * a, 0, 0], foreR: [-0.2 - 0.3 * max(0, s) * a, 0, 0],
    hy: (-0.02 + 0.035 * abs(co)) * a,
  };
}

const POSES = {
  idle: (t) => idleBase(t),
  walk: (t, c) => walkCycle(c, false),
  run: (t, c) => walkCycle(c, true),
  tired: (t) => ({
    hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.08 + sin(t * 1.1) * 0.03, 0, 0], head: [0.32 + sin(t * 0.7) * 0.05, 0, 0],
    armL: [0.06, 0, 0.05], armR: [0.06, 0, -0.05], foreL: [-0.06, 0, 0], foreR: [-0.06, 0, 0],
    thighL: [-0.06, 0, 0.02], thighR: [-0.06, 0, -0.02], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], hy: -0.012,
  }),
  talk: (t) => {
    const b = idleBase(t);
    return {
      ...b,
      armR: [-0.38 - 0.2 * sin(t * 2.1), 0, -0.2], foreR: [-0.95 - 0.25 * sin(t * 2.9), 0.3, 0], handR: [0, 0, 0.3],
      armL: [-0.08, 0, 0.14 + 0.05 * sin(t * 1.7)], foreL: [-0.45 - 0.1 * sin(t * 2.3), 0, 0],
      head: [0.02 + 0.05 * sin(t * 3.3), 0.08 * sin(t * 1.3), 0.03 * sin(t * 0.9)],
    };
  },
  listen: (t) => {
    const b = idleBase(t);
    return { ...b, head: [0.05 + 0.03 * sin(t * 1.2), 0, 0.06], armL: [-0.1, 0, 0.12], foreL: [-0.9, 0.4, 0], armR: [-0.1, 0, -0.12], foreR: [-0.9, -0.4, 0] };
  },
  phone: (t) => {
    const b = idleBase(t);
    return { ...b, spine: [0.06, 0, 0], head: [0.4, 0, 0], armR: [-0.52, 0, -0.08], foreR: [-1.4, 0.25, 0], handR: [0.25, 0, 0], armL: [0.02, 0, 0.1], foreL: [-0.25, 0, 0] };
  },
  drink: (t) => {
    const b = idleBase(t);
    const cyc = (t % 4.2) / 4.2;
    const l = cyc < 0.25 ? 0 : cyc < 0.45 ? (cyc - 0.25) / 0.2 : cyc < 0.7 ? 1 : cyc < 0.9 ? 1 - (cyc - 0.7) / 0.2 : 0;
    const e = l * l * (3 - 2 * l);
    return { ...b, armR: [-0.3 - 0.75 * e, 0, -0.16 - 0.1 * e], foreR: [-1.25 - 0.75 * e, 0.25, 0], head: [0.04 - 0.22 * e, 0, 0], armL: [0.02, 0, 0.1], foreL: [-0.2, 0, 0] };
  },
  surprised: (t) => ({
    spine: [-0.12, 0, 0], chest: [-0.05, 0, 0], head: [-0.14, 0, 0],
    armL: [-0.45, 0, 0.6], armR: [-0.45, 0, -0.6], foreL: [-1.15, 0, 0], foreR: [-1.15, 0, 0], handL: [0, 0, 0.4], handR: [0, 0, -0.4],
    thighL: [0, 0, 0.05], thighR: [0, 0, -0.05], hy: 0.015,
  }),
  frustrated: (t) => ({
    spine: [0.14, 0, 0], chest: [0.06, 0, 0], neck: [0.1, 0, 0], head: [0.25, 0.14 * sin(t * 7), 0],
    armR: [-1.62, 0, -0.12], foreR: [-1.95, 0, 0], handR: [0.3, 0, 0],
    armL: [0.05, 0, 0.14], foreL: [-0.5, 0, 0], thighL: [0, 0, 0.04], thighR: [0, 0, -0.04],
  }),
  celebrate: (t) => ({
    spine: [-0.1, 0, 0], head: [-0.2, 0, 0.05 * sin(t * 6)],
    armL: [-0.2, 0, 2.55 + 0.12 * sin(t * 9)], armR: [-0.2, 0, -2.55 - 0.12 * sin(t * 9 + 1)], foreL: [-0.35, 0, 0], foreR: [-0.35, 0, 0],
    thighL: [-0.1, 0, 0.05], thighR: [-0.1, 0, -0.05], shinL: [0.2, 0, 0], shinR: [0.2, 0, 0], hy: 0.06 * abs(sin(t * 6.5)) - 0.02,
  }),
  sit: (t) => ({
    ...SIT_LEGS, spine: [-0.05, 0, 0], chest: [sin(t * 1.6) * 0.02, 0, 0], head: [0.06, sin(t * 0.3) * 0.15, 0],
    armL: [-0.42, 0, 0.12], armR: [-0.42, 0, -0.12], foreL: [-0.85, 0, 0], foreR: [-0.85, 0, 0],
  }),
  type: (t) => ({
    ...SIT_LEGS, spine: [0.1, 0, 0], chest: [0.04, 0, 0], head: [0.12 + sin(t * 0.8) * 0.02, sin(t * 0.37) * 0.06, 0],
    armL: [-0.62, 0, 0.2], armR: [-0.62, 0, -0.2],
    foreL: [-1.0 + 0.05 * sin(t * 17), 0.15, 0], foreR: [-1.0 + 0.05 * sin(t * 15 + 1.3), -0.15, 0],
    handL: [0.25, 0, 0], handR: [0.25, 0, 0],
  }),
  sitTalk: (t) => ({
    ...SIT_LEGS, spine: [-0.02, 0, 0], head: [0.02 + 0.04 * sin(t * 3.1), 0.06 * sin(t * 1.3), 0],
    armL: [-0.42, 0, 0.12], foreL: [-0.85, 0, 0],
    armR: [-0.5 - 0.15 * sin(t * 2.2), 0, -0.2], foreR: [-1.1 - 0.2 * sin(t * 2.8), 0.3, 0],
  }),
  sitPhone: (t) => ({
    ...SIT_LEGS, spine: [0.08, 0, 0], head: [0.42, 0, 0],
    armL: [-0.42, 0, 0.12], foreL: [-0.85, 0, 0],
    armR: [-0.5, 0, -0.08], foreR: [-1.45, 0.25, 0], handR: [0.25, 0, 0],
  }),
  sleep: (t) => ({
    ...SIT_LEGS, spine: [0.45, 0, 0], chest: [0.15 + sin(t * 0.9) * 0.03, 0, 0], head: [0.35, 0.3, 0.2],
    armL: [-1.0, 0, 0.3], foreL: [-1.3, 0.9, 0], armR: [-1.0, 0, -0.3], foreR: [-1.3, -0.9, 0],
  }),
};

export const EXPR = {
  neutral: { brow: 0, browY: 0, smile: 0.12, open: 0, eye: 1 },
  happy: { brow: 0.1, browY: 0.004, smile: 0.85, open: 0.2, eye: 0.85 },
  sad: { brow: 0.75, browY: 0, smile: -0.5, open: 0, eye: 0.8 },
  tired: { brow: 0.35, browY: -0.004, smile: -0.2, open: 0, eye: 0.5 },
  angry: { brow: -0.85, browY: -0.006, smile: -0.5, open: 0.1, eye: 0.85 },
  surprised: { brow: 0.5, browY: 0.014, smile: 0, open: 1, eye: 1.3 },
  worried: { brow: 0.65, browY: 0.006, smile: -0.28, open: 0.1, eye: 1.05 },
  smug: { brow: -0.25, browY: 0, smile: 0.55, open: 0, eye: 0.72 },
  sleep: { brow: 0.1, browY: -0.004, smile: 0, open: 0.25, eye: 0.08 },
};

const ANIM_EXPR = { surprised: 'surprised', frustrated: 'angry', celebrate: 'happy', tired: 'tired', sleep: 'sleep' };

export class Animator {
  constructor(ch) {
    this.ch = ch;
    this.base = 'idle';
    this.w = { idle: 1 };
    this.t = Math.random() * 20;
    this.phase = 0;
    this.speed = 0;
    this.oneShot = null; this.oneShotT = 0;
    this.exprName = 'neutral'; this.expr = { ...EXPR.neutral };
    this.moodExpr = 'neutral';
    this.talking = 0; this.talkTarget = 0;
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    this.lookTarget = null; this.lookYaw = 0;
    this.acc = {};
    for (const b of BONES) this.acc[b] = [0, 0, 0];
    this.onStep = null;
  }

  setBase(name) { if (POSES[name]) this.base = name; }
  playOnce(name, dur = 1.5) { if (POSES[name]) { this.oneShot = name; this.oneShotT = dur; } }
  setMood(expr) { this.moodExpr = EXPR[expr] ? expr : 'neutral'; }
  setTalking(on) { this.talkTarget = on ? 1 : 0; }
  get isSeatedPose() { return ['sit', 'type', 'sitTalk', 'sitPhone', 'sleep'].includes(this.base); }

  update(dt) {
    this.t += dt;
    const sp = this.speed;
    const stride = sp > 3 ? 2.1 : 1.3;
    const prev = this.phase;
    this.phase += dt * sp * (Math.PI * 2) / stride;
    if (this.onStep && sp > 0.4 && Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) this.onStep();

    if (this.oneShot) { this.oneShotT -= dt; if (this.oneShotT <= 0) this.oneShot = null; }
    let target = this.base;
    if (sp > 0.25) target = sp > 3.0 ? 'run' : 'walk';
    else if (this.oneShot) target = this.oneShot;

    if (!(target in this.w)) this.w[target] = 0;
    let total = 0;
    for (const k in this.w) {
      this.w[k] = damp(this.w[k], k === target ? 1 : 0, 9, dt);
      if (k !== target && this.w[k] < 0.002) delete this.w[k];
      else total += this.w[k];
    }

    const acc = this.acc;
    for (const b of BONES) { const a = acc[b]; a[0] = 0; a[1] = 0; a[2] = 0; }
    let hy = 0;
    const ctx = { phase: this.phase, speed: sp };
    for (const k in this.w) {
      const wt = this.w[k] / total;
      const p = POSES[k](this.t, ctx);
      for (const b in p) {
        if (b === 'hy') { hy += p.hy * wt; continue; }
        const a = acc[b]; if (!a) continue;
        const v = p[b];
        a[0] += v[0] * wt; a[1] += v[1] * wt; a[2] += v[2] * wt;
      }
    }

    // Head look-at (yaw only) layered on top.
    if (this.lookTarget) {
      const g = this.ch.group.position;
      const desired = wrapAngle(Math.atan2(this.lookTarget.x - g.x, this.lookTarget.z - g.z) - this.ch.yaw);
      this.lookYaw = damp(this.lookYaw, clamp(desired, -1.15, 1.15), 6, dt);
    } else this.lookYaw = damp(this.lookYaw, 0, 4, dt);
    acc.head[1] += this.lookYaw * 0.6;
    acc.neck[1] += this.lookYaw * 0.4;

    const B = this.ch.bones;
    for (const b of BONES) { const a = acc[b]; B[b].rotation.set(a[0], a[1], a[2]); }
    B.hips.position.y = this.ch.restHipsY + hy;

    this.updateFace(dt, target);
  }

  updateFace(dt, target) {
    const name = ANIM_EXPR[target] || this.exprName;
    const want = EXPR[name] || EXPR.neutral;
    const mood = EXPR[this.moodExpr];
    const e = this.expr;
    const k = 8;
    // mood colours the neutral face (e.g. tired eyes when energy is low)
    const baseW = name === 'neutral' ? 1 : 0;
    for (const key of ['brow', 'browY', 'smile', 'open', 'eye']) {
      const target = want[key] * (1 - baseW * 0.6) + mood[key] * baseW * 0.6;
      e[key] = damp(e[key], target, k, dt);
    }
    this.talking = damp(this.talking, this.talkTarget, 12, dt);
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt * 8);

    const B = this.ch.bones;
    const bl = this.blink > 0.5 ? 1 - (this.blink - 0.5) * 2 : this.blink * 2;
    const eyeS = Math.max(0.06, e.eye * (1 - bl * 0.94));
    B.eyeL.scale.y = eyeS; B.eyeR.scale.y = eyeS;
    B.browL.rotation.z = -e.brow * 0.45; B.browR.rotation.z = e.brow * 0.45;
    B.browL.position.y = 0.2 + e.browY; B.browR.position.y = 0.2 + e.browY;
    const talkOpen = this.talking * (0.35 + 0.35 * Math.sin(this.t * 17) * Math.sin(this.t * 5.3));
    const open = Math.max(0, e.open + talkOpen);
    B.mouthL.rotation.z = e.smile * 0.5; B.mouthR.rotation.z = -e.smile * 0.5;
    const sy = 1 + open * 3.2, sx = 1 - open * 0.3;
    B.mouthL.scale.set(sx, sy, 1); B.mouthR.scale.set(sx, sy, 1);
  }
}

export const POSE_NAMES = Object.keys(POSES);
