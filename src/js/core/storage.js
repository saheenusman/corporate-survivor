// Storage adapter. Order of preference:
//  1. window.storage (persistent artifact storage when running inside Claude)
//  2. localStorage (normal static hosting)
//  3. in-memory fallback (private mode / blocked storage) — the game still works.
const mem = new Map();

function detect() {
  try {
    if (typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function') return 'artifact';
  } catch (e) { /* ignore */ }
  try {
    const k = '__cs_probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return 'local';
  } catch (e) { return 'memory'; }
}

export const Storage = {
  kind: 'memory',
  init() { this.kind = detect(); return this.kind; },
  async get(key) {
    try {
      if (this.kind === 'artifact') {
        const r = await window.storage.get(key, false);
        if (r && r.value) return JSON.parse(r.value);
      } else if (this.kind === 'local') {
        const v = window.localStorage.getItem(key);
        if (v) return JSON.parse(v);
      }
    } catch (e) { /* missing key or blocked storage: fall through */ }
    const v = mem.get(key);
    return v ? JSON.parse(v) : null;
  },
  async set(key, obj) {
    const s = JSON.stringify(obj);
    mem.set(key, s);
    try {
      if (this.kind === 'artifact') await window.storage.set(key, s, false);
      else if (this.kind === 'local') window.localStorage.setItem(key, s);
      return true;
    } catch (e) { return false; }
  },
  async remove(key) {
    mem.delete(key);
    try {
      if (this.kind === 'artifact') await window.storage.delete(key, false);
      else if (this.kind === 'local') window.localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  },
};
