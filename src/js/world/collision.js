// 2D circle-vs-AABB collision for walking, 3D ray-vs-AABB for the camera boom.
import { clamp } from '../core/util.js';

export function resolveCircle(pos, r, colliders) {
  for (let it = 0; it < 2; it++) {
    for (const c of colliders) {
      if (!c.on) continue;
      if (pos.x < c.minX - r || pos.x > c.maxX + r || pos.z < c.minZ - r || pos.z > c.maxZ + r) continue;
      const cx = clamp(pos.x, c.minX, c.maxX), cz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
      else {
        const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z, m = Math.min(l, rr, t, b);
        if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
      }
    }
  }
}

export function pushFromCircles(pos, r, circles) {
  for (const c of circles) {
    const dx = pos.x - c.x, dz = pos.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; pos.x += dx * k; pos.z += dz * k; }
  }
}

// Returns the smallest t in [0, maxT] where the ray hits a camera-blocking box.
export function rayCast(o, d, maxT, colliders) {
  let best = maxT;
  for (const c of colliders) {
    if (!c.on || !c.cam) continue;
    let t0 = 0, t1 = best;
    const bounds = [[o.x, d.x, c.minX, c.maxX], [o.y, d.y, 0, c.h], [o.z, d.z, c.minZ, c.maxZ]];
    let hit = true;
    for (const [oo, dd, mn, mx] of bounds) {
      if (Math.abs(dd) < 1e-8) { if (oo < mn || oo > mx) { hit = false; break; } continue; }
      let a = (mn - oo) / dd, b = (mx - oo) / dd;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit && t0 < best) best = t0;
  }
  return best;
}
