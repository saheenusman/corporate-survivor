// The director runs the day: clock, stat drift, timeline beats, NPCs walking up
// to the player ("THREAT DETECTED"), the manager hunting for someone to give
// "one more quick thing" to, overheard conversations, ambient barks, the
// incident, and every way of leaving the building.
import { CONFIG, T, fmtTime } from '../config.js';
import { G, applyFx, hasTask, completeTask, stat } from '../state/game-state.js';
import { SCENES, BARKS } from '../story/schedules.js';
import { REQUEST_POOL } from '../story/objects.js';
import { SPOTS, NODES, nearestNode } from '../world/nav.js';
import { Audio } from '../audio/audio.js';
import { bus } from '../core/events.js';
import { pick, clamp } from '../core/util.js';

// Beats that time skips (work montages) are not allowed to jump over.
const HARD_BEATS = [T(9, 0), T(11, 0), T(15, 0), T(16, 20), T(16, 45), T(16, 50), T(17, 30)];

export class Director {
  constructor(game) {
    this.game = game;
    this.approaching = null;
    this.queue = [];
    this.hrWalking = false;
    this.sceneState = {};
    this.barkCd = {}; this.barkGlobal = 0; this.barkAcc = 0;
    this.objAcc = 0; this.lastReqTime = 0;
    this.events = this.buildEvents();
    this.saveAcc = 0;
  }

  get s() { return G.state; }

  // ------------------------------------------------------------ timeline
  buildEvents() {
    const g = this.game;
    return [
      { id: 'mgr_morning', t: T(9, 0), until: T(10, 30), run: () => this.approach('manager', 'mgr_morning', { threat: true }) },
      { id: 'meeting_ping', t: T(9, 55), run: () => { Audio.play('ping'); g.ui.toast('📅 SYNERGY ALIGNMENT SESSION starts in 5 min (mandatory)', 'task'); } },
      { id: 'meeting_skip', t: T(10, 20), when: () => !this.s.flags.attendedMeeting, run: () => { applyFx({ trust: -6, flag: 'skippedMeeting' }); g.ui.toast('Mr. Menon noticed your empty chair.'); } },
      { id: 'mgr_config', t: T(11, 0), until: T(12, 15), run: () => this.approach('manager', 'mgr_config', { threat: true }) },
      { id: 'anu_print', t: T(11, 40), until: T(13, 30), run: () => this.approach('anu', 'anu_print', { threat: false }) },
      { id: 'act2', t: T(12, 0), run: () => this.setAct(2) },
      { id: 'mgr_deploys', t: T(12, 5), when: () => !this.s.flags.deployedByPlayer, run: () => {
        applyFx({ flag: 'managerDeployed' }, { silent: true });
        if (hasTask('config')) { completeTask('config'); this.s.counters.tasksDone--; g.ui.toast('Mr. Menon deployed the config himself. "Teamwork!"'); }
      } },
      { id: 'support_ping', t: T(13, 5), run: () => { Audio.play('ping'); g.ui.toast('Support: "Why is my air fryer ₹0?" (×214)'); } },
      { id: 'hr_walk', t: T(13, 30), until: T(14, 30), run: () => this.hrWalk() },
      { id: 'no_lunch', t: T(14, 30), when: () => !this.s.flags.ateLunch, run: () => { applyFx({ energy: -8, sanity: -4 }); g.ui.toast('You skipped lunch. Your stomach files a complaint.'); } },
      { id: 'incident', t: T(15, 0), run: () => this.incident() },
      { id: 'prod_timeout', t: T(16, 30), when: () => !this.s.flags.prodFixed, run: () => { this.fixProd('nephew'); } },
      { id: 'blame', t: T(16, 20), until: T(16, 44), run: () => this.approach('manager', 'blame', { threat: true, force: true }) },
      { id: 'act4', t: T(16, 45), run: () => this.setAct(4) },
      { id: 'mgr_last', t: T(16, 50), until: T(17, 0), when: () => !this.s.flags.reportedToHR, run: () => this.approach('manager', 'mgr_lastthing', { threat: true }) },
      { id: 'rahul_leaving', t: T(16, 58), until: T(17, 5), when: () => this.distTo('rahul') < 9, run: () => this.approach('rahul', 'rahul_leaving', { threat: false, giveUp: 8 }) },
      { id: 'day_end', t: T(17, 30), run: () => this.game.endDay('overtime') },
    ];
  }

  setAct(n) {
    const s = this.s; if (s.act >= n) return;
    s.act = n;
    const titles = { 2: 'Something Is Wrong', 3: 'The Incident', 4: 'Escape' };
    this.game.ui.actCard(`Act ${n}`, titles[n], fmtTime(s.time));
    Audio.play('whoosh');
    if (n === 4) { Audio.setMood('evening'); this.game.ui.hint('Get out. Elevator or stairs. Avoid Mr. Menon.'); }
    bus.emit('state-changed');
  }

  // ------------------------------------------------------------ per-frame
  update(dt) {
    const g = this.game, s = this.s;
    if (!g.locked) {
      // clock + stat drift
      const dm = dt / CONFIG.SECONDS_PER_MINUTE;
      s.time += dm;
      this.drift(dm);
      // timeline
      for (const e of this.events) {
        if (s.fired.includes(e.id) || s.time < e.t) continue;
        if (e.until && s.time > e.until) { s.fired.push(e.id); continue; }
        if (e.when && !e.when()) { if (!e.until) s.fired.push(e.id); continue; }
        if (this.approaching && e.run !== undefined && ['mgr_morning', 'mgr_config', 'anu_print', 'blame', 'mgr_last', 'rahul_leaving', 'hr_walk'].includes(e.id)) continue;
        s.fired.push(e.id);
        e.run();
        break;
      }
      if (!this.approaching && this.queue.length) this.approach(...this.queue.shift());
      if (s.flags.reportedToHR && !s.flags.mgrGone) { const m = g.npcs.get('manager'); if (!m.busy && this.approaching?.npc !== m) this.release(m); }
      this.limits();
      this.hunt();
    }
    this.updateApproach(dt);
    this.updateScenes(dt);
    this.updateBarks(dt);
    this.objAcc += dt;
    if (this.objAcc > 0.5) { this.objAcc = 0; g.ui.setObjective(this.objective()); this.checkCounters(); }
    this.saveAcc += dt;
    if (this.saveAcc > 25 && !g.locked) { this.saveAcc = 0; g.save(); }
  }

  drift(dm) {
    const st = this.s.stats;
    stat('energy', -0.085 * dm);
    stat('bladder', 0.1 * dm);
    stat('workload', 0.02 * dm);
    const stress = 0.012 + Math.max(0, st.workload - 60) * 0.0011 + (st.bladder > 85 ? 0.05 : 0) + (st.energy < 15 ? 0.03 : 0);
    stat('sanity', -stress * dm);
    if (st.bladder > 85 && !this.s.flags.bladderWarned) { this.s.flags.bladderWarned = true; this.game.ui.toast('You really need the restroom. (East side.)'); }
    if (st.bladder < 50) this.s.flags.bladderWarned = false;
  }

  limits() {
    const s = this.s, g = this.game;
    if (s.stats.energy <= 0.5 && !g.locked) {
      g.run(async () => {
        await g.say('passout');
        await g.ui.fade(true); g.skipTime(45); stat('energy', 38 - s.stats.energy);
        applyFx({ reputation: -8, trust: -6 }); await g.ui.fade(false);
      });
    } else if (s.stats.sanity <= 0.5 && !g.locked) {
      const second = !!s.flags.meltdown;
      applyFx({ flag: 'meltdown', chaos: 2 }, { silent: true });
      g.run(async () => {
        g.cam.shake = 1;
        await g.say(second ? 'meltdown2' : 'meltdown');
        if (!second) { stat('sanity', 35); applyFx({ reputation: -8 }); }
      });
    }
  }

  checkCounters() {
    const c = this.s.counters, a = [];
    if (c.coffees >= 4) a.push('COFFEE_ADDICT');
    if (c.dodged >= 3) a.push('DO_NOT_DISTURB');
    if (c.printerFails >= 3) a.push('PRINTER_ENEMY');
    if (c.sure >= 5) a.push('GOT_A_MINUTE');
    if (this.s.jokes.length >= 10) a.push('ARCHAEOLOGIST');
    for (const id of a) if (!G.meta.achievements.includes(id)) bus.emit('achievement', id);
  }

  objective() {
    const s = this.s, f = s.flags, t = s.time;
    if (this.approaching?.threat) return this.approaching.npc.id === 'manager' ? 'Mr. Menon is coming. Talk to him… or walk away fast.' : 'Someone is coming your way.';
    if (!f.atDesk && t < T(9, 40)) return 'Get to your desk. Avoid eye contact.';
    if (s.act >= 4) return f.acceptedLast ? 'Leave anyway. Singapore can wait until 9.' : 'Leave the office. Elevator or stairs.';
    if (f.incident && !f.prodFixed) return 'Production is down. Fix it before 4:30. Ask around.';
    if (t >= T(9, 55) && t < T(10, 45) && !f.attendedMeeting && !f.skippedMeeting) return 'Join the 10:00 meeting — glass room, west side.';
    if (s.stats.bladder > 85) return 'Find the restroom — east side, past the sofas.';
    if (s.stats.energy < 22) return 'Get coffee (north wall) before you fall asleep.';
    if (!f.ateLunch && t >= T(12, 0) && t <= T(14, 30)) return 'Grab lunch in the cafeteria (southwest).';
    if (hasTask('printReport') || hasTask('print2')) return 'Pick up the printout at Printer 2 (west wall).';
    const deskTasks = s.tasks.active.filter((x) => !['singapore', 'fixProd', 'printReport', 'print2'].includes(x));
    if (deskTasks.length) return `Work on your tasks at your desk (${deskTasks.length} left).`;
    return 'Survive until 5:30 PM. Look busy.';
  }

  // ------------------------------------------------------------ approaches
  approach(id, dlg, opts = {}) {
    const g = this.game;
    const npc = g.npcs.get(id);
    if (!npc) return false;
    if (this.approaching) { if (opts.force) this.queue.push([id, dlg, opts]); return false; }
    npc.override = true;
    this.approaching = { npc, dlg, threat: !!opts.threat, t: 0, repath: 0, giveUp: opts.giveUp || 16, force: !!opts.force, pending: opts.pending, onDone: opts.onDone, hr: opts.hr };
    if (opts.threat) {
      g.ui.banner(opts.hr ? 'HR IS APPROACHING' : 'THREAT DETECTED', opts.hr ? 'hr' : '');
      Audio.play('threat');
      if (!opts.hr) this.s.counters.approached++;
    }
    this.repath();
    return true;
  }

  repath() {
    const a = this.approaching; if (!a) return;
    const p = this.game.player;
    let tx = p.pos.x, tz = p.pos.z;
    let gx, gz;
    const dx = a.npc.pos.x - tx, dz = a.npc.pos.z - tz, d = Math.hypot(dx, dz) || 1;
    // Seated at a desk: stand in the aisle beside the chair instead of inside the desk.
    if (p.state === 'seated') { gx = p.pos.x + 0.9; gz = p.pos.z + 0.35; }
    else { gx = tx + (dx / d) * 1.1; gz = tz + (dz / d) * 1.1; }
    a.npc.goTo({ x: gx, z: gz, node: nearestNode(tx, tz), yaw: Math.atan2(-dx, -dz), pose: 'idle' }, { hurry: a.threat });
  }

  updateApproach(dt) {
    const a = this.approaching; if (!a || this.game.locked) return;
    a.t += dt; a.repath += dt;
    const p = this.game.player, n = a.npc;
    const d = Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
    if (d < 1.75) {
      this.approaching = null;
      n.state = 'idle'; n.path = [];
      if (a.hr) { this.hrStare(n); return; }
      this.game.run(async () => {
        await this.game.talk(n.id, a.dlg, { pending: a.pending });
        a.onDone?.();
        this.release(n);
      });
      return;
    }
    if (a.repath > 1.1) { a.repath = 0; this.repath(); }
    const inRestroom = p.pos.x > 10 && p.pos.z > 5.2;
    if ((!a.force && a.t > a.giveUp && d > 5) || (inRestroom && !a.force && a.threat && d > 3) || (a.force && a.t > 40)) this.cancelApproach(false);
  }

  cancelApproach(hid, silent = false) {
    const a = this.approaching; if (!a) return;
    this.approaching = null;
    if (a.hr) this.hrWalking = false;
    if (a.force) {
      // You can't hide from the incident report forever: he corners you later.
      const ev = this.events.find((e) => e.id === 'blame');
      if (ev && a.dlg === 'blame') this.s.fired = this.s.fired.filter((x) => x !== 'blame');
    }
    if (a.threat && a.npc.id === 'manager' && !silent) {
      applyFx({ count: { dodged: 1 }, trust: -3, sanity: 2 });
      this.game.ui.toast(hid ? 'You hid. He gave up. For now.' : 'Dodged! Mr. Menon lost interest.', 'special');
      this.checkCounters();
    }
    this.release(a.npc);
  }

  release(n) {
    n.override = false; n.schedSpot = null; n.busy = false;
    if (n.id === 'manager') {
      this.lastReqTime = this.s.time;
      // Reported to HR: he is escorted to "a quick chat" and does not come back.
      if (this.s.flags.reportedToHR && !this.s.flags.mgrGone) {
        this.s.flags.mgrGone = true;
        n.override = true;
        const hr = this.game.npcs.get('hr');
        n.goTo('offstage', { hurry: false });
        if (hr.hidden) { hr.override = true; hr.goTo('lobby_wait', { onArrive: () => setTimeout(() => hr.goTo('offstage', { onArrive: () => { hr.override = false; hr.schedSpot = null; } }), 6000) }); }
        setTimeout(() => this.game.ui.subtitle('hr', 'Mr. Menon? A quick word. Just a minute. (It will not be a minute.)', 4200), 1200);
      }
    }
  }

  // The manager roams the floor hunting for someone to hand "one more quick thing".
  hunt() {
    const s = this.s, g = this.game;
    if (this.approaching || s.time < T(11, 15) || s.time > T(16, 40) || s.time < this.lastReqTime + 26) return;
    if (s.flags.reportedToHR || s.flags.hushPromotion) return;
    if ((s.flags.lookBusyUntil || 0) > s.time) return;
    if (s.flags.incident && s.time < T(15, 25)) return;
    const m = g.npcs.get('manager');
    if (m.hidden || m.override || m.at === 'mgr_seat' || m.at?.startsWith('meet') || m.at?.startsWith('cafe')) return;
    const p = g.player.pos;
    const d = Math.hypot(p.x - m.pos.x, p.z - m.pos.z);
    if (d > 8 || (p.x > 10 && p.z > 5)) return;
    this.managerRequest(null);
  }

  // lead: null (he walks up to you), 'req_knock' (you knocked), 'req_self' (you talked to him)
  managerRequest(lead) {
    const s = this.s, g = this.game;
    this.lastReqTime = s.time;
    const given = s.flags.requestsGiven || [];
    const pool = REQUEST_POOL.filter((r) => !given.includes(r) && !hasTask(r) && !s.tasks.done.includes(r));
    const deskLoad = s.tasks.active.filter((x) => !['singapore', 'fixProd'].includes(x)).length;
    let dlg, pending = null;
    if (!pool.length) dlg = 'mgr_generic';
    else if (s.stats.workload >= 95 || deskLoad >= 5) dlg = 'req_overload';
    else { pending = pick(pool); s.flags.requestsGiven = [...given, pending]; dlg = 'req_' + pending; }
    if (lead) {
      g.run(async () => {
        await g.talk('manager', lead);
        if (dlg !== 'mgr_generic') await g.talk('manager', dlg, { pending });
      });
    } else this.approach('manager', dlg, { threat: dlg !== 'mgr_generic', pending });
  }

  // ------------------------------------------------------------ scripted beats
  async hrWalk() {
    this.hrWalking = true;
    this.approach('hr', 'hr_walk', { threat: true, hr: true, giveUp: 22 });
  }
  async hrStare(n) {
    const g = this.game;
    n.ch.anim.lookTarget = g.player.pos;
    n.ch.anim.setBase('listen');
    g.ui.subtitle('hr', 'Hello.', 2400);
    await new Promise((r) => setTimeout(r, 1800));
    g.ui.subtitle('hr', 'Just gathering information. For no reason.', 3000);
    n.ch.anim.setBase('idle');
    this.release(n);
    n.override = true;
    n.goTo('plant_hr', { onArrive: () => {
      n.ch.anim.setBase('idle');
      if (Math.hypot(g.player.pos.x - n.pos.x, g.player.pos.z - n.pos.z) < 12) g.ui.subtitle('hr', '(watering the fake plant) Hydration is important. For everyone.', 4200);
      setTimeout(() => { this.hrWalking = false; n.goTo('offstage', { onArrive: () => this.release(n) }); }, 14000);
    } });
  }

  async joinMeeting() {
    const g = this.game, s = this.s;
    applyFx({ flag: 'attendedMeeting', count: { meetings: 1 } }, { silent: true });
    await g.run(async () => {
      await g.ui.fade(true);
      if (s.time < T(10, 0)) s.time = T(10, 0);
      g.npcs.snapToSchedule(s.time);
      for (const [id, spot] of [['manager', 'meet_head'], ['anu', 'meet_2'], ['arjun', 'meet_3']]) { const n = g.npcs.get(id); n.place(spot); n.override = true; }
      g.player.sit({ ...SPOTS.meet_player }, 'sit');
      g.cam.setShot({ x: -9.2, y: 2.3, z: -6.1 }, { x: -12.6, y: 0.95, z: -8.7 }); g.cam.snap = true;
      await g.ui.fade(false);
      await g.say('meeting', { keepCam: true });
    });
  }
  async meetingEnd() {
    const g = this.game;
    await g.say('meeting_after', { keepCam: true });
    await g.ui.fade(true);
    g.skipTime(Math.max(0, T(10, 50) - this.s.time));
    for (const id of ['manager', 'anu', 'arjun']) this.release(g.npcs.get(id));
    g.npcs.snapToSchedule(this.s.time);
    g.player.stand(); g.player.place(-12, -4.0, 0);
    g.cam.follow(true); g.cam.faceBehind(0);
    await g.ui.fade(false);
  }

  incident() {
    const g = this.game;
    applyFx({ flag: 'incident' }, { silent: true });
    this.setAct(3);
    g.world.setIncident(true);
    g.lighting.alarm = 1;
    Audio.play('alarm'); Audio.setMood('tense');
    g.cam.shake = 0.8;
    if (this.approaching && !this.approaching.force) this.cancelApproach(false, true);
    for (const n of g.npcs.list) if (!n.hidden) n.ch.anim.playOnce('surprised', 2.5);
    setTimeout(() => { g.ui.banner('PRODUCTION IS DOWN'); Audio.play('alarm'); g.cam.shake = 0.6; }, 3900);
    setTimeout(() => this.approach('manager', 'incident', { threat: true, force: true }), 6400);
  }

  fixProd(how) {
    const g = this.game, s = this.s;
    if (s.flags.prodFixed) return;
    g.world.setIncident(false);
    g.lighting.alarm = 0;
    Audio.setMood(s.act >= 4 ? 'evening' : 'calm');
    if (hasTask('fixProd')) completeTask('fixProd');
    if (how === 'nephew') {
      applyFx({ reputation: -4 });
      g.ui.toast("Someone's nephew in IT restarted the router. Production is back.", 'special');
      return;
    }
    applyFx({ flag: 'prodFixed', reputation: how === 'anu' ? 4 : 12, trust: 6, sanity: 6 });
    Audio.play('achievement');
    g.ui.banner('PRODUCTION IS BACK');
    if (how === 'restart') applyFx({ ach: 'TURN_IT_OFF' });
    const m = g.npcs.get('manager');
    if (!m.hidden && Math.hypot(m.pos.x - g.player.pos.x, m.pos.z - g.player.pos.z) < 14) setTimeout(() => g.ui.subtitle('manager', 'Production\'s back! Great teamwork. Mostly mine.', 3600), 1500);
  }

  // ------------------------------------------------------------ leaving
  tryLeave(via) {
    const g = this.game, s = this.s;
    if (s.time < T(16, 30)) {
      const hr = g.npcs.get('hr');
      g.run(async () => {
        await g.ui.fade(true);
        hr.place({ ...SPOTS.lobby_wait, pose: 'idle' }); hr.override = true;
        const p = g.player.pos;
        hr.pos.set(p.x + 1.2, 0, p.z - 1.0); hr.ch.setYaw(Math.atan2(p.x - hr.pos.x, p.z - hr.pos.z)); hr.targetYaw = hr.ch.yaw;
        await g.ui.fade(false);
        await g.talk('hr', 'leave_early', { via });
        if (!s.left) { hr.goTo('offstage', { onArrive: () => this.release(hr) }); }
      });
      return;
    }
    g.run(() => g.say('leave_confirm', { via }));
  }

  async leave(via) {
    const g = this.game, s = this.s;
    if (s.left) return;
    s.left = true; s.leftAt = s.time; s.flags.leftVia = via;
    const p = g.player;
    if (p.state === 'seated') p.stand();
    if (via === 'security') {
      applyFx({ flag: 'escortedOut' }, { silent: true });
      await g.ui.fade(true);
      return g.endDay('left');
    }
    if (via === 'stairs') {
      p.walkTo([{ x: 4.0, z: 11.2 }, { x: 4.0, z: 11.7 }], null, 1.4);
      g.cam.setShot({ x: 2.2, y: 1.9, z: 8.2 }, { x: 4, y: 1.2, z: 11.6 }, 2.5);
      await new Promise((r) => setTimeout(r, 1700));
      await g.ui.fade(true);
      await g.say('stairs_out');
      return g.endDay('left');
    }
    g.world.openElevator(12);
    Audio.play('ding');
    p.walkTo([{ x: 1.5, z: 10.9 }, { x: 1.5, z: 12.9 }, { x: 1.5, z: 12.95, yaw: Math.PI }], null, 1.5);
    g.cam.setShot({ x: 1.5, y: 1.75, z: 8.4 }, { x: 1.5, y: 1.3, z: 12.6 }, 2.2);
    await new Promise((r) => setTimeout(r, 3300));
    g.world.closeElevator();
    await new Promise((r) => setTimeout(r, 1600));
    await g.ui.fade(true);
    return g.endDay('left');
  }

  // ------------------------------------------------------------ overheard scenes
  updateScenes(dt) {
    const g = this.game, s = this.s;
    const p = g.player.pos;
    for (const sc of SCENES) {
      const st = this.sceneState[sc.id] || (this.sceneState[sc.id] = { i: 0, t: 0, done: s.fired.includes('scene_' + sc.id) });
      if (st.done || s.time < sc.from || s.time > sc.to || g.locked) continue;
      const anyDeploy = s.flags.managerDeployed || s.flags.deployedByPlayer;
      if (sc.needs === 'anyDeploy' && !anyDeploy) continue;
      const npcs = sc.who.map((id) => g.npcs.get(id));
      if (npcs.some((n) => n.hidden || n.state !== 'idle' || n.override || n.busy)) continue;
      const d = Math.hypot(p.x - sc.at.x, p.z - sc.at.z);
      if (d > sc.range) { if (st.t > 0) st.t = Math.min(st.t, 0.01); continue; }
      const lines = sc.linesYou && s.flags.deployedByPlayer && !s.flags.managerDeployed ? sc.linesYou : sc.lines;
      if (st.t <= 0) {
        const [who, text] = lines[st.i];
        g.ui.subtitle(who, text, 3600);
        for (const n of npcs) n.ch.anim.setTalking(n.id === who);
        st.t = 3.5;
      }
      st.t -= dt;
      if (st.t <= 0) {
        st.i++;
        for (const n of npcs) n.ch.anim.setTalking(false);
        if (st.i >= lines.length) {
          st.done = true; s.fired.push('scene_' + sc.id);
          const clue = sc.linesYou && lines === sc.linesYou ? sc.clueYou : sc.clue;
          if (clue) { applyFx({ clue }); g.ui.toast('📝 Overheard something. Check Status.', 'special'); }
        }
      }
    }
  }

  updateBarks(dt) {
    const g = this.game, s = this.s;
    this.barkAcc += dt; this.barkGlobal -= dt;
    if (this.barkAcc < 0.6 || g.locked || this.barkGlobal > 0) return;
    this.barkAcc = 0;
    const p = g.player.pos;
    for (const n of g.npcs.list) {
      if (n.hidden || n.busy || n.override) continue;
      if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 2.6) continue;
      if ((this.barkCd[n.id] || 0) > performance.now()) continue;
      if (n.id === 'deepa' && !s.flags.metDeepa && s.time < T(10, 0)) {
        g.ui.subtitle('deepa', 'Morning! Mr. Menon was looking for you. In a good way. Probably.', 4200);
      } else {
        const pool = BARKS.filter(([id, a, b]) => id === n.id && s.time >= a && s.time < b);
        if (!pool.length || Math.random() > 0.6) continue;
        g.ui.subtitle(n.id, pick(pool)[3], 3400);
      }
      n.ch.anim.setTalking(true); setTimeout(() => n.ch.anim.setTalking(false), 1800);
      this.barkCd[n.id] = performance.now() + 45000;
      this.barkGlobal = 9;
      break;
    }
  }

  distTo(id) { const n = this.game.npcs.get(id), p = this.game.player.pos; return n.hidden ? 99 : Math.hypot(n.pos.x - p.x, n.pos.z - p.z); }
  nextHardBeat(from) { return HARD_BEATS.find((b) => b > from + 0.5) ?? Infinity; }
}
