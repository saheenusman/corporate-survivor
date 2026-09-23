// Central game state. One plain serialisable object for the day (G.state) and one
// for persistent meta data (G.meta: settings, career, achievements, endings).
// All mutation of stats/relationships/flags goes through applyFx so every change
// can be surfaced to the UI and checked by achievements in one place.
import { CONFIG } from '../config.js';
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';
import { Storage } from '../core/storage.js';

const META_KEY = 'corporate-survivor:meta:v1';
const SAVE_KEY = 'corporate-survivor:save:v1';

export const DEFAULT_SETTINGS = {
  quality: null, music: 0.45, sfx: 0.8, mute: false, sensitivity: 1.0,
  invertY: false, textSize: 'm', reducedMotion: false, subtitles: true,
};

export function newMeta() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    career: { days: 0, endings: [], tasks: 0, meetings: 0, coffees: 0, printer: 0, requests: 0, sure: 0, minutes: 0 },
    achievements: [],
  };
}

export function newDay() {
  return {
    v: 1,
    time: CONFIG.DAY_START,
    act: 1,
    stats: { energy: 72, sanity: 78, workload: 15, reputation: 50, bladder: 12 },
    rel: { rahul: 45, anu: 45, manager: 50, hr: 0 },
    suspicion: 0,
    tasks: { active: ['emails'], done: [] },
    clues: [],
    flags: {},
    jokes: [],
    fired: [],
    counters: {
      coffees: 0, meetings: 0, printerFails: 0, requests: 0, sure: 0, minute: 0,
      talks: 0, chaos: 0, tasksDone: 0, dodged: 0, approached: 0,
    },
    printer: { attempts: 0 },
    player: null,
    left: false, leftAt: null, ending: null,
  };
}

export const G = { state: newDay(), meta: newMeta(), mode: 'loading' };

const STAT_MAX = { energy: 100, sanity: 100, workload: 200, reputation: 100, bladder: 100 };
const REL_KEYS = { rahul: 'rahul', anu: 'anu', trust: 'manager', hr: 'hr' };

export function stat(k, d) {
  const s = G.state.stats;
  const before = s[k];
  s[k] = clamp(before + d, 0, STAT_MAX[k] ?? 100);
  return s[k] - before;
}

/**
 * Apply an effects object from dialogue/story data. Keys:
 * energy sanity workload reputation bladder  (stat deltas)
 * rahul anu trust hr                         (relationship deltas)
 * suspicion chaos                            (hidden variables)
 * task done clue flag flags count ach time   (story mutations)
 */
export function applyFx(fx, opts = {}) {
  if (!fx) return;
  const st = G.state;
  const silent = !!opts.silent;
  for (const k of ['energy', 'sanity', 'workload', 'reputation', 'bladder']) {
    if (fx[k]) {
      const d = stat(k, fx[k]);
      if (!silent && Math.round(d) !== 0 && k !== 'bladder') bus.emit('fx-toast', { key: k, delta: d });
    }
  }
  for (const [k, relKey] of Object.entries(REL_KEYS)) {
    if (fx[k]) {
      const before = st.rel[relKey];
      st.rel[relKey] = clamp(before + fx[k], 0, 100);
      if (!silent && relKey !== 'hr') bus.emit('fx-toast', { key: relKey, delta: st.rel[relKey] - before });
    }
  }
  if (fx.suspicion) st.suspicion = clamp(st.suspicion + fx.suspicion, 0, 100);
  if (fx.chaos) st.counters.chaos += fx.chaos;
  if (fx.count) for (const [k, v] of Object.entries(fx.count)) st.counters[k] = (st.counters[k] || 0) + v;
  if (fx.flag) st.flags[fx.flag] = true;
  if (fx.flags) Object.assign(st.flags, fx.flags);
  if (fx.task) [].concat(fx.task).forEach(addTask);
  if (fx.done) [].concat(fx.done).forEach(completeTask);
  if (fx.clue) [].concat(fx.clue).forEach(discoverClue);
  if (fx.time) bus.emit('time-skip', fx.time);
  if (fx.ach) bus.emit('achievement', fx.ach);
  bus.emit('state-changed');
}

export function hasTask(id) { return G.state.tasks.active.includes(id); }
export function taskDone(id) { return G.state.tasks.done.includes(id); }
export function addTask(id) {
  const t = G.state.tasks;
  if (t.active.includes(id) || t.done.includes(id)) return;
  t.active.push(id);
  bus.emit('task-added', id);
}
export function completeTask(id) {
  const t = G.state.tasks;
  const i = t.active.indexOf(id);
  if (i < 0) return;
  t.active.splice(i, 1);
  t.done.push(id);
  G.state.counters.tasksDone++;
  bus.emit('task-done', id);
}
export function hasClue(id) { return G.state.clues.includes(id); }
export function discoverClue(id) {
  if (G.state.clues.includes(id)) return;
  G.state.clues.push(id);
  bus.emit('clue', id);
}
export function findJoke(id) {
  if (G.state.jokes.includes(id)) return false;
  G.state.jokes.push(id);
  bus.emit('joke-found', id);
  return true;
}

// ---------- persistence ----------
export async function loadMeta() {
  const m = await Storage.get(META_KEY);
  const base = newMeta();
  if (m) {
    base.settings = { ...base.settings, ...(m.settings || {}) };
    base.career = { ...base.career, ...(m.career || {}) };
    base.achievements = Array.isArray(m.achievements) ? m.achievements : [];
  }
  G.meta = base;
  return base;
}
export function saveMeta() { return Storage.set(META_KEY, G.meta); }
export async function loadDay() {
  const s = await Storage.get(SAVE_KEY);
  if (!s || s.v !== 1 || s.ending) return null;
  const fresh = newDay();
  // Merge so older saves missing new fields still load.
  return {
    ...fresh, ...s,
    stats: { ...fresh.stats, ...s.stats },
    rel: { ...fresh.rel, ...s.rel },
    counters: { ...fresh.counters, ...s.counters },
    tasks: { active: s.tasks?.active || [], done: s.tasks?.done || [] },
  };
}
export function saveDay() { return Storage.set(SAVE_KEY, G.state); }
export function clearDay() { return Storage.remove(SAVE_KEY); }
export async function resetAll() {
  await Storage.remove(SAVE_KEY);
  await Storage.remove(META_KEY);
  G.meta = newMeta();
}
