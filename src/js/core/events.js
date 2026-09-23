// Tiny event bus. Systems talk through events instead of importing each other,
// which keeps UI, audio and gameplay decoupled.
export class Emitter {
  constructor() { this.h = new Map(); }
  on(e, f) { if (!this.h.has(e)) this.h.set(e, []); this.h.get(e).push(f); return () => this.off(e, f); }
  off(e, f) { const a = this.h.get(e); if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
  emit(e, ...args) {
    const a = this.h.get(e); if (!a) return;
    for (const f of a.slice()) { try { f(...args); } catch (err) { console.error('[bus]', e, err); } }
  }
}
export const bus = new Emitter();
