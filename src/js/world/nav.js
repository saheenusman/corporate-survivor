// Hand-authored waypoint graph + named "spots" (where NPCs stand, sit, work).
// A graph is plenty for a compact office and costs nothing at runtime.
const PI = Math.PI;

export const NODES = {
  elev_in: [1.5, 13.0], elev: [1.5, 11.0], lobby: [0.0, 9.6], recep_back: [-0.6, 10.45],
  hub_s: [0.0, 6.3], hub_c: [0.0, 1.3], hub_n: [0.0, -3.7],
  aA_s: [-3.6, 1.3], aB_s: [3.6, 1.3], aA_n: [-3.6, -3.7], aB_n: [3.6, -3.7], aC_s: [-3.6, 6.3], aD_s: [3.6, 6.3],
  w_n: [-6.6, -3.7], w_c: [-6.6, 1.3], w_s: [-6.6, 6.3],
  e_n: [7.0, -3.7], e_c: [7.0, 1.3], e_s: [7.0, 6.3],
  north_c: [1.8, -7.6], coffee: [4.2, -9.9], coffee_e: [7.3, -9.9],
  meet_door: [-12.0, -4.2], meet_in: [-12.0, -6.2], meet_w: [-15.1, -6.4], meet_e: [-8.7, -6.4], meet_ne: [-8.7, -10.2],
  printer: [-13.8, -1.2],
  cafe_in: [-9.2, 5.3], cafe_n: [-12.0, 5.3], cafe_mid: [-12.0, 8.7],
  mgr_door: [10.8, -4.0], mgr_in: [10.8, -6.3], mgr_side: [11.3, -10.4],
  collab: [11.5, 0.0], window_e: [14.2, 2.6],
  bath_door: [11.2, 4.2], bath_in: [11.2, 6.3],
};

const EDGES = [
  ['elev_in', 'elev'], ['elev', 'lobby'], ['lobby', 'recep_back'], ['lobby', 'hub_s'], ['lobby', 'e_s'],
  ['hub_s', 'hub_c'], ['hub_c', 'hub_n'], ['hub_c', 'aA_s'], ['hub_c', 'aB_s'], ['hub_n', 'aA_n'], ['hub_n', 'aB_n'],
  ['aA_s', 'w_c'], ['aA_n', 'w_n'], ['hub_s', 'aC_s'], ['hub_s', 'aD_s'], ['aC_s', 'w_s'], ['aB_s', 'e_c'], ['aB_n', 'e_n'], ['aD_s', 'e_s'],
  ['w_n', 'w_c'], ['w_c', 'w_s'], ['e_n', 'e_c'], ['e_c', 'e_s'],
  ['hub_n', 'north_c'], ['north_c', 'coffee'], ['coffee', 'coffee_e'], ['north_c', 'e_n'],
  ['w_n', 'meet_door'], ['meet_door', 'meet_in'], ['meet_in', 'meet_w'], ['meet_in', 'meet_e'], ['meet_e', 'meet_ne'],
  ['w_c', 'printer'], ['w_s', 'cafe_in'], ['cafe_in', 'cafe_n'], ['cafe_n', 'cafe_mid'],
  ['e_n', 'mgr_door'], ['mgr_door', 'mgr_in'], ['mgr_in', 'mgr_side'],
  ['e_c', 'collab'], ['collab', 'window_e'], ['e_s', 'bath_door'], ['bath_door', 'bath_in'],
];

const ADJ = {};
for (const k in NODES) ADJ[k] = [];
for (const [a, b] of EDGES) {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
  ADJ[a].push([b, d]); ADJ[b].push([a, d]);
}

export function findPath(from, to) {
  if (from === to) return [from];
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]);
  while (open.size) {
    let cur = null, best = Infinity;
    for (const n of open) if (dist[n] < best) { best = dist[n]; cur = n; }
    open.delete(cur);
    if (cur === to) break;
    for (const [nb, d] of ADJ[cur]) {
      const nd = dist[cur] + d;
      if (nd < (dist[nb] ?? Infinity)) { dist[nb] = nd; prev[nb] = cur; open.add(nb); }
    }
  }
  if (!(to in prev)) return null;
  const path = [to];
  let c = to;
  while (prev[c]) { c = prev[c]; path.unshift(c); }
  return path;
}

export function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const [k, [nx, nz]] of Object.entries(NODES)) {
    if (k === 'elev_in') continue;
    const d = (nx - x) ** 2 + (nz - z) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// Named places NPCs use. pose = animation once arrived.
export const SPOTS = {
  offstage: { x: 1.5, z: 13.0, yaw: PI, node: 'elev_in', pose: 'idle', hidden: true },
  desk_player: { x: -2.84, z: -0.05, yaw: PI, node: 'aA_s', pose: 'type' },
  desk_rahul: { x: -4.36, z: -0.05, yaw: PI, node: 'aA_s', pose: 'type' },
  desk_anu: { x: -2.84, z: -2.35, yaw: 0, node: 'aA_n', pose: 'type' },
  desk_arjun: { x: 2.84, z: -2.35, yaw: 0, node: 'aB_n', pose: 'type' },
  desk_neha: { x: 4.36, z: -0.05, yaw: PI, node: 'aB_s', pose: 'type' },
  desk_dev: { x: -4.36, z: 2.65, yaw: 0, node: 'aA_s', pose: 'type' },
  desk_kiran: { x: 4.36, z: 4.95, yaw: PI, node: 'aD_s', pose: 'type' },
  recep_seat: { x: -2.5, z: 9.85, yaw: PI, node: 'recep_back', pose: 'type' },
  mgr_seat: { x: 13.0, z: -10.1, yaw: 0, node: 'mgr_side', pose: 'type' },
  meet_head: { x: -14.55, z: -8.5, yaw: PI / 2, node: 'meet_w', pose: 'sitTalk' },
  meet_1: { x: -13.4, z: -7.25, yaw: PI, node: 'meet_in', pose: 'sit' },
  meet_2: { x: -12.0, z: -7.25, yaw: PI, node: 'meet_in', pose: 'sit' },
  meet_3: { x: -10.6, z: -7.25, yaw: PI, node: 'meet_in', pose: 'sit' },
  meet_hr: { x: -10.6, z: -9.75, yaw: 0, node: 'meet_ne', pose: 'sit' },
  meet_player: { x: -12.0, z: -9.75, yaw: 0, node: 'meet_ne', pose: 'sit' },
  coffee_rahul: { x: 5.55, z: -8.9, yaw: PI / 2, node: 'coffee', pose: 'drink', prop: 'cup' },
  coffee_b: { x: 6.85, z: -8.9, yaw: -PI / 2, node: 'coffee_e', pose: 'drink', prop: 'cup' },
  coffee_machine: { x: 4.0, z: -10.75, yaw: PI, node: 'coffee', pose: 'idle' },
  water: { x: 8.4, z: -10.95, yaw: PI, node: 'coffee_e', pose: 'drink', prop: 'cup' },
  cafe_arjun: { x: -13.6, z: 6.45, yaw: 0, node: 'cafe_n', pose: 'sitTalk' },
  cafe_neha: { x: -13.6, z: 7.95, yaw: PI, node: 'cafe_mid', pose: 'sitTalk' },
  cafe_anu: { x: -10.4, z: 6.45, yaw: 0, node: 'cafe_n', pose: 'sit' },
  cafe_mgr: { x: -10.4, z: 7.95, yaw: PI, node: 'cafe_mid', pose: 'sitTalk' },
  cafe_rahul: { x: -12.75, z: 10.2, yaw: PI / 2, node: 'cafe_mid', pose: 'sitPhone', prop: 'phone' },
  cafe_deepa: { x: -11.25, z: 10.2, yaw: -PI / 2, node: 'cafe_mid', pose: 'sitTalk' },
  cafe_dev: { x: -12.0, z: 9.45, yaw: 0, node: 'cafe_mid', pose: 'sit' },
  printer_spot: { x: -14.6, z: -1.6, yaw: -PI / 2, node: 'printer', pose: 'idle' },
  printer_q: { x: -13.6, z: -2.5, yaw: -PI / 2, node: 'printer', pose: 'phone', prop: 'phone' },
  floor_mgr: { x: 0.9, z: 1.3, yaw: -PI / 2, node: 'hub_c', pose: 'idle' },
  floor_mgr2: { x: 1.6, z: -3.7, yaw: PI, node: 'hub_n', pose: 'phone', prop: 'phone' },
  window_neha: { x: 14.9, z: 2.6, yaw: PI / 2, node: 'window_e', pose: 'phone', prop: 'phone' },
  bath_stall: { x: 15.1, z: 8.2, yaw: -PI / 2, node: 'bath_in', pose: 'idle', viaX: 13.4 },
  sofa: { x: 15.25, z: 0.5, yaw: -PI / 2, node: 'collab', pose: 'sitPhone', prop: 'phone' },
  plant_hr: { x: 14.55, z: -3.35, yaw: PI / 2, node: 'collab', pose: 'idle' },
  lobby_wait: { x: 0.8, z: 9.6, yaw: PI, node: 'lobby', pose: 'phone', prop: 'phone' },
  gather_mgr: { x: 0.7, z: 1.3, yaw: -PI / 2, node: 'hub_c', pose: 'talk' },
};
