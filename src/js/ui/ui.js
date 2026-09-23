// DOM UI: HUD, toasts, banners, subtitles, panels, montage, act cards, endings.
// The 3D scene never touches the DOM directly; everything goes through here.
import { fmtTime, QUALITY } from '../config.js';
import { G } from '../state/game-state.js';
import { TASKS, CLUES } from '../story/tasks.js';
import { ENDINGS } from '../story/endings.js';
import { ACHIEVEMENTS } from '../story/achievements.js';
import { CAST } from '../characters/looks.js';
import { Audio } from '../audio/audio.js';
import { wait } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LOAD_MSGS = [
  'Preparing your workstation…', 'Checking if the printer works…', 'It does not.', 'Scheduling a meeting about this loading screen…',
  'Refilling the coffee machine…', 'Hiding the good stapler…', 'Renaming files to FINAL…', 'Aligning synergies…',
];
const FX_LABEL = { energy: 'Energy', sanity: 'Sanity', workload: 'Workload', reputation: 'Reputation', rahul: 'Rahul', anu: 'Anu', manager: 'Menon trust' };

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['loading', 'load-bar', 'load-msg', 'rotate', 'fatal', 'title', 'hud', 'hud-time', 'hud-act', 'hud-obj', 'task-count', 'toasts', 'banner', 'subtitle', 'hint', 'btn-act', 'act-label', 'btn-alt', 'dialogue', 'menu-panel', 'mp-title', 'mp-sub', 'mp-list', 'montage', 'm-clock', 'm-task', 'm-fill', 'm-line', 'actcard', 'ac-kicker', 'ac-title', 'ac-time', 'note', 'note-text', 'pause', 'tasks', 'task-list', 'status', 'status-grid', 'settings', 'settings-grid', 'career', 'career-body', 'credits', 'ending', 'end-lines', 'end-summary', 'fade', 'st-bladder', 'btn-continue', 'badge-meta']) this.el[id] = $(id);
    this.bars = {};
    for (const k of ['energy', 'sanity', 'workload']) {
      const bar = document.querySelector(`#st-${k} .bar`);
      bar.innerHTML = '<i></i>'.repeat(10);
      this.bars[k] = { root: $('st-' + k), segs: [...bar.children], last: -1 };
    }
    this.el['load-bar'].innerHTML = '<i></i>'.repeat(10) + '<b>0%</b>';
    this.loadIdx = 0;
    this.modalStack = [];
    this.noteResolve = null;
    this.menuResolve = null;
    this.subTimer = 0;
    // generic [data-close] buttons
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { Audio.play('close'); this.closeTop(); }));
    this.el.note.addEventListener('click', (e) => { if (e.target === this.el.note) this.closeNote(); });
    for (const id of ['pause', 'tasks', 'status', 'settings', 'career', 'credits', 'menu-panel']) {
      this.el[id].addEventListener('pointerdown', (e) => { if (e.target === this.el[id]) { Audio.play('close'); this.closeTop(); } });
    }
  }

  // ------------------------------------------------------------ screens
  show(id) { this.el[id].classList.add('show'); }
  hide(id) { this.el[id].classList.remove('show'); }
  isOpen(id) { return this.el[id].classList.contains('show'); }

  setLoading(p, msg) {
    const segs = this.el['load-bar'].querySelectorAll('i');
    const n = Math.round(p * 10);
    segs.forEach((s, i) => s.classList.toggle('on', i < n));
    this.el['load-bar'].querySelector('b').textContent = Math.round(p * 100) + '%';
    this.el['load-msg'].textContent = msg || LOAD_MSGS[this.loadIdx++ % LOAD_MSGS.length];
  }

  async fade(on, ms = 460) { this.el.fade.classList.toggle('on', on); await wait(ms); }

  // ------------------------------------------------------------ modal stack
  openModal(id) {
    if (!this.modalStack.includes(id)) this.modalStack.push(id);
    this.show(id);
  }
  closeTop() {
    const id = this.modalStack.pop();
    if (!id) return;
    this.hide(id);
    if (id === 'note') this.closeNote(true);
    if (id === 'menu-panel' && this.menuResolve) { const r = this.menuResolve; this.menuResolve = null; r(null); }
    if (this.onModalClosed) this.onModalClosed(id);
  }
  closeAll() { while (this.modalStack.length) this.closeTop(); }
  get modalOpen() { return this.modalStack.length > 0; }

  // ------------------------------------------------------------ HUD
  updateHUD() {
    const s = G.state;
    this.el['hud-time'].textContent = fmtTime(s.time);
    const acts = ['', 'Normal Monday', 'Something Is Wrong', 'The Incident', 'Escape'];
    this.el['hud-act'].textContent = `Act ${s.act} · ${acts[s.act]}`;
    const setBar = (k, v, max) => {
      const b = this.bars[k];
      const n = Math.max(0, Math.min(10, Math.ceil((v / max) * 10 - 0.001)));
      if (n !== b.last) { b.segs.forEach((seg, i) => seg.classList.toggle('on', i < n)); b.last = n; }
    };
    setBar('energy', s.stats.energy, 100);
    setBar('sanity', s.stats.sanity, 100);
    setBar('workload', Math.min(100, s.stats.workload), 100);
    this.bars.energy.root.classList.toggle('low', s.stats.energy < 25);
    this.bars.sanity.root.classList.toggle('low', s.stats.sanity < 25);
    this.bars.workload.root.classList.toggle('high', s.stats.workload > 70);
    this.el['st-bladder'].classList.toggle('show', s.stats.bladder > 80);
    const n = s.tasks.active.length;
    this.el['task-count'].textContent = n;
    this.el['task-count'].style.display = n ? '' : 'none';
  }
  setObjective(text) {
    const o = this.el['hud-obj'];
    if (o.textContent === text) return;
    o.textContent = text;
    o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop');
  }
  flashStat(k) {
    const b = this.bars[k]; if (!b) return;
    b.root.classList.remove('flash'); void b.root.offsetWidth; b.root.classList.add('flash');
  }

  toast(html, cls = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.innerHTML = html;
    const box = this.el.toasts;
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), 2700);
  }
  fxToast(key, delta) {
    const label = FX_LABEL[key]; if (!label) return;
    const good = key === 'workload' ? delta < 0 : delta > 0;
    const d = Math.round(delta);
    if (!d) return;
    this.toast(`${label} <span class="${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</span>`);
    if (['energy', 'sanity', 'workload'].includes(key)) this.flashStat(key);
  }
  banner(text, cls = '') {
    const b = this.el.banner;
    b.className = cls; b.innerHTML = `<span>${esc(text)}</span>`;
    void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => b.classList.remove('show'), 2500);
  }
  subtitle(speaker, text, ms = 3200) {
    if (G.meta.settings.subtitles === false) return;
    const c = CAST[speaker];
    this.el.subtitle.innerHTML = `<p>${c && c.name ? `<b>${esc(c.name)}:</b> ` : ''}${esc(text)}</p>`;
    this.el.subtitle.classList.add('show');
    clearTimeout(this.subTimer);
    this.subTimer = setTimeout(() => this.el.subtitle.classList.remove('show'), ms);
  }
  clearSubtitle() { this.el.subtitle.classList.remove('show'); }
  hint(text) {
    const h = this.el.hint; h.textContent = text;
    h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
    clearTimeout(this.hintT); this.hintT = setTimeout(() => h.classList.remove('show'), 5200);
  }
  setAction(label, pulse = false) {
    const b = this.el['btn-act'];
    if (!label) { b.hidden = true; return; }
    b.hidden = false;
    if (this.el['act-label'].textContent !== label) { this.el['act-label'].textContent = label; b.classList.toggle('long', label.length > 7); }
    b.classList.toggle('pulse', pulse);
  }
  setAlt(label) { const b = this.el['btn-alt']; if (!label) b.hidden = true; else { b.hidden = false; b.textContent = label; } }

  async actCard(kicker, title, time) {
    this.el['ac-kicker'].textContent = kicker; this.el['ac-title'].textContent = title; this.el['ac-time'].textContent = time;
    const a = this.el.actcard; a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
    setTimeout(() => a.classList.remove('show'), 4300);
  }

  note(text) {
    this.el['note-text'].textContent = text;
    this.openModal('note');
    Audio.play('open');
    return new Promise((r) => { this.noteResolve = r; });
  }
  closeNote(fromStack) {
    if (!fromStack) { const i = this.modalStack.indexOf('note'); if (i >= 0) this.modalStack.splice(i, 1); this.hide('note'); }
    const r = this.noteResolve; this.noteResolve = null; if (r) r();
    if (!fromStack && this.onModalClosed) this.onModalClosed('note');
  }

  // Option menu (computer, printer...). options: [{ t, sub, hot, disabled }]. Resolves index or null.
  menu(title, sub, options) {
    this.el['mp-title'].textContent = title;
    this.el['mp-sub'].textContent = sub || '';
    this.el['mp-sub'].style.display = sub ? '' : 'none';
    const list = this.el['mp-list']; list.innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (o.hot ? ' hot' : '');
      if (o.disabled) b.disabled = true;
      b.innerHTML = `<b>${esc(o.t)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}`;
      b.addEventListener('click', () => {
        Audio.play('click');
        const r = this.menuResolve; this.menuResolve = null;
        const idx = this.modalStack.indexOf('menu-panel'); if (idx >= 0) this.modalStack.splice(idx, 1);
        this.hide('menu-panel');
        if (r) r(i);
      });
      list.appendChild(b);
    });
    this.openModal('menu-panel');
    Audio.play('open');
    return new Promise((r) => { this.menuResolve = r; });
  }

  // Work montage: the clock races, a progress bar fills, jokes cycle.
  async montage(title, from, to, lines, reducedMotion) {
    const el = this.el; this.show('montage');
    el['m-task'].textContent = title;
    const dur = reducedMotion ? 1200 : Math.min(4200, 1600 + (to - from) * 35);
    const start = performance.now();
    let li = -1;
    await new Promise((res) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / dur);
        const e = t * t * (3 - 2 * t);
        el['m-clock'].textContent = fmtTime(from + (to - from) * e);
        el['m-fill'].style.width = (e * 100).toFixed(1) + '%';
        const idx = Math.min(lines.length - 1, Math.floor(t * lines.length));
        if (idx !== li) { li = idx; el['m-line'].textContent = lines[idx] || ''; }
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    await wait(450);
    this.hide('montage');
  }

  // ------------------------------------------------------------ panels
  renderTasks() {
    const s = G.state;
    const items = s.tasks.active.map((id) => `<li><b>${esc(TASKS[id]?.name || id)}</b><span>${esc(TASKS[id]?.where || '')}</span></li>`)
      .concat(s.tasks.done.slice(-5).reverse().map((id) => `<li class="done"><b>${esc(TASKS[id]?.name || id)}</b></li>`));
    this.el['task-list'].innerHTML = items.length ? items.join('') : '<li class="empty">Nothing on your plate. Suspicious.</li>';
  }
  renderStatus() {
    const s = G.state;
    const meter = (label, v, max, c) => `<div class="meter"><span>${label}</span><i style="--v:${Math.min(100, (v / max) * 100)}%;--c:${c}"></i><em>${Math.round(v)}</em></div>`;
    const clues = s.clues.length ? s.clues.map((c) => `<li>${esc(CLUES[c] || c)}</li>`).join('') : '<li class="none">Nothing yet. Keep your ears open near conversations.</li>';
    this.el['status-grid'].innerHTML = `
      <div><h3>You</h3>${meter('Energy', s.stats.energy, 100, '#8cc63f')}${meter('Sanity', s.stats.sanity, 100, '#2bb39a')}${meter('Workload', s.stats.workload, 100, '#e5484d')}${meter('Reputation', s.stats.reputation, 100, '#2f6fe4')}${meter('Restroom', s.stats.bladder, 100, '#c77d1a')}
      <h3 style="margin-top:12px">People</h3>${meter('Rahul', s.rel.rahul, 100, '#d4483b')}${meter('Anu', s.rel.anu, 100, '#2b9a8d')}${meter('Menon trust', s.rel.manager, 100, '#c77d1a')}</div>
      <div><h3>Notes &amp; clues</h3><ul class="clue-list">${clues}</ul>
      <h3 style="margin-top:12px">Office jokes found</h3><p style="margin:0;font-size:.9rem">${s.jokes.length} / 14</p></div>`;
  }
  renderSettings(onChange) {
    const st = G.meta.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const range = (key, min, max, step) => `<input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${st[key]}">`;
    this.el['settings-grid'].innerHTML = `
      <div class="setting"><label>Graphics quality</label>${seg('quality', Object.entries(QUALITY).map(([k, q]) => [k, q.label]))}<div class="fine">Low is best for older phones.</div></div>
      <div class="setting"><label>Text size</label>${seg('textSize', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])}</div>
      <div class="setting"><label>Music</label>${range('music', 0, 1, 0.05)}</div>
      <div class="setting"><label>Sound effects</label>${range('sfx', 0, 1, 0.05)}</div>
      <div class="setting"><label>Mute all</label>${seg('mute', [[false, 'Off'], [true, 'On']])}</div>
      <div class="setting"><label>Camera sensitivity</label>${range('sensitivity', 0.4, 2, 0.1)}</div>
      <div class="setting"><label>Invert camera Y</label>${seg('invertY', [[false, 'Off'], [true, 'On']])}</div>
      <div class="setting"><label>Reduced motion</label>${seg('reducedMotion', [[false, 'Off'], [true, 'On']])}</div>
      <div class="setting"><label>Overheard subtitles</label>${seg('subtitles', [[true, 'On'], [false, 'Off']])}</div>
      <div class="setting"><label>Reset all progress</label><button class="btn small danger" id="btn-reset">Reset…</button><div class="fine">Deletes your save, career stats and achievements.</div></div>`;
    const grid = this.el['settings-grid'];
    grid.querySelectorAll('.seg').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const key = g.dataset.key; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false;
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      Audio.play('click');
      onChange(key, v);
    })));
    grid.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => onChange(r.dataset.key, parseFloat(r.value))));
    const reset = grid.querySelector('#btn-reset');
    let armed = false;
    reset.addEventListener('click', () => {
      if (!armed) { armed = true; reset.textContent = 'Tap again to confirm'; setTimeout(() => { armed = false; reset.textContent = 'Reset…'; }, 3000); return; }
      onChange('__reset', true);
      reset.textContent = 'Done';
    });
  }
  renderCareer() {
    const m = G.meta, c = m.career;
    const cs = (v, l, cls = '') => `<div class="cstat ${cls}"><b>${v}</b><span>${l}</span></div>`;
    const endings = Object.entries(ENDINGS).map(([k, e]) => m.endings?.includes?.(k) || c.endings.includes(k) ? `<div><b>${esc(e.name)}</b>${esc(e.tag)}</div>` : '<div class="locked"><b>???</b>Not found yet</div>').join('');
    const ach = Object.entries(ACHIEVEMENTS).map(([k, a]) => m.achievements.includes(k) ? `<div class="got"><b>${esc(a.name)}</b>${esc(a.desc)}</div>` : `<div class="locked"><b>${esc(a.name)}</b>Locked</div>`).join('');
    const hrs = Math.floor(c.minutes / 60), mins = Math.round(c.minutes % 60);
    this.el['career-body'].innerHTML = `
      <div class="career-stats">
        ${cs(c.sure, 'Times you said "Sure"', 'hero')}${cs(c.days, 'Mondays survived')}${cs(`${c.endings.length}/${Object.keys(ENDINGS).length}`, 'Endings found')}
        ${cs(c.tasks, 'Tasks completed')}${cs(c.coffees, 'Coffees')}${cs(c.meetings, 'Meetings attended')}${cs(c.printer, 'Printer battles lost')}
        ${cs(c.requests, 'Requests received')}${cs(`${hrs}h ${mins}m`, 'In the office')}
      </div>
      <div class="sub-h">Endings</div><div class="ending-list">${endings}</div>
      <div class="sub-h">Achievements · ${m.achievements.length}/${Object.keys(ACHIEVEMENTS).length}</div><div class="ach-list">${ach}</div>`;
  }

  // ------------------------------------------------------------ ending
  async ending(id, lines, reducedMotion) {
    const el = this.el;
    el['end-lines'].innerHTML = `<div class="kick">Ending · ${esc(ENDINGS[id].name)}</div>` + lines.map(([t, cls]) => `<p class="${cls || ''}">${esc(t)}</p>`).join('');
    el['end-lines'].style.display = '';
    el['end-summary'].classList.remove('show');
    this.show('ending');
    const ps = [...el['end-lines'].querySelectorAll('p')];
    let skip = false;
    const onTap = () => { skip = true; };
    el.ending.addEventListener('pointerdown', onTap);
    await wait(reducedMotion ? 200 : 700);
    for (const p of ps) {
      p.classList.add('in');
      if (!skip) await wait(p.classList.contains('huge') ? 1700 : 1250);
    }
    await wait(skip ? 400 : 2200);
    el.ending.removeEventListener('pointerdown', onTap);
  }
  showEndSummary(id, s, newAch) {
    const el = this.el;
    const c = s.counters;
    const stat = (v, l, cls = '') => `<div class="${cls}"><b>${v}</b><span>${l}</span></div>`;
    const ach = newAch.length ? `<p class="end-ach">New achievements: <b>${newAch.map((a) => esc(ACHIEVEMENTS[a].name)).join(', ')}</b></p>` : '';
    el['end-lines'].style.display = 'none';
    el['end-summary'].innerHTML = `
      <div class="end-head"><h2>${esc(ENDINGS[id].name)}</h2><span>Left at ${fmtTime(s.leftAt ?? s.time)}</span></div>
      <div class="end-grid">
        ${stat(c.sure, 'Times you said "Sure"', 'hero')}${stat(c.tasksDone, 'Tasks completed')}${stat(c.requests, 'Requests received')}
        ${stat(c.coffees, 'Coffees')}${stat(c.meetings, 'Meetings')}${stat(c.dodged, 'Menon dodges')}${stat(s.clues.length, 'Clues found')}
      </div>${ach}
      <div class="end-actions"><button class="btn primary" data-end="again">New day</button><button class="btn" data-end="title">Title screen</button></div>`;
    el['end-summary'].classList.add('show');
    return new Promise((res) => {
      el['end-summary'].querySelectorAll('[data-end]').forEach((b) => b.addEventListener('click', () => { Audio.play('click'); res(b.dataset.end); }));
    });
  }
}
