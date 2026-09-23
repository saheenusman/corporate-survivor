// Dialogue presenter + runner. Plays a dialogue tree from story/dialogues.js:
// typewriter text with speaker blips, ID-badge speaker labels, 2x2 choice grid,
// tap / Space / Enter to advance, number keys for choices.
import { DLG, requestChoices } from '../story/dialogues.js';
import { CAST } from '../characters/looks.js';
import { G, applyFx } from '../state/game-state.js';
import { Audio } from '../audio/audio.js';

const $ = (id) => document.getElementById(id);

export class DialogueUI {
  constructor() {
    this.layer = $('dialogue'); this.box = $('dlg-box'); this.badge = $('dlg-badge');
    this.nameEl = $('dlg-name'); this.roleEl = $('dlg-role'); this.textEl = $('dlg-text');
    this.nextEl = $('dlg-next'); this.choicesEl = $('dlg-choices');
    this.active = false; this.typing = false; this.advance = null; this.choiceResolve = null; this.choiceList = [];
    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.choice')) return;
      this.tap();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); this.tap(); }
      if (e.code.startsWith('Digit')) { const i = parseInt(e.code.slice(5), 10) - 1; this.pick(i); }
    });
  }

  tap() {
    if (this.choiceResolve) return;
    if (this.typing) { this.typing = false; return; }
    if (this.advance) { const a = this.advance; this.advance = null; Audio.play('click'); a(); }
  }
  pick(i) {
    if (!this.choiceResolve || !this.choiceList[i]) return;
    const r = this.choiceResolve; this.choiceResolve = null;
    Audio.play('click');
    r(this.choiceList[i]);
  }

  // hooks: { onLine(node), onEndLine(node), call(name) -> Promise<'end'|void>, pendingTask }
  async run(key, hooks = {}) {
    this.active = true;
    document.getElementById('actcard').classList.remove('show');
    document.getElementById('banner').classList.remove('show');
    this.layer.classList.add('show');
    this.choicesEl.innerHTML = '';
    let nodes = DLG[key], i = 0, ended = false;
    while (nodes && i < nodes.length && !ended) {
      const n = nodes[i++];
      if (n.if && !n.if(G.state)) continue;
      if (n.choices) {
        let list = typeof n.choices === 'string' ? requestChoices(n.choices.split(':')[1], G.state) : n.choices;
        list = list.filter((c) => !c.if || c.if(G.state));
        const c = await this.choose(list);
        if (c.fx) applyFx(this.subst(c.fx, hooks));
        if (c.walk) Audio.play('whoosh');
        if (c.call && (await hooks.call?.(this.substCall(c.call, hooks))) === 'end') { ended = true; break; }
        if (c.next) { nodes = DLG[c.next]; i = 0; continue; }
        break;
      }
      await this.say(n, hooks);
      if (n.fx) applyFx(this.subst(n.fx, hooks));
      if (n.call && (await hooks.call?.(this.substCall(n.call, hooks))) === 'end') ended = true;
    }
    this.close();
  }

  subst(fx, hooks) {
    if (fx.task === '$pending') return { ...fx, task: hooks.pendingTask || null };
    return fx;
  }
  substCall(call, hooks) { return call.replace('$via', hooks.via || 'elevator'); }

  close() {
    this.active = false; this.typing = false; this.advance = null;
    this.layer.classList.remove('show', 'over-fade');
    this.choicesEl.innerHTML = '';
  }

  async say(n, hooks) {
    const who = n.s || 'narrator';
    const cast = CAST[who] || CAST.narrator;
    const text = typeof n.t === 'function' ? n.t(G.state) : n.t;
    this.box.classList.toggle('narrator', who === 'narrator');
    this.box.classList.toggle('inner', !!n.inner);
    if (who === 'narrator') this.badge.classList.add('hidden');
    else {
      this.badge.classList.remove('hidden');
      this.badge.style.setProperty('--c', cast.color);
      this.nameEl.textContent = n.inner ? 'You (thinking)' : cast.name;
      this.roleEl.textContent = n.inner ? '' : cast.role;
    }
    this.choicesEl.innerHTML = '';
    this.nextEl.classList.remove('show');
    this.layer.classList.toggle('over-fade', document.getElementById('fade').classList.contains('on'));
    hooks.onLine?.(n, who);
    // typewriter
    const rm = G.meta.settings.reducedMotion;
    this.typing = !rm;
    const start = performance.now();
    const cps = 58;
    if (rm) this.textEl.textContent = text;
    else {
      this.textEl.textContent = '';
      let shown = 0;
      await new Promise((res) => {
        const step = () => {
          if (!this.typing) { this.textEl.textContent = text; res(); return; }
          const want = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * cps));
          if (want > shown) {
            if (who !== 'narrator' && Math.floor(want / 3) > Math.floor(shown / 3)) Audio.play('blip', { pitch: (cast.pitch || 380) * (0.92 + Math.random() * 0.16) });
            shown = want; this.textEl.textContent = text.slice(0, shown);
          }
          if (shown >= text.length) { res(); return; }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    this.typing = false;
    hooks.onEndLine?.(n, who);
    this.nextEl.classList.add('show');
    await new Promise((res) => { this.advance = res; });
  }

  choose(list) {
    this.nextEl.classList.remove('show');
    this.choiceList = list;
    this.choicesEl.innerHTML = '';
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice' + (c.walk ? ' walk' : '');
      const t = typeof c.t === 'function' ? c.t(G.state) : c.t;
      const note = c.note ? (typeof c.note === 'function' ? c.note(G.state) : c.note) : '';
      b.innerHTML = `<span class="k">${i + 1}</span><span>${t.replace(/</g, '&lt;')}${note ? `<span class="note">${note}</span>` : ''}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.pick(i); });
      this.choicesEl.appendChild(b);
    });
    return new Promise((r) => { this.choiceResolve = r; });
  }
}
