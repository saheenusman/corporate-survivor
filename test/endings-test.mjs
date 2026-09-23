// Pure logic test for ending selection (no browser needed).
globalThis.location = { search: '' };
const { evaluateEnding } = await import('../src/js/story/endings.js');
const { newDay } = await import('../src/js/state/game-state.js');
const mk = (f) => { const s = newDay(); f(s); return s; };
const cases = [
  ['chaos (quit)', mk((s) => { s.flags.quit = true; s.time = 700; }), 'left', 'chaos'],
  ['chaos (rep)', mk((s) => { s.stats.reputation = 8; s.time = 1030; }), 'left', 'chaos'],
  ['whistleblower', mk((s) => { s.flags.reportedToHR = true; s.time = 1030; }), 'left', 'whistleblower'],
  ['middle (hush)', mk((s) => { s.flags.hushPromotion = true; s.time = 1030; }), 'left', 'middle'],
  ['middle (sure)', mk((s) => { s.counters.sure = 8; s.rel.manager = 75; s.time = 1030; }), 'left', 'middle'],
  ['hero', mk((s) => { s.counters.tasksDone = 7; s.stats.reputation = 70; s.flags.prodFixed = true; s.time = 1035; }), 'left', 'hero'],
  ['hero overtime', mk((s) => { s.counters.tasksDone = 7; s.stats.reputation = 70; s.flags.prodFixed = true; s.time = 1050; }), 'overtime', 'hero'],
  ['enlightenment', mk((s) => { s.time = 1022; s.stats.sanity = 60; s.stats.energy = 40; s.stats.workload = 30; s.rel = { rahul: 60, anu: 60, manager: 50, hr: 0 }; s.stats.reputation = 55; }), 'left', 'enlightenment'],
  ['escape (early)', mk((s) => { s.time = 1000; }), 'left', 'escape'],
  ['escape (tired)', mk((s) => { s.time = 1022; s.stats.sanity = 20; }), 'left', 'escape'],
  ['overtime', mk((s) => { s.time = 1050; }), 'overtime', 'overtime'],
];
let fail = 0;
for (const [name, s, how, want] of cases) {
  const got = evaluateEnding(s, how);
  console.log(got === want ? 'PASS' : 'FAIL', name.padEnd(16), got);
  if (got !== want) fail++;
}
process.exit(fail ? 1 : 0);
