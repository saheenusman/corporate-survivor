// Corporate Survivor — entry point.
// Boots storage + settings, builds the office and cast behind a loading screen,
// runs the title screen, and owns the game loop plus all "glue" actions that
// interactables, dialogue and the director call into (talk, montage, printer...).
import * as THREE from 'three';
import { CONFIG, QUALITY, T, detectQuality, fmtTime, DEBUG } from './config.js';
import { bus } from './core/events.js';
import { clamp, wait, nextFrame, pick } from './core/util.js';
import { Storage } from './core/storage.js';
import { G, newDay, applyFx, hasTask, completeTask, loadMeta, saveMeta, loadDay, saveDay, clearDay, resetAll, stat } from './state/game-state.js';
import { Audio } from './audio/audio.js';
import { Input } from './input/input.js';
import { createRenderer, applyQuality, Lighting } from './render/renderer.js';
import { buildOffice } from './world/office.js';
import { SPOTS } from './world/nav.js';
import { Character, createSharedMaterials } from './characters/character.js';
import { LOOKS, CAST } from './characters/looks.js';
import { Player } from './gameplay/player.js';
import { CameraRig } from './gameplay/camera.js';
import { NPC, NPCManager } from './gameplay/npcs.js';
import { Interactions } from './gameplay/interactions.js';
import { Director } from './gameplay/director.js';
import { UI } from './ui/ui.js';
import { DialogueUI } from './ui/dialogue-ui.js';
import { TASKS } from './story/tasks.js';
import { SCHEDULES } from './story/schedules.js';
import { registerObjects, talkRoute, JOKE_COUNT } from './story/objects.js';
import { ACHIEVEMENTS } from './story/achievements.js';
import { evaluateEnding, endingLines } from './story/endings.js';

const CHAT = [
  [0, 600, ['Rahul: is menon in yet', 'Rahul: nvm i can hear him', 'Deepa: FYI the black coffee machine works. The grey one is decorative.', 'Anu: Good morning team!!! 🌞 Agenda for today attached (14 pages)']],
  [600, 900, ['Arjun: does anyone know why revenue is a vibe today', 'Neha: who moved my font', 'Dev: works on my machine', 'Rahul: lunch? or are we pretending to work through it']],
  [900, 2000, ['Kiran: is ₹0 a bug or a feature', 'Dev: not my service', 'Anu: I made a spreadsheet of everything that is on fire', 'Rahul: we are so back. no wait. we are so down.']],
];

class Game {
  constructor() {
    this.lockCount = 0;
    this.runAch = [];
    this.pendingLeave = null;
    this.scale = 1;
    this.perf = { acc: 0, frames: 0 };
    this.hudAcc = 0; this.schedAcc = 0;
    this.last = performance.now();
    this.firstHint = true;
  }

  get locked() {
    return this.lockCount > 0 || this.ui.modalOpen || G.mode !== 'play' || this.portrait;
  }

  // ------------------------------------------------------------ boot
  async boot() {
    this.ui = new UI();
    this.ui.setLoading(0.05, 'Badging in…');
    Storage.init();
    void this.isStandalone;
    this.installManifest();
    await loadMeta();
    const st = G.meta.settings;
    if (!st.quality || !QUALITY[st.quality]) st.quality = detectQuality();
    this.applyDisplaySettings();
    document.getElementById('rotate').classList.add('enabled');
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (!coarse) document.documentElement.classList.add('no-touch');
    this.portraitMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');

    await nextFrame();
    this.ui.setLoading(0.15, 'Starting the graphics card. Please hold.');
    const canvas = document.getElementById('gl');
    this.renderer = createRenderer(canvas, st.quality);
    if (!this.renderer) { this.ui.hide('loading'); this.ui.show('fatal'); return; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.getElementById('fatal-msg').textContent = 'The graphics context was lost (the phone may be low on memory). Reload the page to continue — your day is autosaved.'; this.ui.show('fatal'); });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 80);
    await wait(120);
    this.ui.setLoading(0.3, 'Building the office. Assembling cubicles…');
    await nextFrame();
    this.world = buildOffice({ quality: QUALITY[st.quality] });
    this.scene.add(this.world.root);
    this.lighting = new Lighting(this.scene, st.quality);

    this.ui.setLoading(0.55, 'Hiring your colleagues…');
    await nextFrame();
    const shared = createSharedMaterials();
    this.playerChar = new Character(LOOKS.player, shared);
    this.scene.add(this.playerChar.group);
    this.player = new Player(this.playerChar, this.world);
    this.npcs = new NPCManager(this.world);
    const extras = QUALITY[st.quality].extras > 0;
    for (const id of ['rahul', 'anu', 'manager', 'hr', 'deepa', 'arjun', 'neha', 'dev', 'kiran']) {
      if (!extras && (id === 'dev' || id === 'kiran')) continue;
      const ch = new Character(LOOKS[id], shared);
      this.scene.add(ch.group);
      this.npcs.add(new NPC(id, ch, this.world, SCHEDULES[id]));
    }

    this.ui.setLoading(0.72, 'Teaching the printer to jam…');
    await nextFrame();
    this.cam = new CameraRig(this.camera, this.world);
    this.interactions = new Interactions(this.scene);
    this.dialogue = new DialogueUI();
    this.input = new Input(document.getElementById('touch-layer'), document.getElementById('joy'), document.querySelector('#joy .joy-knob'));
    this.dir = new Director(this);
    registerObjects(this);
    this.wireUI();
    this.wireEvents();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('fullscreenchange', () => { this.onResize(); this.updateFsButton(); });
    document.addEventListener('webkitfullscreenchange', () => { this.onResize(); this.updateFsButton(); });
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 250));

    // title backdrop: people at work, player at the desk
    G.state = newDay(); G.state.time = T(10, 30);
    this.npcs.snapToSchedule(G.state.time);
    this.player.sit({ ...SPOTS.desk_player }, 'type');

    this.ui.setLoading(0.88, 'Warming up the coffee machine…');
    await nextFrame();
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* ignore */ }
    this.lighting.update(G.state.time, this.player.pos, this.world.windowMat, 0.016);
    this.renderer.render(this.scene, this.camera);
    this.ui.setLoading(1, 'Ready. Unfortunately.');
    await wait(450);
    if (DEBUG) { window.__CS = this; this.G = G; this.T = T; }
    requestAnimationFrame((t) => this.tick(t));
    await this.toTitle();
    this.ui.hide('loading');
  }

  applyDisplaySettings() {
    const st = G.meta.settings;
    document.documentElement.dataset.text = st.textSize || 'm';
    document.documentElement.dataset.rm = st.reducedMotion ? '1' : '0';
    Audio.setVolumes(st);
  }

  onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = clamp(70 - (w / h) * 8, 48, 62);
    this.camera.updateProjectionMatrix();
    this.input.placeJoyIdle();
  }

  // ------------------------------------------------------------ UI wiring
  wireUI() {
    const ui = this.ui;
    const firstGesture = () => { Audio.init(); Audio.setVolumes(G.meta.settings); };
    window.addEventListener('pointerdown', firstGesture, { once: false, capture: true });
    window.addEventListener('keydown', firstGesture, { capture: true });

    // Browsers only allow full screen from a tap, so any tap on the title screen enters it.
    document.getElementById('title').addEventListener('click', () => { if (matchMedia('(pointer: coarse)').matches) this.enterFullscreen(); }, true);
    document.getElementById('title-menu').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      Audio.init(); Audio.play('click');
      const act = b.dataset.act;
      if ((act === 'play' || act === 'continue') && matchMedia('(pointer: coarse)').matches) this.enterFullscreen();
      if (act === 'play') this.startNew();
      else if (act === 'continue') this.startContinue();
      else if (act === 'career') { ui.renderCareer(); ui.openModal('career'); }
      else if (act === 'settings') { ui.renderSettings((k, v) => this.onSetting(k, v)); ui.openModal('settings'); }
      else if (act === 'credits') ui.openModal('credits');
    });
    document.querySelector('#pause .menu').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      Audio.play('click');
      const act = b.dataset.act;
      if (act === 'resume') ui.closeTop();
      else if (act === 'status') { ui.renderStatus(); ui.openModal('status'); }
      else if (act === 'settings') { ui.renderSettings((k, v) => this.onSetting(k, v)); ui.openModal('settings'); }
      else if (act === 'fullscreen') { if (this.isFullscreen()) this.exitFullscreen(); else this.enterFullscreen(); ui.closeTop(); }
      else if (act === 'quit') { ui.closeAll(); await this.save(); await ui.fade(true); await this.toTitle(); await ui.fade(false); }
    });
    const act = document.getElementById('btn-act');
    act.addEventListener('click', (e) => { e.preventDefault(); this.interact(); });
    act.addEventListener('pointerdown', (e) => e.stopPropagation());
    const alt = document.getElementById('btn-alt');
    alt.addEventListener('click', () => { if (!this.locked && this.player.state === 'seated') { this.player.stand(); Audio.play('click'); } });
    document.getElementById('btn-pause').addEventListener('click', () => this.openPause());
    document.getElementById('btn-tasks').addEventListener('click', () => { if (G.mode !== 'play' || this.dialogue.active) return; Audio.play('open'); ui.renderTasks(); ui.openModal('tasks'); });
    ui.onModalClosed = () => {};
  }

  wireEvents() {
    const ui = this.ui;
    bus.on('key-interact', () => this.interact());
    // Escape/P work even while a menu is open (Input only emits keys during free play).
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (this.dialogue.active || G.mode === 'ending' || G.mode === 'loading') return;
      if (this.ui.modalOpen) { Audio.play('close'); this.ui.closeTop(); }
      else if (e.code === 'Escape' || G.mode === 'play') this.openPause();
    });
    bus.on('key-tasks', () => { if (G.mode === 'play' && !this.locked) { ui.renderTasks(); ui.openModal('tasks'); } });
    bus.on('fx-toast', ({ key, delta }) => { if (G.mode === 'play') ui.fxToast(key, delta); });
    bus.on('task-added', (id) => { if (G.mode !== 'play') return; Audio.play('ping'); ui.toast(`New task: ${TASKS[id]?.name || id}`, 'task'); });
    bus.on('task-done', (id) => { if (G.mode !== 'play') return; Audio.play('task'); ui.toast(`✓ Done: ${TASKS[id]?.name || id}`, 'task'); });
    bus.on('clue', () => { if (G.mode === 'play') ui.toast('📝 New clue — see Pause › Status', 'special'); });
    bus.on('joke-found', () => { ui.toast(`Office joke found · ${G.state.jokes.length}/${JOKE_COUNT}`, 'special'); });
    bus.on('time-skip', (m) => this.skipTime(m));
    bus.on('achievement', (id) => {
      if (!ACHIEVEMENTS[id] || G.meta.achievements.includes(id)) return;
      G.meta.achievements.push(id); this.runAch.push(id);
      Audio.play('achievement');
      ui.toast(`🏆 ${ACHIEVEMENTS[id].name}`, 'special');
      saveMeta();
    });
    bus.on('input-used', () => {
      if (this.input.touchUsed) document.documentElement.classList.remove('no-touch');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.mode === 'play') { this.save(); if (!this.ui.modalOpen && !this.lockCount) this.openPause(); }
        Audio.suspend();
      } else Audio.resume();
    });
    window.addEventListener('pagehide', () => { if (G.mode === 'play') this.save(); });
  }

  onSetting(k, v) {
    const st = G.meta.settings;
    if (k === '__reset') {
      resetAll().then(() => { this.applyDisplaySettings(); G.meta.settings.quality = st.quality; this.refreshTitle(); this.ui.toast('Progress reset.'); });
      return;
    }
    st[k] = v;
    if (k === 'quality') {
      this.scale = 1;
      applyQuality(this.renderer, v, 1);
      this.lighting.setQuality(v);
      const sh = QUALITY[v].shadows;
      this.world.staticMesh.castShadow = sh; this.world.staticMesh.receiveShadow = sh;
      this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    }
    this.applyDisplaySettings();
    clearTimeout(this.metaT); this.metaT = setTimeout(() => saveMeta(), 400);
  }

  // ------------------------------------------------------------ full screen
  // Android Chrome/Firefox and iPad support the Fullscreen API. iPhone Safari does
  // not, so there the answer is Add to Home Screen (see installManifest).
  get fsSupported() { const el = document.documentElement; return !!(el.requestFullscreen || el.webkitRequestFullscreen); }
  // Launched from the home screen as an app? Decided once at boot, because the
  // Fullscreen API also reports display-mode: fullscreen while it is active.
  get isStandalone() {
    if (this._standalone === undefined) this._standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || (matchMedia('(display-mode: fullscreen)').matches && !this.isFullscreen());
    return this._standalone;
  }
  isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  enterFullscreen() {
    if (this.isStandalone || this.isFullscreen() || !this.fsSupported) return;
    const el = document.documentElement;
    try {
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      const lock = () => { try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch (e) { /* unsupported */ } };
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* blocked (e.g. inside an iframe): keep playing normally */ }
  }
  exitFullscreen() {
    try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {}); } catch (e) { /* ignore */ }
  }
  updateFsButton() {
    const b = document.getElementById('btn-fs'); if (!b) return;
    b.hidden = !this.fsSupported || this.isStandalone;
    b.textContent = this.isFullscreen() ? 'Exit full screen' : 'Full screen';
  }
  // Web-app manifest so "Add to Home screen" launches full screen in landscape.
  // Only when hosted over https as a top-level page (not file:// or inside an iframe).
  installManifest() {
    if (location.protocol !== 'https:' || window.self !== window.top) return;
    const add = (rel, href) => { const l = document.createElement('link'); l.rel = rel; l.href = href; document.head.appendChild(l); };
    add('manifest', 'manifest.webmanifest');
    add('apple-touch-icon', 'icon-192.png');
    add('icon', 'icon-192.png');
  }

  openPause() {
    if (G.mode !== 'play' || this.ui.modalOpen || this.dialogue.active) return;
    Audio.play('open');
    this.updateFsButton();
    this.ui.openModal('pause');
  }

  interact() {
    if (this.locked || G.mode !== 'play') return;
    const c = this.interactions.current; if (!c) return;
    Audio.play('click');
    try { const r = c.it.use(this); if (r && r.catch) r.catch((e) => console.error(e)); } catch (e) { console.error(e); }
  }

  // ------------------------------------------------------------ title / day flow
  async refreshTitle() {
    const saved = await loadDay();
    this.savedDay = saved;
    const cont = document.getElementById('btn-continue');
    const play = document.getElementById('btn-play');
    cont.hidden = !saved;
    play.textContent = saved ? 'New day' : 'Play';
    play.classList.toggle('primary', !saved);
    this.ui.el['badge-meta'].textContent = `Day ${G.meta.career.days + 1} · ${saved ? 'Clocked in at ' + fmtTime(saved.time) : 'Shift 8:57 AM – 5:30 PM'}`;
  }

  async toTitle() {
    G.mode = 'title';
    this.ui.closeAll();
    for (const id of ['hud', 'dialogue', 'ending', 'montage']) this.ui.hide(id);
    this.dialogue.close();
    this.lockCount = 0;
    G.state = newDay(); G.state.time = T(10, 30);
    this.resetWorld();
    this.npcs.snapToSchedule(G.state.time);
    this.player.sit({ ...SPOTS.desk_player }, 'type');
    this.playerChar.mesh.visible = true;
    this.cam.mode = 'orbit';
    Audio.setAmbient(false); Audio.setMood('calm');
    await this.refreshTitle();
    this.ui.show('title');
  }

  resetWorld() {
    this.dir = new Director(this);
    this.world.setIncident(false);
    this.world.closeElevator();
    this.lighting.alarm = 0;
    this.pendingLeave = null;
    for (const n of this.npcs.list) { n.override = false; n.busy = false; n.schedSpot = null; n.ch.anim.exprName = 'neutral'; n.ch.anim.setTalking(false); }
    this.interactions.current = null;
  }

  async startNew() {
    await clearDay();
    this.ui.hide('title');
    await this.ui.fade(true, 350);
    G.state = newDay();
    this.runAch = [];
    this.resetWorld();
    this.npcs.snapToSchedule(G.state.time);
    this.player.state = 'locked';
    this.player.place(1.5, 12.9, Math.PI);
    this.player.ch.anim.setBase('idle');
    this.ui.show('hud'); this.ui.updateHUD(); this.ui.setObjective('Get to your desk. Avoid eye contact.');
    Audio.setAmbient(true); Audio.setMood('calm');
    G.mode = 'play';
    this.run(async () => {
      this.cam.setShot({ x: 1.5, y: 1.72, z: 8.7 }, { x: 1.5, y: 1.25, z: 12.4 }, 3); this.cam.snap = true;
      await this.ui.fade(false, 500);
      await wait(400);
      Audio.play('ding');
      this.world.openElevator(6);
      await wait(900);
      this.cam.setShot({ x: 3.4, y: 1.9, z: 7.4 }, { x: 1.5, y: 1.25, z: 10.3 }, 1.2);
      await this.walkPlayer([{ x: 1.5, z: 10.9 }, { x: 1.3, z: 9.2 }], 1.25);
      this.ui.actCard('Monday · Act 1', 'Normal Monday', '08:57 AM');
      await wait(1200);
      await this.say('intro', { keepCam: true });
      this.player.state = 'free';
      this.cam.follow(true); this.cam.faceBehind(this.player.yaw);
      applyFx({ flag: 'introDone' }, { silent: true });
      const touch = !document.documentElement.classList.contains('no-touch');
      this.ui.hint(touch ? 'Drag left side to walk · swipe right side to look' : 'WASD to walk · drag to look · E to interact · Esc to pause');
    });
  }

  async startContinue() {
    const s = this.savedDay || (await loadDay());
    if (!s || !s.flags?.introDone) return this.startNew();
    this.ui.hide('title');
    await this.ui.fade(true, 350);
    G.state = s;
    this.runAch = [];
    this.resetWorld();
    for (const sc of ['finance', 'phone', 'hr']) if (s.fired.includes('scene_' + sc)) this.dir.sceneState[sc] = { i: 0, t: 0, done: true };
    if (s.flags.incident && !s.flags.prodFixed) { this.world.setIncident(true); Audio.setMood('tense'); }
    else Audio.setMood(s.act >= 4 ? 'evening' : 'calm');
    this.npcs.snapToSchedule(s.time);
    if (s.flags.mgrGone) { const m = this.npcs.get('manager'); m.place('offstage'); m.override = true; }
    const p = s.player;
    if (p && p.seated) this.player.sit({ ...SPOTS.desk_player }, 'type');
    else if (p) { this.player.state = 'free'; this.player.place(p.x, p.z, p.yaw); this.player.ch.anim.setBase('idle'); }
    else { this.player.state = 'free'; this.player.place(-2.2, 1.2, Math.PI); }
    this.cam.follow(true); this.cam.faceBehind(this.player.yaw);
    this.ui.show('hud'); this.ui.updateHUD();
    Audio.setAmbient(true);
    G.mode = 'play';
    await this.ui.fade(false, 450);
    this.ui.toast(`Welcome back. It is still Monday. ${fmtTime(s.time)}.`);
  }

  async save() {
    if (G.mode !== 'play' || !G.state.flags.introDone || G.state.left) return;
    const p = this.player;
    G.state.player = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(3), seated: p.state === 'seated' && p.seat && Math.abs(p.seat.x - SPOTS.desk_player.x) < 0.1 };
    await saveDay();
  }

  // ------------------------------------------------------------ core helpers used by story code
  // Run an async sequence with player control + clock locked.
  async run(fn) {
    this.lockCount++;
    this.input.reset();
    try { return await fn(); }
    catch (e) { console.error('[run]', e); }
    finally { this.lockCount = Math.max(0, this.lockCount - 1); }
  }

  skipTime(mins) {
    const s = G.state;
    const to = Math.min(T(17, 29), s.time + mins);
    const d = to - s.time; if (d <= 0) return;
    s.time = to;
    this.dir.drift(d);
    this.npcs.snapToSchedule(s.time);
    this.ui.updateHUD();
  }

  note(text) { return this.run(() => this.ui.note(text)); }
  menu(title, sub, options) { return this.run(() => this.ui.menu(title, sub, options)); }

  checkJokes() { this.dir.checkCounters(); }
  checkCounters() { this.dir.checkCounters(); }

  dialogueHooks(npc, opts = {}) {
    const game = this;
    const actorFor = (who) => (who === 'player' ? this.playerChar : this.npcs.get(who)?.hidden === false ? this.npcs.get(who).ch : null);
    const seatedPose = (ch) => ch.anim.isSeatedPose;
    return {
      pendingTask: opts.pending, via: opts.via,
      onLine(n, who) {
        const ch = actorFor(who); if (!ch) return;
        if (!n.inner) ch.anim.setTalking(true);
        ch.anim.exprName = n.expr || 'neutral';
        if (who === 'player') return;
        if (n.anim && n.anim !== 'talk') ch.anim.playOnce(n.anim, 2.4);
        else if (seatedPose(ch)) ch.anim.setBase('sitTalk');
        else ch.anim.setBase('talk');
      },
      onEndLine(n, who) {
        const ch = actorFor(who); if (!ch) return;
        ch.anim.setTalking(false);
        if (ch.anim.base === 'talk') ch.anim.setBase('idle');
        else if (ch.anim.base === 'sitTalk') ch.anim.setBase('sit');
      },
      async call(name) { return game.onCall(name); },
    };
  }

  async onCall(name) {
    const [k, arg] = name.split(':');
    switch (k) {
      case 'meetingEnd': await this.dir.meetingEnd(); return;
      case 'fixProd':
        if (arg === 'restart') {
          await this.ui.fade(true); Audio.play('whoosh'); await wait(700); Audio.play('ding'); await this.ui.fade(false);
        }
        this.dir.fixProd(arg); return;
      case 'leave': this.pendingLeave = arg; return 'end';
      case 'tookBlame': if (!G.state.flags.deployedByPlayer) applyFx({ ach: 'WHAT_DID_I_DO' }); return;
      case 'blamePrinter': if (G.state.counters.printerFails >= 2) applyFx({ reputation: 2 }); return;
      case 'lunchDone':
        await this.ui.fade(true); this.skipTime(30);
        applyFx({ energy: 22, sanity: 6, bladder: 10, flag: 'ateLunch' }); await this.ui.fade(false); return;
      case 'cancelLeave': this.player.place(0.9, 8.9, 0); this.cam.follow(true); this.cam.faceBehind(0); return;
      default: console.warn('unknown call', name);
    }
  }

  async afterDialogue() {
    if (this.pendingLeave) { const via = this.pendingLeave; this.pendingLeave = null; await this.dir.leave(via); }
  }

  // Talk to an NPC with a two-shot camera. Wraps its own lock.
  talk(id, key, opts = {}) {
    return this.run(async () => {
      const npc = this.npcs.get(id);
      const p = this.player;
      npc.busy = true;
      npc._prevBase = npc.ch.anim.base;
      const wasFree = p.state === 'free';
      if (wasFree) p.state = 'locked';
      p.targetYaw = Math.atan2(npc.pos.x - p.pos.x, npc.pos.z - p.pos.z);
      p.vel.set(0, 0, 0);
      if (!npc.ch.anim.isSeatedPose) npc.targetYaw = Math.atan2(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z);
      npc.ch.anim.lookTarget = p.pos;
      this.playerChar.anim.lookTarget = npc.pos;
      this.playerChar.mesh.visible = true;
      if (!opts.keepCam) this.cam.twoShot(p.pos, npc.pos, p.state === 'seated' ? 1.15 : 1.55, npc.ch.anim.isSeatedPose ? 1.15 : 1.55);
      applyFx({ count: { talks: 1 } }, { silent: true });
      await this.dialogue.run(key, this.dialogueHooks(npc, opts));
      npc.busy = false;
      npc.ch.anim.setTalking(false); npc.ch.anim.exprName = 'neutral';
      if (['talk', 'sitTalk', 'idle', 'sit'].includes(npc.ch.anim.base) && npc._prevBase) npc.ch.anim.setBase(npc._prevBase);
      this.playerChar.anim.lookTarget = null; this.playerChar.anim.exprName = 'neutral';
      if (p.state === 'locked' && wasFree && !G.state.left) p.state = 'free';
      if (!opts.keepCam && G.mode === 'play' && !G.state.left) this.cam.follow();
      await this.afterDialogue();
    });
  }

  // Narration / inner-voice dialogue with no specific partner.
  say(key, opts = {}) {
    return this.run(async () => {
      const p = this.player;
      const wasFree = p.state === 'free';
      if (wasFree) p.state = 'locked';
      await this.dialogue.run(key, this.dialogueHooks(null, opts));
      for (const n of this.npcs.list) { n.ch.anim.setTalking(false); }
      this.playerChar.anim.exprName = 'neutral';
      if (p.state === 'locked' && wasFree && !G.state.left) p.state = 'free';
      await this.afterDialogue();
    });
  }

  talkTo(id) {
    if (id === 'manager') {
      const s = G.state;
      if (s.time < this.dir.lastReqTime + 20 || s.time < T(9, 0) || this.dir.approaching) return this.talk('manager', 'mgr_generic');
      return this.dir.managerRequest('req_self');
    }
    const key = talkRoute(id, this);
    if (key) return this.talk(id, key);
  }

  // Scripted walk that resolves when the player arrives (with a safety timeout for slow devices).
  walkPlayer(points, speed = 1.4, maxMs = 9000) {
    const last = points[points.length - 1];
    return new Promise((res) => {
      let done = false;
      const finish = () => { if (done) return; done = true; res(); };
      this.player.walkTo(points, finish, speed);
      setTimeout(() => { if (!done) { this.player.pos.set(last.x, 0, last.z); this.player.state = 'locked'; finish(); } }, maxMs);
    });
  }

  // Small physical actions: face something, hold a pose, make a sound, spend a few minutes.
  playerAction({ face, pose = 'idle', prop, sound, secs = 1.2, mins = 0 }) {
    return this.run(async () => {
      const p = this.player;
      const wasFree = p.state === 'free';
      if (wasFree) p.state = 'locked';
      if (face) p.targetYaw = Math.atan2(face.x - p.pos.x, face.z - p.pos.z);
      p.ch.anim.setBase(pose);
      if (prop) p.ch.showProp(prop, true);
      if (sound) Audio.play(sound);
      await wait(secs * 1000);
      if (prop) p.ch.showProp(prop, false);
      p.ch.anim.setBase('idle');
      if (mins) this.skipTime(mins);
      if (wasFree && p.state === 'locked') p.state = 'free';
    });
  }

  // ------------------------------------------------------------ the computer
  async computer() {
    const s = G.state, f = s.flags;
    const opts = [];
    const desk = s.tasks.active.filter((id) => TASKS[id]?.mins);
    for (const id of desk) {
      const t = TASKS[id];
      const mins = id === 'q3deck' && f.deckShortcut ? t.shortMins : t.mins;
      opts.push({ t: `Work: ${t.name}`, sub: `About ${mins} min${id === 'q3deck' && f.deckShortcut ? " (Anu's template)" : ''}`, hot: ['q3deck', 'config'].includes(id), act: () => this.doTask(id) });
    }
    if (f.incident) opts.push({ t: 'Check deploy logs', sub: 'Who pushed what, and when', hot: !s.clues.includes('deploy_log') && !s.clues.includes('deploy_log_you'), act: () => this.checkLogs() });
    if (f.incident && !f.prodFixed && (s.clues.includes('deploy_log') || s.clues.includes('deploy_log_you'))) opts.push({ t: 'Revert the config change', sub: 'Undo the ₹0 air fryers', hot: true, act: () => this.revert() });
    opts.push({ t: 'Check team chat', sub: '3 min', act: () => this.chat() });
    opts.push({ t: 'Browse memes', sub: '10 min · good for sanity', act: () => this.memes() });
    opts.push({ t: 'Look busy', sub: 'Keeps Mr. Menon away for a while', act: () => this.lookBusy() });
    if (!f.offline) opts.push({ t: 'Set chat status: Offline', sub: 'Bold. Possibly career-limiting.', act: async () => { applyFx({ flag: 'offline', sanity: 5, ach: 'OFFLINE' }); await this.note('Status set to: Offline 🔕\nSeventeen people immediately message you "you there?"'); } });
    const i = await this.menu('Your computer', `${fmtTime(s.time)} · ${desk.length} task${desk.length === 1 ? '' : 's'} at your desk`, opts);
    if (i === null || i === undefined) return;
    await opts[i].act();
  }

  async doTask(id) {
    const s = G.state, t = TASKS[id];
    let mins = id === 'q3deck' && s.flags.deckShortcut ? t.shortMins : t.mins;
    const from = s.time;
    const cap = this.dir.nextHardBeat(from) - 1;
    const to = Math.min(from + mins, cap);
    if (this.dir.approaching?.threat) { await this.note('You try to focus.\nYou can hear Mr. Menon\'s footsteps getting closer.\nYou cannot focus.'); return; }
    if (to - from < 4) { await this.note('No time to start that now.\nSomething is about to happen. You can feel it in your stapler.'); return; }
    await this.run(async () => {
      this.player.ch.anim.setBase('type');
      Audio.play('type');
      const typer = setInterval(() => Audio.play('type'), 900);
      await this.ui.montage(t.name, from, to, t.lines || ['Working…'], G.meta.settings.reducedMotion);
      clearInterval(typer);
      this.skipTime(to - from);
      applyFx(t.fx);
      if (id === 'config') applyFx({ flags: { deployTime: Math.round(s.time) } }, { silent: true });
      completeTask(id);
      this.dir.checkCounters();
    });
    this.save();
  }

  async checkLogs() {
    const s = G.state;
    const mgr = s.flags.managerDeployed;
    applyFx({ clue: mgr ? 'deploy_log' : 'deploy_log_you' });
    await this.note(mgr
      ? 'DEPLOY LOG — pricing-service\n12:05 PM · user: admin-shared\nsource: MENON-LAPTOP-01\nmessage: "tiny fix trust me"'
      : `DEPLOY LOG — pricing-service\n${fmtTime(s.flags.deployTime || T(11, 30))} · user: you\nmessage: "small config change (requested)"\n\nIt was you. Technically.`);
    if (mgr && (s.clues.includes('edit_history') || s.clues.includes('manager_phone'))) applyFx({ ach: 'WHO_DEPLOYED' });
  }

  async revert() {
    await this.run(async () => {
      this.player.ch.anim.setBase('type');
      await this.ui.montage('Reverting the config', G.state.time, G.state.time + 8, ['git revert… git revert… GIT REVERT', 'True → true', 'Air fryers: back to full price. Customers: furious.'], G.meta.settings.reducedMotion);
      this.skipTime(8);
      this.dir.fixProd('revert');
    });
  }

  async chat() {
    const s = G.state;
    const pool = CHAT.find(([a, b]) => s.time >= a && s.time < b)[2];
    this.skipTime(3);
    applyFx({ sanity: 2 });
    await this.note(`TEAM CHAT\n\n${pick(pool)}\n${pick(pool)}`);
  }
  async memes() {
    const m = this.npcs.get('manager');
    const seen = !m.hidden && Math.hypot(m.pos.x - this.player.pos.x, m.pos.z - this.player.pos.z) < 6;
    this.skipTime(10);
    applyFx(seen ? { sanity: 6, trust: -5, reputation: -2 } : { sanity: 9, energy: 2 });
    await this.note(seen ? 'You laugh at a meme about Mondays.\nMr. Menon is standing right behind you.\nHe also laughs. Then writes something down.' : pick(['A meme about meetings that could have been emails. You feel seen.', 'A cat sitting in a cardboard box labelled "Q3 goals". Relatable.', 'A dog in a tie: "I have no idea what I\'m doing." Also relatable.']));
  }
  async lookBusy() {
    const s = G.state;
    applyFx({ flags: { lookBusyUntil: s.time + 45 }, sanity: 2 });
    this.skipTime(5);
    await this.note('You open a spreadsheet and frown at it.\nYou nod slowly. You type something, delete it, and sigh.\nVery convincing. Nobody will bother you for a while.');
  }

  // ------------------------------------------------------------ Printer 2
  async printer() {
    const s = G.state;
    const task = hasTask('printReport') ? 'printReport' : hasTask('print2') ? 'print2' : null;
    if (!task) { await this.note('PRINTER 2\n(printer 1 was a lie)\n\nIt hums quietly. It knows you have nothing to print. It is waiting.'); return; }
    s.printer.attempts++;
    const a = s.printer.attempts;
    await this.playerAction({ face: { x: -15.4, z: -1.6 }, pose: 'type', sound: 'printer', secs: 1.3, mins: 2 });
    const fail = async (msg) => { Audio.play('jam'); s.counters.printerFails++; applyFx({ sanity: -3 }); this.dir.checkCounters(); await this.note(msg); };
    const success = async (msg) => {
      Audio.play('printer');
      s.printer.attempts = 1;
      completeTask(task); applyFx(TASKS[task].fx);
      await this.note(msg);
    };
    if (a === 1) return fail('PAPER JAM IN TRAY 2.\n\nThere is no Tray 2.');
    if (a === 2) return fail('PC LOAD LETTER.\n\nNobody knows what it means.\nNot even the printer.');
    const i = await this.menu('Printer 2', 'It blinks at you. Menacingly.', [
      { t: 'Kick it', sub: 'The classic.' }, { t: 'Ask it nicely', sub: '"Please?"' }, { t: 'Turn it off and on again', sub: 'The ancient ritual. Takes a few minutes.' },
    ]);
    if (i === 0) {
      this.cam.shake = 0.6;
      if (Math.random() < 0.5) return success('You kick it. It prints. You feel powerful, and slightly ashamed.');
      return fail('You kick it. It jams harder. Out of spite.\nSomewhere, HR writes something down.');
    }
    if (i === 1) return success('"Please?"\nIt prints. Perfectly. In colour, even.\nYou don\'t want to know why that worked.');
    if (i === 2) { this.skipTime(4); return success('It reboots, prints a test page, a calendar from 2019, and then your document. Still warm.'); }
    s.printer.attempts--;
  }

  // ------------------------------------------------------------ ending
  async endDay(how) {
    if (G.mode === 'ending') return;
    const s = G.state;
    if (s.leftAt === null || s.leftAt === undefined) s.leftAt = s.time;
    const id = evaluateEnding(s, how === 'overtime' ? 'overtime' : 'left');
    G.mode = 'ending';
    s.ending = id;
    if (id === 'middle') bus.emit('achievement', 'MIDDLE_MANAGEMENT');
    const c = G.meta.career, k = s.counters;
    c.days++; if (!c.endings.includes(id)) c.endings.push(id);
    c.tasks += k.tasksDone; c.coffees += k.coffees; c.meetings += k.meetings; c.printer += k.printerFails;
    c.requests += k.requests; c.sure += k.sure; c.minutes += Math.max(0, s.time - CONFIG.DAY_START);
    await saveMeta(); await clearDay();
    this.ui.closeAll(); this.dialogue.close();
    await this.ui.fade(true);
    this.ui.hide('hud');
    Audio.setAmbient(false);
    Audio.play('ending');
    this.ui.show('ending');
    await this.ui.fade(false, 300);
    await this.ui.ending(id, endingLines(id, s), G.meta.settings.reducedMotion);
    const r = await this.ui.showEndSummary(id, s, this.runAch);
    await this.ui.fade(true);
    this.ui.hide('ending');
    if (r === 'again') { this.ui.fade(false); await this.startNew(); }
    else { await this.toTitle(); await this.ui.fade(false); }
  }

  // ------------------------------------------------------------ loop
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.portrait = this.portraitMQ.matches;
    const s = G.state;
    const locked = this.locked;
    this.input.enabled = G.mode === 'play' && !locked;

    if (G.mode === 'play') {
      if (!this.portrait && !(this.ui.modalOpen && this.ui.modalStack.some((m) => ['pause', 'settings', 'status', 'tasks'].includes(m)))) this.dir.update(dt);
      this.schedAcc += dt;
      if (this.schedAcc > 0.4) { this.schedAcc = 0; this.npcs.tickSchedules(s.time); }
      if (!locked && this.player.state === 'seated' && this.input.getMove().mag > 0.55) this.player.stand();
    } else if (G.mode === 'title') {
      s.time = T(10, 30);
    }

    if (G.mode !== 'ending') {
      this.npcs.update(dt, this.player.pos);
      this.player.update(dt, locked ? { getMove: () => ({ x: 0, y: 0, mag: 0, run: false }) } : this.input, this.cam.yaw, this.npcs.circles());
      this.interactions.update(dt, this.player, locked || G.mode !== 'play');
      if (G.mode === 'play') {
        const c = this.interactions.current;
        this.ui.setAction(!locked && c ? c.label : null, !!(c && c.it.priority && c.it.priority < -0.4));
        this.ui.setAlt(!locked && this.player.state === 'seated' ? 'Stand' : null);
      }
      this.cam.update(dt, this.player, locked ? null : this.input, G.meta.settings, G.meta.settings.reducedMotion);
      // never let the camera sit inside someone's head
      const cp = this.camera.position;
      for (const n of this.npcs.list) {
        if (n.hidden) continue;
        const dx = cp.x - n.pos.x, dz = cp.z - n.pos.z;
        n.ch.mesh.visible = dx * dx + dz * dz > 0.36 || cp.y > 2.1;
      }
      this.world.update(dt, s.time);
      this.lighting.update(s.time, this.player.pos, this.world.windowMat, dt);
      this.hudAcc += dt;
      if (this.hudAcc > 0.25 && G.mode === 'play') { this.hudAcc = 0; this.ui.updateHUD(); }
      this.renderer.render(this.scene, this.camera);
      this.adaptResolution(dt);
    }
  }

  // Drop render resolution when the phone can't keep up; restore when it can.
  adaptResolution(dt) {
    const p = this.perf;
    p.acc += dt; p.frames++;
    if (p.acc < 2.5) return;
    const avg = p.acc / p.frames; p.acc = 0; p.frames = 0;
    const q = G.meta.settings.quality;
    if (avg > 1 / 26 && this.scale > 0.6) { this.scale = Math.max(0.6, this.scale - 0.12); applyQuality(this.renderer, q, this.scale); this.onResize(); }
    else if (avg < 1 / 50 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.08); applyQuality(this.renderer, q, this.scale); this.onResize(); }
  }
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const f = document.getElementById('fatal');
  document.getElementById('fatal-msg').textContent = 'Something went wrong while starting the game: ' + (e && e.message ? e.message : e);
  document.getElementById('loading').classList.remove('show');
  f.classList.add('show');
});
