// All textures are painted at runtime on canvases: no image downloads, tiny build,
// and every joke sign in the office is real text in a single texture atlas.
import * as THREE from 'three';
import { mulberry } from '../core/util.js';

export const FONT = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  cond: '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif',
  hand: '"Marker Felt", "Chalkboard SE", "Segoe Print", "Bradley Hand", casual, cursive',
};

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

export function carpetTexture(base = '#6f7b89', seed = 3) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = mulberry(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  // carpet tiles: alternate grain direction per tile
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    g.save(); g.beginPath(); g.rect(tx * 128, ty * 128, 128, 128); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.035)'; g.lineWidth = 1;
    for (let i = 0; i < 128; i += 4) {
      g.beginPath();
      if ((tx + ty) % 2) { g.moveTo(tx * 128 + i, ty * 128); g.lineTo(tx * 128 + i, ty * 128 + 128); }
      else { g.moveTo(tx * 128, ty * 128 + i); g.lineTo(tx * 128 + 128, ty * 128 + i); }
      g.stroke();
    }
    g.restore();
  }
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.5;
  g.strokeRect(0.5, 0.5, 128, 128); g.strokeRect(128.5, 128.5, 127, 127);
  return tex(c);
}

export function woodTexture(base = [184, 138, 94], seed = 5) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = mulberry(seed);
  for (let i = 0; i < 8; i++) {
    const k = 0.88 + r() * 0.2;
    g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    g.fillRect(0, i * 32, 256, 32);
    g.strokeStyle = 'rgba(60,35,20,0.12)';
    for (let j = 0; j < 5; j++) {
      g.beginPath(); const y = i * 32 + 4 + r() * 24; g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + j) * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,25,15,0.35)'; g.fillRect(0, i * 32, 256, 1.5);
    const off = r() * 256; g.fillRect(off, i * 32, 1.5, 32);
  }
  return tex(c);
}

export function terrazzoTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), r = mulberry(9);
  g.fillStyle = '#dcd8d0'; g.fillRect(0, 0, 256, 256);
  const cols = ['#b9b2a6', '#9aa3ad', '#c9a27a', '#8e8a84', '#ece9e3'];
  for (let i = 0; i < 900; i++) { g.fillStyle = cols[i % cols.length]; const s = 1 + r() * 4; g.fillRect(r() * 256, r() * 256, s, s * (0.5 + r())); }
  g.strokeStyle = 'rgba(0,0,0,0.08)'; g.strokeRect(0.5, 0.5, 255, 255);
  return tex(c);
}

export function tileTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), r = mulberry(13);
  g.fillStyle = '#b9c1c6'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const k = 236 + (r() * 12 | 0);
    g.fillStyle = `rgb(${k},${k + 2},${k + 3})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  return tex(c);
}

export function skylineTexture() {
  const c = canvas(1024, 256), g = c.getContext('2d'), r = mulberry(21);
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#8fbfee'); sky.addColorStop(0.7, '#d9ebf8'); sky.addColorStop(1, '#f2f1ea');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 6; i++) { const x = r() * 1024, y = 30 + r() * 60; g.beginPath(); g.ellipse(x, y, 60 + r() * 60, 10 + r() * 6, 0, 0, Math.PI * 2); g.fill(); }
  const layer = (col, minH, maxH, winCol) => {
    let x = -10;
    while (x < 1034) {
      const w = 40 + r() * 70, h = minH + r() * (maxH - minH);
      g.fillStyle = col; g.fillRect(x, 256 - h, w, h);
      if (winCol) {
        g.fillStyle = winCol;
        for (let wy = 256 - h + 8; wy < 250; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 10) if (r() > 0.35) g.fillRect(wx, wy, 5, 6);
        g.fillStyle = col;
      }
      if (r() > 0.7) g.fillRect(x + w / 2 - 2, 256 - h - 18, 3, 18);
      x += w + r() * 6;
    }
  };
  layer('#b7c7d6', 60, 170, null);
  layer('#8ea3b8', 40, 130, 'rgba(230,240,250,0.55)');
  layer('#6f8196', 20, 80, 'rgba(255,236,190,0.5)');
  return tex(c);
}

// --------------------------------------------------------------- monitor screens
function screen(draw, w = 256, h = 160) {
  const c = canvas(w, h), g = c.getContext('2d');
  draw(g, w, h);
  const t = tex(c, true);
  return t;
}

export function makeScreenTextures() {
  const r = mulberry(33);
  const S = {};
  S.code = screen((g, w, h) => {
    g.fillStyle = '#1e222b'; g.fillRect(0, 0, w, h);
    const cols = ['#e06c75', '#98c379', '#61afef', '#c678dd', '#e5c07b', '#abb2bf'];
    for (let y = 6; y < h; y += 9) {
      let x = 8 + ((r() * 4) | 0) * 10;
      while (x < w - 20 && r() > 0.12) { const l = 10 + r() * 40; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, y, l, 4); x += l + 6; }
    }
  });
  S.sheet = screen((g, w, h) => {
    g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f7a4c'; g.fillRect(0, 0, w, 20);
    g.fillStyle = '#fff'; g.font = `bold 10px ${FONT.sans}`; g.fillText('FINAL_FINAL_v7_REAL_FINAL.xlsx', 6, 14);
    g.strokeStyle = '#d4dbd6';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, h); g.stroke(); }
    for (let y = 20; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.8 ? '#f6d365' : '#c7e8d4'; g.fillRect(((r() * 8) | 0) * 32 + 2, 22 + ((r() * 13) | 0) * 10, 28, 7); }
  });
  S.mail = screen((g, w, h) => {
    g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f6fe4'; g.fillRect(0, 0, 58, h);
    g.fillStyle = '#fff'; g.font = `bold 10px ${FONT.sans}`; g.fillText('Inbox 1,284', 4, 16);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 3 === 0 ? '#1d2433' : '#8d96a8'; g.fillRect(66, 8 + i * 12, 60 + r() * 40, 4);
      g.fillStyle = '#c3c9d4'; g.fillRect(140, 8 + i * 12, 90 + r() * 20, 4);
    }
  });
  S.chat = screen((g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f0e40'; g.fillRect(0, 0, 50, h);
    for (let i = 0; i < 9; i++) {
      const me = r() > 0.6;
      g.fillStyle = me ? '#2f6fe4' : '#e9ecf1';
      const bw = 40 + r() * 90; g.fillRect(me ? w - bw - 10 : 60, 8 + i * 17, bw, 11);
    }
  });
  S.deck = screen((g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c77d1a'; g.fillRect(0, 0, w, 6);
    g.fillStyle = '#1d2433'; g.font = `bold 16px ${FONT.cond}`; g.fillText('Q3 SYNERGY', 12, 30);
    const bars = [30, 55, 42, 80, 20];
    bars.forEach((b, i) => { g.fillStyle = i === 3 ? '#e5484d' : '#2f6fe4'; g.fillRect(20 + i * 40, 140 - b, 26, b); });
  });
  S.red = screen((g, w, h) => {
    g.fillStyle = '#b3141b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe3e3'; g.font = `bold 22px ${FONT.cond}`; g.textAlign = 'center';
    g.fillText('PRODUCTION', w / 2, 62); g.fillText('IS DOWN', w / 2, 88);
    g.font = `12px ${FONT.sans}`; g.fillText('air fryers sold for ₹0: 40,112', w / 2, 118);
  });
  S.off = screen((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a2f38'); gr.addColorStop(1, '#161a20');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(w * 0.55, 0); g.lineTo(w, 0); g.lineTo(w * 0.35, h); g.lineTo(0, h); g.fill();
  });
  S.player = screen((g, w, h) => {
    g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, w, 16);
    g.fillStyle = '#fff'; g.font = `bold 10px ${FONT.sans}`; g.fillText('Q3_deck_v12.pptx — Not responding', 6, 12);
    g.fillStyle = '#ffffff'; g.fillRect(16, 26, w - 32, h - 40);
    g.fillStyle = '#e5484d'; g.font = `bold 14px ${FONT.cond}`; g.fillText('Click to add title', 30, 60);
    g.fillStyle = '#b7bdc8'; for (let i = 0; i < 4; i++) g.fillRect(30, 76 + i * 12, 150 - i * 20, 5);
  });
  S.tv = screen((g, w, h) => {
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd84d'; g.font = `bold 20px ${FONT.cond}`; g.fillText('ALIGNMENT OF', 16, 34); g.fillText('ALIGNMENTS', 16, 58);
    g.fillStyle = '#2f6fe4'; g.beginPath(); g.arc(196, 104, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `11px ${FONT.sans}`; g.fillText('Meetings: 100%', 16, 96); g.fillText('Work: see next slide', 16, 114);
    g.fillText('Next slide: none', 16, 132);
  }, 256, 160);
  S.vend = screen((g, w, h) => {
    g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h);
    const cols = ['#e5484d', '#ffd84d', '#2bb39a', '#2f6fe4', '#c0587a', '#f28c28'];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(8 + x * 36, 10 + y * 44, 32, 38);
      g.fillStyle = cols[(x + y * 2) % cols.length]; g.fillRect(14 + x * 36, 20 + y * 44, 20, 24);
    }
    g.fillStyle = '#2b3140'; g.fillRect(156, 10, 92, h - 20);
    g.fillStyle = '#7fe0c5'; g.font = `bold 12px ${FONT.sans}`; g.fillText('INSERT', 176, 40); g.fillText('HOPE', 182, 56);
  }, 256, 256);
  for (const k in S) { S[k].wrapS = S[k].wrapT = THREE.ClampToEdgeWrapping; }
  S.code.wrapT = THREE.RepeatWrapping; S.chat.wrapT = THREE.RepeatWrapping;
  return S;
}

// --------------------------------------------------------------- sign atlas
export class Atlas {
  constructor(w = 2048, h = 1024) {
    this.W = w; this.H = h;
    this.c = canvas(w, h); this.g = this.c.getContext('2d');
    this.g.fillStyle = '#ffffff'; this.g.fillRect(0, 0, w, h);
    this.x = 0; this.y = 0; this.row = 0; this.rects = {};
  }
  add(key, w, h, draw) {
    if (this.x + w > this.W) { this.x = 0; this.y += this.row + 4; this.row = 0; }
    const x = this.x, y = this.y;
    const g = this.g;
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore();
    this.rects[key] = { u0: (x + 1) / this.W, u1: (x + w - 1) / this.W, v0: 1 - (y + h - 1) / this.H, v1: 1 - (y + 1) / this.H, aspect: w / h };
    this.x += w + 4; this.row = Math.max(this.row, h);
    return this.rects[key];
  }
  texture() { const t = tex(this.c, false); t.anisotropy = 8; return t; }
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y;
}

function sticky(color = '#ffd84d', ink = '#2a2a2a') {
  return (text, size = 22) => (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, 10);
    g.fillStyle = ink; g.font = `${size}px ${FONT.hand}`; g.textAlign = 'center';
    wrapText(g, text, w / 2, 40, w - 16, size * 1.15);
  };
}

function plate(bg, fg, lines, opts = {}) {
  return (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }
    g.fillStyle = fg; g.textAlign = opts.align || 'center';
    let y = opts.top || h / 2;
    for (const [txt, size, font = FONT.cond, weight = 'bold'] of lines) {
      g.font = `${weight} ${size}px ${font}`;
      const x = (opts.align === 'left') ? 24 : w / 2;
      y = wrapText(g, txt, x, y, w - 36, size * 1.15) + size * 1.25;
    }
  };
}

function poster(title, body, bg, accent) {
  return (g, w, h) => {
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, w, h);
    g.fillStyle = bg; g.fillRect(12, 12, w - 24, h - 24);
    // mountain/sunrise motif
    g.fillStyle = accent; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(29,36,51,0.85)'; g.beginPath(); g.moveTo(12, h * 0.6); g.lineTo(w * 0.38, h * 0.3); g.lineTo(w * 0.55, h * 0.48); g.lineTo(w * 0.72, h * 0.34); g.lineTo(w - 12, h * 0.6); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `bold 44px ${FONT.cond}`; g.fillText(title, w / 2, h * 0.72);
    g.font = `22px ${FONT.sans}`; wrapText(g, body, w / 2, h * 0.8, w - 60, 26);
  };
}

export function buildSignAtlas() {
  const A = new Atlas(2048, 1024);
  const yellow = sticky('#ffd84d'), pink = sticky('#ff9fb4'), blue = sticky('#9fd3ff');

  A.add('wb_meeting', 512, 256, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d4fb8'; g.font = `bold 34px ${FONT.hand}`; g.textAlign = 'center'; g.fillText('MEETING ABOUT THE MEETING', w / 2, 46);
    g.textAlign = 'left'; g.font = `22px ${FONT.hand}`; g.fillStyle = '#222';
    ['1. Agree on the agenda', '2. Schedule a follow-up', '3. ???', '4. Synergy'].forEach((t, i) => g.fillText(t, 40, 92 + i * 34));
    g.strokeStyle = '#d6343b'; g.lineWidth = 4; g.beginPath(); g.ellipse(88, 158, 40, 18, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1b8a4f'; g.font = `20px ${FONT.hand}`; g.fillText('action items: 0', 320, 220);
  });
  A.add('wb_chart', 512, 320, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 30); g.lineTo(60, 260); g.lineTo(480, 260); g.stroke();
    g.strokeStyle = '#d6343b'; g.lineWidth = 5; g.beginPath(); g.moveTo(70, 60); g.bezierCurveTo(200, 70, 260, 200, 470, 250); g.stroke();
    g.fillStyle = '#222'; g.font = `22px ${FONT.hand}`; g.fillText('productivity', 70, 50);
    g.fillText('number of meetings →', 250, 294);
    g.fillStyle = '#1d4fb8'; g.font = `bold 40px ${FONT.hand}`; g.fillText('WHY?', 330, 120);
  });
  A.add('sign_meeting', 512, 96, plate('#1d2433', '#ffd84d', [['SYNERGY ALIGNMENT SESSION', 38], ['in progress (always)', 20, FONT.sans, 'normal']], { top: 44 }));
  A.add('sign_manager', 512, 96, plate('#1d2433', '#ffffff', [['MANAGER', 38], ['Door always open*   *closed', 20, FONT.sans, 'normal']], { top: 44 }));
  A.add('sign_restroom', 320, 96, plate('#2f6fe4', '#ffffff', [['RESTROOM', 44]], { top: 62 }));
  A.add('sign_cafe', 512, 96, plate('#e0a83a', '#1d2433', [['CAFETERIA', 40], ['Today: Mystery Curry', 20, FONT.sans, 'normal']], { top: 44 }));
  A.add('exit', 256, 96, plate('#16a34a', '#ffffff', [['EXIT', 64]], { top: 72 }));
  A.add('logo', 640, 160, (g, w, h) => {
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(80, 80, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1d2433'; g.beginPath(); g.arc(80, 80, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = `bold 78px ${FONT.cond}`; g.fillText('SYNERGEX', 150, 96);
    g.font = `22px ${FONT.sans}`; g.fillStyle = '#b9c2d6'; g.fillText('We Align Things™', 154, 130);
  });
  A.add('poster_team', 320, 440, poster('TEAMWORK', 'Because nobody can be blamed alone.', '#2f6fe4', '#ffd84d'));
  A.add('poster_innov', 320, 440, poster('INNOVATION', 'Doing the same thing, but in a meeting.', '#2bb39a', '#ffffff'));
  A.add('poster_quick', 320, 440, poster('ONE MORE', 'Quick Thing™. It never is.', '#e5484d', '#ffd84d'));
  A.add('poster_eotm', 320, 400, (g, w, h) => {
    g.fillStyle = '#8a6443'; g.fillRect(0, 0, w, h); g.fillStyle = '#fbf6e8'; g.fillRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#c77d1a'; g.font = `bold 30px ${FONT.cond}`; g.textAlign = 'center'; g.fillText('EMPLOYEE', w / 2, 70); g.fillText('OF THE MONTH', w / 2, 104);
    g.fillStyle = '#a86f45'; g.beginPath(); g.arc(w / 2, 190, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a837d'; g.fillRect(w / 2 - 56, 170, 20, 30); g.fillRect(w / 2 + 36, 170, 20, 30);
    g.fillStyle = '#1d2433'; g.font = `bold 26px ${FONT.sans}`; g.fillText('Mr. Menon', w / 2, 290);
    g.font = `italic 18px ${FONT.sans}`; g.fillText('(self-nominated)', w / 2, 318); g.fillText('every month since 2019', w / 2, 344);
  });
  A.add('calendar', 256, 300, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e5484d'; g.fillRect(0, 0, w, 50); g.fillStyle = '#fff'; g.font = `bold 26px ${FONT.cond}`; g.textAlign = 'center'; g.fillText('THIS WEEK', w / 2, 35);
    g.fillStyle = '#1d2433'; g.font = `bold 20px ${FONT.sans}`;
    for (let i = 0; i < 5; i++) g.fillText('MONDAY', w / 2, 88 + i * 44);
  });
  A.add('sticky_player', 160, 160, yellow('DO NOT FORGET TO UPDATE THE STICKY NOTE', 20));
  A.add('sticky_pwd', 160, 160, pink('pwd: password123_FINAL', 22));
  A.add('sticky_anu', 160, 160, blue("Tuesday's tasks: DONE ✓", 22));
  A.add('sticky_rahul', 160, 160, yellow('look busy', 30));
  A.add('ooo', 256, 128, plate('#ffffff', '#d6343b', [['OUT OF ORDER', 38]], { top: 76, border: '#d6343b' }));
  A.add('ooo2', 256, 128, (g, w, h) => {
    g.fillStyle = '#fffdf2'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = `20px ${FONT.hand}`; g.textAlign = 'center';
    wrapText(g, 'IT HAS BEEN OUT OF ORDER FOR 8 MONTHS', w / 2, 42, w - 20, 26);
  });
  A.add('fridge_note', 200, 200, yellow('WHOEVER TOOK MY YOGURT: I KNOW. — K', 22));
  A.add('microwave_note', 320, 160, plate('#ffffff', '#1d2433', [['DO NOT MICROWAVE FISH.', 26], ['THIS MEANS YOU, SURESH.', 22, FONT.sans]], { top: 60, border: '#e5484d' }));
  A.add('plant_tag', 200, 100, plate('#ffffff', '#1d2433', [['FAKE PLANT', 26], ['please do not water', 16, FONT.sans, 'normal']], { top: 40 }));
  A.add('mirror', 320, 90, (g, w, h) => { g.fillStyle = '#ffd84d'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2433'; g.font = `24px ${FONT.hand}`; g.textAlign = 'center'; g.fillText("YOU'RE DOING GREAT", w / 2, 40); g.font = `18px ${FONT.hand}`; g.fillText('(probably)', w / 2, 72); });
  A.add('wash', 320, 160, plate('#ffffff', '#1d2433', [['Employees must wash hands.', 24, FONT.sans], ['Managers must wash hands twice.', 20, FONT.sans, 'normal']], { top: 56, border: '#2f6fe4' }));
  A.add('printer_label', 320, 110, plate('#ffffff', '#1d2433', [['PRINTER 2', 36], ['(printer 1 was a lie)', 20, FONT.sans, 'normal']], { top: 48 }));
  A.add('prod_label', 220, 120, (g, w, h) => {
    g.fillStyle = '#ffd84d'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3141b'; g.font = `bold 26px ${FONT.cond}`; g.textAlign = 'center';
    g.fillText('PRODUCTION', w / 2, 42); g.font = `20px ${FONT.hand}`; g.fillStyle = '#222'; g.fillText('DO NOT TOUCH', w / 2, 76); g.fillText('(seriously)', w / 2, 102);
  });
  A.add('menu', 420, 300, (g, w, h) => {
    g.fillStyle = '#243224'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6443'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f7f3ea'; g.font = `bold 34px ${FONT.hand}`; g.textAlign = 'center'; g.fillText('THIS WEEK', w / 2, 56);
    g.font = `22px ${FONT.hand}`; g.textAlign = 'left';
    ['MON  Mystery Curry', 'TUE  Mystery Curry', 'WED  Curry Mystery', 'THU  ???', 'FRI  Leftover Mystery'].forEach((t, i) => g.fillText(t, 36, 102 + i * 38));
  });
  A.add('clock', 256, 256, (g, w, h) => {
    g.fillStyle = '#ebe5da'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#1d2433'; g.beginPath(); g.arc(128, 128, 119, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1d2433';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-3, -108, 6, i % 3 ? 12 : 22); g.restore(); }
    g.font = `bold 16px ${FONT.cond}`; g.textAlign = 'center'; g.fillText('SYNERGEX', 128, 170);
  });
  A.add('elevator_panel', 120, 200, (g, w, h) => {
    g.fillStyle = '#c9ced4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2433'; g.fillRect(20, 20, 80, 50);
    g.fillStyle = '#ffb14a'; g.font = `bold 30px ${FONT.cond}`; g.textAlign = 'center'; g.fillText('13', 60, 56);
    g.fillStyle = '#e9ecef'; g.beginPath(); g.arc(60, 118, 20, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(60, 164, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1d2433'; g.beginPath(); g.moveTo(60, 106); g.lineTo(70, 124); g.lineTo(50, 124); g.fill(); g.beginPath(); g.moveTo(60, 176); g.lineTo(70, 158); g.lineTo(50, 158); g.fill();
  });
  A.add('stairs_note', 200, 140, yellow('13 floors. The elevator is RIGHT THERE.', 20));
  A.add('meeting_glass', 256, 64, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfd6de'; for (let x = 0; x < w; x += 16) g.fillRect(x, 20, 8, 24); });
  return A;
}
