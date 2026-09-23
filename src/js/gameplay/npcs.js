// NPC agents. Each NPC follows a daily schedule of named spots, walks the nav
// graph between them, and can be temporarily taken over by the story director
// ("override") for scripted beats such as walking up to the player.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { SPOTS, NODES, findPath, nearestNode } from '../world/nav.js';
import { damp, dampAngle } from '../core/util.js';

const POSE_PROP = { drink: 'cup', phone: 'phone', sitPhone: 'phone' };

export class NPC {
  constructor(id, ch, world, schedule) {
    this.id = id; this.ch = ch; this.world = world;
    this.schedule = schedule || [];
    this.path = []; this.state = 'idle';
    this.at = null; this.node = null; this.goal = null;
    this.targetYaw = 0; this.speed = CONFIG.NPC.walk;
    this.override = false; this.busy = false;
    this.hidden = false; this.onArrive = null;
    this.schedSpot = null;
    this.lookAtPlayer = true;
  }
  get pos() { return this.ch.group.position; }

  hide() { this.hidden = true; this.ch.group.visible = false; this.state = 'idle'; this.path = []; }
  show() { this.hidden = false; this.ch.group.visible = true; }

  place(spotName) {
    const s = typeof spotName === 'string' ? SPOTS[spotName] : spotName;
    this.pos.set(s.x, 0, s.z); this.ch.setYaw(s.yaw ?? 0); this.targetYaw = s.yaw ?? 0;
    this.at = typeof spotName === 'string' ? spotName : null;
    this.node = s.node || nearestNode(s.x, s.z);
    this.path = []; this.state = 'idle';
    if (s.hidden) this.hide(); else this.show();
    this.arrivePose(s);
  }

  arrivePose(s) {
    const pose = s.pose || 'idle';
    this.ch.anim.setBase(pose);
    this.ch.anim.speed = 0;
    this.ch.hideAllProps();
    let prop = s.prop || POSE_PROP[pose];
    if (prop === 'cup' && !this.ch.props.cup && this.ch.props.mug) prop = 'mug';
    if (prop) this.ch.showProp(prop, true);
    if (this.ch.props.clipboard) this.ch.showProp('clipboard', true);
  }

  goTo(target, opts = {}) {
    const s = typeof target === 'string' ? SPOTS[target] : target;
    if (!s) return;
    const startNode = this.node || nearestNode(this.pos.x, this.pos.z);
    const endNode = s.node || nearestNode(s.x, s.z);
    const nodes = findPath(startNode, endNode) || [endNode];
    const pts = nodes.map((n) => ({ x: NODES[n][0], z: NODES[n][1] }));
    // Skip the first node when we're already standing past it (avoids back-tracking).
    if (pts.length > 1 && !this.at) {
      const d0 = Math.hypot(pts[0].x - this.pos.x, pts[0].z - this.pos.z);
      const d1 = Math.hypot(pts[1].x - this.pos.x, pts[1].z - this.pos.z);
      const d01 = Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z);
      if (d1 < d01 && d0 < 3) pts.shift();
    }
    if (s.viaX !== undefined) pts.push({ x: s.viaX, z: s.z });
    pts.push({ x: s.x, z: s.z });
    if (this.hidden) {
      this.show();
      this.pos.set(SPOTS.offstage.x, 0, SPOTS.offstage.z);
      this.world.openElevator(4);
    }
    this.path = pts; this.state = 'walk';
    this.goal = s; this.at = typeof target === 'string' ? target : null;
    this.node = null;
    this.speed = opts.hurry ? CONFIG.NPC.hurry : CONFIG.NPC.walk;
    this.onArrive = opts.onArrive || null;
    this.ch.anim.setBase('idle');
    this.ch.hideAllProps();
    if (this.ch.props.clipboard) this.ch.showProp('clipboard', true);
  }

  scheduleAt(time) {
    let cur = null;
    for (const e of this.schedule) if (e[0] <= time) cur = e; else break;
    return cur;
  }

  update(dt, playerPos) {
    if (this.hidden) return;
    const anim = this.ch.anim;
    if (this.state === 'walk' && !this.busy) {
      const p = this.path[0];
      if (!p) {
        this.state = 'idle';
        const g = this.goal;
        this.node = g.node || nearestNode(g.x, g.z);
        this.targetYaw = g.yaw ?? this.ch.yaw;
        if (g.x !== undefined) this.pos.set(g.x, 0, g.z);
        this.arrivePose(g);
        if (g.hidden) this.hide();
        const cb = this.onArrive; this.onArrive = null;
        if (cb) cb(this);
      } else {
        const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.1) this.path.shift();
        else {
          const v = Math.min(this.speed, d / Math.max(dt, 1e-3));
          this.pos.x += (dx / d) * v * dt; this.pos.z += (dz / d) * v * dt;
          this.targetYaw = Math.atan2(dx, dz);
          this.ch.setYaw(dampAngle(this.ch.yaw, this.targetYaw, 9, dt));
        }
        anim.speed = damp(anim.speed, this.speed, 8, dt);
        if (this.goal && this.goal.hidden && Math.hypot(this.pos.x - 1.5, this.pos.z - 11.2) < 2.4) this.world.openElevator(3);
      }
    } else {
      anim.speed = damp(anim.speed, 0, 10, dt);
      this.ch.setYaw(dampAngle(this.ch.yaw, this.targetYaw, 5, dt));
    }
    // glance at the player when nearby
    if (playerPos && this.lookAtPlayer) {
      const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      anim.lookTarget = d < 3.2 || this.busy ? playerPos : null;
    }
    this.ch.update(dt);
  }
}

export class NPCManager {
  constructor(world) { this.world = world; this.list = []; this.map = {}; }
  add(npc) { this.list.push(npc); this.map[npc.id] = npc; }
  get(id) { return this.map[id]; }

  // Keep NPCs on their schedule unless the director has taken control.
  tickSchedules(time) {
    for (const n of this.list) {
      if (n.override || n.busy) continue;
      const e = n.scheduleAt(time);
      if (!e) continue;
      const key = e[1] + '|' + (e[2] || '');
      if (key !== n.schedSpot) {
        n.schedSpot = key;
        const spot = { ...SPOTS[e[1]] };
        if (e[2]) spot.pose = e[2];
        if (n.at === e[1] && n.state === 'idle') { n.arrivePose(spot); continue; }
        n.goTo(Object.assign(spot, { name: e[1] }));
        n.at = e[1];
      }
    }
  }

  // After a time skip (work montage, meeting) teleport everyone to where they should be.
  snapToSchedule(time) {
    for (const n of this.list) {
      if (n.override || n.busy) continue;
      const e = n.scheduleAt(time);
      if (!e) continue;
      const spot = { ...SPOTS[e[1]] };
      if (e[2]) spot.pose = e[2];
      n.place(spot); n.at = e[1];
      n.schedSpot = e[1] + '|' + (e[2] || '');
    }
  }

  update(dt, playerPos) { for (const n of this.list) n.update(dt, playerPos); }

  circles() {
    const out = [];
    for (const n of this.list) if (!n.hidden) out.push({ x: n.pos.x, z: n.pos.z, r: 0.28 });
    return out;
  }
}
