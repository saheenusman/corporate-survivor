// Procedural audio: every sound is synthesised with Web Audio, so there are no
// audio files to download and nothing to fail loading. If Web Audio is missing
// the whole system silently becomes a no-op.
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MOODS = {
  calm:  { bpm: 82, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], hat: false },
  tense: { bpm: 104, chords: [[45, 48, 52, 57], [41, 45, 48, 53], [38, 41, 45, 50], [40, 44, 47, 52]], hat: true },
  evening: { bpm: 72, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]], hat: false },
};

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.vol = { music: 0.45, sfx: 0.8, mute: false };
    this.mood = 'calm';
    this.ambientOn = false;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.ambBus = c.createGain(); this.ambBus.connect(this.master);
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = w; last = (last + 0.02 * w) / 1.02; }
      this.noise = b;
      this.apply();
      this._startHum();
      this._startMusic();
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.ctx = null;
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  setVolumes(s) { this.vol = { music: s.music, sfx: s.sfx, mute: s.mute }; this.apply(); }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.mute ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.2);
    this.ambBus.gain.setTargetAtTime(this.ambientOn ? this.vol.sfx * 0.7 : 0, t, 0.4);
  }
  setAmbient(on) { this.ambientOn = on; this.apply(); }
  setMood(m) { if (MOODS[m]) this.mood = m; }

  tone(freq, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.when || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const g = c.createGain();
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  hiss(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.when || 0);
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    const g = c.createGain(); const v = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxBus);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(760, 0.06, { type: 'triangle', vol: 0.09 }); break;
      case 'open': this.tone(520, 0.08, { type: 'triangle', vol: 0.07 }); this.tone(780, 0.1, { type: 'triangle', vol: 0.06, when: 0.05 }); break;
      case 'close': this.tone(700, 0.08, { type: 'triangle', vol: 0.06 }); this.tone(480, 0.1, { type: 'triangle', vol: 0.05, when: 0.05 }); break;
      case 'blip': this.tone(opt.pitch || 440, 0.045, { type: 'square', vol: 0.018 }); break;
      case 'step': this.hiss(0.07, { filter: 'lowpass', freq: 420 + Math.random() * 120, vol: 0.05 }); break;
      case 'type':
        for (let i = 0; i < 6; i++) this.hiss(0.025, { freq: 2600 + Math.random() * 1500, q: 3, vol: 0.05, when: i * (0.07 + Math.random() * 0.05) });
        break;
      case 'coffee':
        this.hiss(1.8, { filter: 'bandpass', freq: 900, q: 0.8, vol: 0.09, attack: 0.25 });
        for (let i = 0; i < 7; i++) this.tone(180 + Math.random() * 160, 0.09, { vol: 0.05, when: 0.4 + i * 0.18 });
        break;
      case 'sip': this.hiss(0.35, { filter: 'lowpass', freq: 650, vol: 0.08, attack: 0.05 }); break;
      case 'printer':
        for (let i = 0; i < 6; i++) this.tone(96, 0.12, { type: 'square', vol: 0.045, when: i * 0.17 });
        this.hiss(1.0, { filter: 'bandpass', freq: 2200, vol: 0.03, attack: 0.1 });
        break;
      case 'jam':
        this.tone(170, 0.3, { type: 'sawtooth', vol: 0.07 });
        this.tone(150, 0.4, { type: 'sawtooth', vol: 0.07, when: 0.34 });
        break;
      case 'ding':
        this.tone(1318.5, 1.6, { vol: 0.09 }); this.tone(1046.5, 1.9, { vol: 0.09, when: 0.28 });
        break;
      case 'ping': this.tone(988, 0.14, { vol: 0.07 }); this.tone(1480, 0.28, { vol: 0.06, when: 0.09 }); break;
      case 'task': this.tone(659, 0.12, { type: 'triangle', vol: 0.08 }); this.tone(988, 0.22, { type: 'triangle', vol: 0.08, when: 0.1 }); break;
      case 'threat':
        this.tone(98, 0.5, { type: 'sawtooth', vol: 0.07 }); this.tone(92.5, 0.5, { type: 'sawtooth', vol: 0.05 });
        this.tone(69, 1.0, { type: 'sawtooth', vol: 0.08, when: 0.45 }); this.tone(65.4, 1.0, { type: 'sawtooth', vol: 0.05, when: 0.45 });
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) { this.tone(740, 0.35, { type: 'square', vol: 0.05, when: i * 0.7, slide: 520 }); }
        break;
      case 'achievement':
        [72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), 0.35, { type: 'triangle', vol: 0.07, when: i * 0.08 }));
        break;
      case 'flush': this.hiss(1.4, { filter: 'lowpass', freq: 1100, vol: 0.13, attack: 0.12 }); break;
      case 'vend': this.tone(90, 0.18, { type: 'square', vol: 0.07 }); this.tone(70, 0.25, { type: 'square', vol: 0.06, when: 0.2 }); break;
      case 'whoosh': this.hiss(0.45, { filter: 'bandpass', freq: 700, q: 0.6, vol: 0.06, attack: 0.15 }); break;
      case 'ending': [60, 64, 67, 71, 74].forEach((m, i) => this.tone(midi(m), 2.4, { vol: 0.045, when: i * 0.12 })); break;
      case 'gasp': this.tone(420, 0.25, { type: 'triangle', vol: 0.06, slide: 900 }); break;
      default: break;
    }
  }

  // Air-conditioning hum + distant keyboards. Very quiet by design.
  _startHum() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = c.createGain(); g.gain.value = 0.11;
    src.connect(f); f.connect(g); g.connect(this.ambBus); src.start();
    const tick = () => {
      if (this.ambientOn && this.ctx.state === 'running') {
        const n = 3 + Math.floor(Math.random() * 7);
        for (let i = 0; i < n; i++) this.hiss(0.02, { freq: 3000 + Math.random() * 1500, q: 3, vol: 0.012, when: i * (0.08 + Math.random() * 0.08), dest: this.ambBus });
      }
      setTimeout(tick, 1800 + Math.random() * 4200);
    };
    setTimeout(tick, 2000);
  }

  _startMusic() {
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.2;
    setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const m = MOODS[this.mood];
      const stepDur = 60 / m.bpm / 2;
      while (this.nextNote < this.ctx.currentTime + 0.35) {
        this._playStep(m, this.step, this.nextNote, stepDur);
        this.nextNote += stepDur;
        this.step++;
      }
    }, 90);
  }

  _playStep(m, step, when, stepDur) {
    const c = this.ctx;
    const chord = m.chords[Math.floor(step / 16) % m.chords.length];
    const at = when - c.currentTime;
    const o = { dest: this.musicBus, when: Math.max(0, at) };
    if (step % 16 === 0) {
      this.tone(midi(chord[0] - 12), stepDur * 7, { ...o, type: 'triangle', vol: 0.05, attack: 0.02 });
      chord.slice(1).forEach((n) => this.tone(midi(n), stepDur * 15, { ...o, vol: 0.012, attack: 0.4 }));
    }
    if (step % 16 === 8) this.tone(midi(chord[0] - 12), stepDur * 6, { ...o, type: 'triangle', vol: 0.04, attack: 0.02 });
    const pattern = [0, 0, 1, 0, 1, 0, 0, 1];
    if (pattern[step % 8] && Math.random() < 0.8) {
      const n = chord[Math.floor(Math.random() * chord.length)] + 12;
      this.tone(midi(n), stepDur * 1.8, { ...o, vol: 0.03, attack: 0.008 });
      this.tone(midi(n + 12), stepDur * 0.9, { ...o, vol: 0.008, attack: 0.008 });
    }
    if (m.hat && step % 2 === 1) this.hiss(0.04, { filter: 'highpass', freq: 7000, vol: 0.012, when: Math.max(0, at), dest: this.musicBus });
  }
}

export const Audio = new AudioSystem();
