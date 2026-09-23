// Central tuning values. Everything gameplay-feel related lives here so it can be
// adjusted without hunting through systems.
export const T = (h, m = 0) => h * 60 + m;

export const CONFIG = {
  DAY_START: T(8, 57),
  DAY_END: T(17, 30),
  // Real seconds per in-game minute. A full untouched day is ~21 minutes; tasks,
  // meetings and lunch skip time, so a typical first run lands around 15–25 minutes.
  SECONDS_PER_MINUTE: 2.4,
  PLAYER: { walk: 2.1, run: 4.1, radius: 0.27 },
  NPC: { walk: 1.35, hurry: 2.4, radius: 0.27 },
  INTERACT_RANGE: 1.75,
  CAMERA: { distance: 3.3, height: 1.42, minPitch: -0.12, maxPitch: 1.0, pitch: 0.3, fov: 60 },
  OVERHEAR_RANGE: 7.5,
};

export const QUALITY = {
  low:    { label: 'Low',    maxDpr: 1.0, shadows: false, extras: 0, fx: false, aa: false },
  medium: { label: 'Medium', maxDpr: 1.5, shadows: false, extras: 2, fx: true,  aa: true },
  high:   { label: 'High',   maxDpr: 2.0, shadows: true,  extras: 2, fx: true,  aa: true },
};

// Heuristic first-launch quality. Phones default to low/medium; players can change it.
export function detectQuality() {
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (!touch) return cores >= 6 ? 'high' : 'medium';
  if (cores >= 8 && mem >= 6) return 'medium';
  return 'low';
}

export function fmtTime(mins) {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
}

export const DEBUG = /[?&]debug=1/.test(location.search);
