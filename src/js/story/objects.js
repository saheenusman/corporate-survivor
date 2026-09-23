// Every interactable in the office. Each entry: position, contextual label, and
// what happens on use. Labels are functions so they change with the story
// (CHECK -> RESTART, LEAVE EARLY -> LEAVE, etc).
import { G, applyFx, hasTask, findJoke, completeTask } from '../state/game-state.js';
import { TASKS } from './tasks.js';
import { DLG } from './dialogues.js';
import { T, fmtTime } from '../config.js';
import { SPOTS } from '../world/nav.js';
import { Audio } from '../audio/audio.js';
import { pick } from '../core/util.js';

export const JOKES = {
  coffee_ooo: 'A laminated sign: OUT OF ORDER.\nBelow it, handwritten: "IT HAS BEEN OUT OF ORDER FOR 8 MONTHS."\nBelow that, smaller: "we know."',
  poster_team: 'TEAMWORK\n"Because nobody can be blamed alone."',
  poster_innov: 'INNOVATION\n"Doing the same thing, but in a meeting."',
  poster_quick: 'ONE MORE QUICK THING™\n"It never is."\nOrdered by Mr. Menon. Apparently without irony.',
  poster_eotm: 'EMPLOYEE OF THE MONTH\nMr. Menon (self-nominated).\nEvery month since 2019.',
  calendar: 'The office calendar. Every single day this week says MONDAY.\nNobody has fixed it. Nobody dares.',
  wb_meeting: 'MEETING ABOUT THE MEETING\n1. Agree on the agenda\n2. Schedule a follow-up\n3. ???\n4. Synergy\n\nAction items: 0',
  wb_chart: 'A hand-drawn chart: productivity goes down as the number of meetings goes up.\nSomeone circled it and wrote "WHY?".\nSomeone else wrote "see: Monday".',
  fake_plant: 'A tag on the pot: FAKE PLANT — please do not water.\nThe soil is suspiciously damp.',
  fridge: 'WHOEVER TOOK MY YOGURT: I KNOW. — K\nThe yogurt was never found. K has not forgotten.',
  microwave: 'DO NOT MICROWAVE FISH.\nTHIS MEANS YOU, SURESH.\nThere is no Suresh on this floor. There hasn\'t been for years. The legend lives on.',
  menu: 'THIS WEEK\nMon: Mystery Curry\nTue: Mystery Curry\nWed: Curry Mystery\nThu: ???\nFri: Leftover Mystery',
  mirror: 'A sticky note on the mirror:\nYOU\'RE DOING GREAT\n(probably)',
  wash: 'Employees must wash hands.\nManagers must wash hands twice.\nNobody knows who wrote this. Everybody agrees.',
};
export const JOKE_COUNT = Object.keys(JOKES).length;

// Simple one-liners for the supporting cast.
DLG.arjun_generic = [{ s: 'arjun', t: (s) => (s.act >= 3 ? 'Revenue is down 100%. Sales are up 900%. I have never been so confused and so employed.' : 'I\'m reconciling the reconciliation. It doesn\'t reconcile.'), anim: 'talk' }];
DLG.neha_generic = [{ s: 'neha', t: (s) => (s.act >= 3 ? 'I designed that checkout page. I did NOT design it to say ₹0.' : 'They want the logo bigger. It\'s already the size of the building.'), anim: 'talk' }];
DLG.dev_generic = [{ s: 'dev', t: (s) => (s.act >= 3 ? 'Not my service. Not my problem. Not my… okay it\'s a little bit my problem.' : 'Works on my machine. Ship my machine.'), anim: 'talk' }];
DLG.kiran_generic = [{ s: 'kiran', t: 'Found a bug. Marked it as a feature. Closed the ticket. Everyone clapped.', anim: 'talk' }];
DLG.mgr_generic = [{ s: 'manager', t: (s) => (s.flags.prodFixed ? 'Production\'s back! Great teamwork. And by teamwork I mean mostly me, supervising.' : s.act >= 3 ? 'Can\'t talk. Managing. Very hard.' : 'Can\'t talk, I\'m in a meeting. In my head. It\'s going great.'), anim: 'talk', expr: 'happy' }];
DLG.window_look = [{ s: 'narrator', t: () => pick(['The city is also at work. Everyone, everywhere, is at work.', 'A pigeon on the ledge stares at you. It has no manager. It is free.', 'Somewhere out there, someone is having a Tuesday.', 'You watch a cloud for a full minute. Nobody assigns you anything.']) }];

const REQUEST_POOL = ['rename', 'forward', 'print2', 'deckdeck', 'timesheet'];

export function registerObjects(game) {
  const { world, interactions: I } = game;
  const A = world.anchors;
  const s = () => G.state;
  const t = () => G.state.time;
  const joke = (id, at, label = 'READ') => I.register({
    x: at.x, z: at.z, y: at.y || 1.5, r: 1.9, label,
    use: async () => { const fresh = findJoke(id); await game.note(JOKES[id]); if (fresh) game.checkJokes(); },
  });

  // ------------------------------------------------------------ your desk
  I.register({
    x: A.playerSeat.x, z: A.playerSeat.z + 0.1, y: 1.2, r: 1.3, priority: -1,
    label: () => (game.player.state === 'seated' ? 'COMPUTER' : 'SIT'),
    use: async () => {
      if (game.player.state !== 'seated') {
        game.player.sit(A.playerSeat, 'type'); Audio.play('click');
        if (!s().flags.atDesk) { applyFx({ flag: 'atDesk' }, { silent: true }); game.ui.hint('Tap COMPUTER to work. Tap STAND to get up.'); }
        return;
      }
      await game.computer();
    },
  });

  // ------------------------------------------------------------ coffee corner
  I.register({
    x: A.coffee.x, z: A.coffee.z, y: 1.3, r: 1.4, label: 'MAKE COFFEE',
    use: async () => {
      const st = s();
      if (st.stats.energy > 92) { await game.note('Your hands are already vibrating at a frequency only dogs can hear. Maybe skip this one.'); return; }
      await game.playerAction({ face: { x: A.coffee.x, z: -11.5 }, pose: 'idle', sound: 'coffee', secs: 1.6, mins: 3 });
      game.player.ch.showProp('cup', true);
      game.player.ch.anim.setBase('drink');
      setTimeout(() => { game.player.ch.showProp('cup', false); if (game.player.ch.anim.base === 'drink') game.player.ch.anim.setBase('idle'); }, 5200);
      Audio.play('sip');
      applyFx({ energy: 20, sanity: 4, bladder: 22, count: { coffees: 1 } });
      game.checkCounters();
    },
  });
  joke('coffee_ooo', A.brokenCoffee, 'CHECK');
  I.register({
    x: A.water.x, z: A.water.z, y: 1.3, r: 1.3, label: 'DRINK WATER',
    use: async () => { await game.playerAction({ face: { x: 8.45, z: -11.6 }, pose: 'drink', prop: 'cup', sound: 'sip', secs: 2.2, mins: 2 }); applyFx({ energy: 4, sanity: 2, bladder: 12 }); },
  });
  I.register({ x: A.clock.x, z: A.clock.z, y: 2.1, r: 1.5, label: 'CHECK TIME', priority: 0.6, use: async () => { await game.note(`It is ${fmtTime(t())}.\nIt has been ${fmtTime(t())} for what feels like three hours.`); } });

  // ------------------------------------------------------------ printer + production box
  I.register({
    x: A.printer.x, z: A.printer.z, y: 1.3, r: 1.5,
    label: () => (hasTask('printReport') || hasTask('print2') ? 'PRINT' : 'CHECK'),
    use: () => game.printer(),
  });
  I.register({
    x: A.prodBox.x, z: A.prodBox.z, y: 0.9, r: 1.3,
    label: () => (s().act >= 3 && !s().flags.prodFixed && s().flags.incident ? 'RESTART' : 'CHECK'),
    use: async () => {
      if (s().flags.incident && !s().flags.prodFixed) { await game.say('prod_box'); return; }
      await game.note('A dusty tower hums under the table.\nPRODUCTION — DO NOT TOUCH (seriously)\nIt has an uptime of 2,914 days. Nobody knows what happens if you touch it.');
    },
  });

  // ------------------------------------------------------------ cafeteria
  I.register({
    x: A.lunch.x, z: A.lunch.z, y: 1.3, r: 1.5,
    label: () => (!s().flags.ateLunch && t() >= T(11, 45) && t() <= T(14, 30) ? 'EAT LUNCH' : 'CHECK'),
    use: async () => {
      if (!s().flags.ateLunch && t() >= T(11, 45) && t() <= T(14, 30)) { await game.say('lunch'); return; }
      await game.note(t() < T(11, 45) ? 'Lunch is served from 11:45. The curry is already here, though. Waiting. Watching.' : 'The lunch counter is closed. A single grain of rice remains, like a monument.');
    },
  });
  joke('microwave', A.microwave);
  joke('fridge', A.fridge);
  joke('menu', A.menu);
  I.register({
    x: A.vending.x, z: A.vending.z, y: 1.3, r: 1.4, label: 'BUY SNACK',
    use: async () => {
      Audio.play('vend');
      if (Math.random() < 0.4) {
        const i = await game.menu('Vending machine', 'Your snack is stuck. It is hanging by one corner, looking at you.', [{ t: 'Shake the machine', sub: 'Loud. Effective?' }, { t: 'Accept your loss', sub: 'A true professional.' }]);
        if (i === 0) { Audio.play('jam'); game.cam.shake = 0.6; applyFx(Math.random() < 0.6 ? { energy: 8, sanity: 4, reputation: -1 } : { sanity: -4, reputation: -2 }); }
        else applyFx({ sanity: -3 });
      } else applyFx({ energy: 8, sanity: 3 });
    },
  });

  // ------------------------------------------------------------ restroom
  I.register({
    x: A.stall.x, z: A.stall.z, y: 1.4, r: 1.3, label: () => (game.dir.approaching ? 'HIDE' : 'USE'),
    use: async () => {
      const first = !s().flags.usedStall;
      applyFx({ flag: 'usedStall' }, { silent: true });
      game.dir.cancelApproach(true);
      await game.ui.fade(true);
      Audio.play('flush');
      game.skipTime(5);
      applyFx({ sanity: 8, bladder: -100 });
      await game.ui.fade(false);
      await game.note(first ? 'Five whole minutes of silence.\nNobody can say "got a minute?" to you in here.\nThis is the only true meeting-free zone.' : pick(['Five more minutes of peace. You\'ve earned it.', 'Someone in the next stall is on a conference call. On mute. Hopefully.', 'You read the back of the air freshener. Twice.']));
      if (first) applyFx({ ach: 'JUST_FIVE_MINUTES' });
    },
  });
  I.register({ x: A.sink.x, z: A.sink.z, y: 1.3, r: 1.3, label: 'WASH HANDS', use: async () => { await game.playerAction({ face: { x: 12.2, z: 11.8 }, pose: 'type', secs: 1.4, mins: 1 }); applyFx({ sanity: 1 }); const fresh = findJoke('mirror'); await game.note(JOKES.mirror); if (fresh) game.checkJokes(); } });
  joke('wash', A.washSign);

  // ------------------------------------------------------------ windows & walls
  const lookOut = (at, face) => I.register({
    x: at.x, z: at.z, y: 1.6, r: 1.6, label: 'LOOK OUTSIDE',
    use: async () => {
      await game.playerAction({ face, pose: 'idle', secs: 0.8, mins: 2 });
      const cd = (s().flags.windowAt || -99) + 30 < t();
      applyFx({ flags: { windowAt: t() } }, { silent: true });
      if (cd) applyFx({ sanity: 5 });
      await game.say('window_look');
    },
  });
  lookOut(A.windowN, { x: -2.5, z: -13 });
  lookOut(A.windowE, { x: 17, z: 2.6 });
  joke('poster_team', A.posterTeam);
  joke('poster_innov', A.posterInnov);
  joke('poster_quick', A.posterQuick);
  joke('poster_eotm', { x: 9.8, z: -8.8, y: 1.6 });
  joke('calendar', A.calendar);
  joke('wb_meeting', A.wbMeeting);
  joke('wb_chart', A.wbChart);
  joke('fake_plant', A.fakePlant, 'CHECK');

  // ------------------------------------------------------------ meeting room + manager office
  I.register({
    x: A.meetDoor.x, z: A.meetDoor.z, y: 1.6, r: 1.8, priority: -0.5,
    enabled: () => t() >= T(9, 55) && t() < T(10, 45) && !s().flags.attendedMeeting && !s().flags.skippedMeeting,
    label: 'JOIN MEETING', use: () => game.dir.joinMeeting(),
  });
  I.register({
    x: A.mgrDoor.x, z: A.mgrDoor.z, y: 1.6, r: 1.5,
    enabled: () => { const m = game.npcs.get('manager'); return !m.hidden && m.at === 'mgr_seat' && m.state === 'idle' && !game.dir.approaching; },
    label: 'KNOCK', use: () => game.dir.managerRequest('req_knock'),
  });
  I.register({
    x: A.managerPC.x, z: A.managerPC.z, y: 1.2, r: 1.1, label: 'SNOOP',
    enabled: () => { const m = game.npcs.get('manager'); return m.hidden || m.at !== 'mgr_seat' || m.state !== 'idle'; },
    use: async () => {
      const m = game.npcs.get('manager');
      const near = !m.hidden && Math.hypot(m.pos.x - 13, m.pos.z + 9) < 5;
      if (near) { await game.talk('manager', 'manager_pc_caught'); return; }
      await game.say('manager_pc');
      if (s().flags.managerDeployed && s().clues.includes('deploy_log')) applyFx({ ach: 'WHO_DEPLOYED' });
    },
  });

  // ------------------------------------------------------------ exits
  I.register({
    x: A.elevator.x, z: A.elevator.z, y: 1.8, r: 1.5,
    label: () => (t() < T(16, 30) ? 'LEAVE EARLY' : 'LEAVE'),
    enabled: () => s().flags.introDone,
    use: () => game.dir.tryLeave('elevator'),
  });
  I.register({
    x: A.stairs.x, z: A.stairs.z, y: 1.8, r: 1.3, label: 'TAKE STAIRS',
    enabled: () => s().flags.introDone,
    use: () => game.dir.tryLeave('stairs'),
  });

  // ------------------------------------------------------------ people
  for (const n of game.npcs.list) {
    I.register({
      pos: () => ({ x: n.pos.x, z: n.pos.z, y: n.ch.anim.isSeatedPose ? 1.45 : 1.95 }),
      r: 1.8, priority: -0.3,
      enabled: () => !n.hidden && !n.busy && !n.override,
      label: 'TALK',
      use: () => game.talkTo(n.id),
    });
  }
}

// Which conversation to play when the player taps TALK on someone.
export function talkRoute(id, game) {
  const s = G.state, f = s.flags;
  const once = (flag) => { if (f[flag]) return false; applyFx({ flag }, { silent: true }); return true; };
  const n = game.npcs.get(id);
  switch (id) {
    case 'rahul':
      if (once('metRahul')) return 'rahul_intro';
      if (f.incident && !f.prodFixed && once('rahulHint')) return 'rahul_hint';
      if (n.at === 'coffee_rahul' && once('rahulCoffee')) return 'rahul_coffee';
      return 'rahul_generic';
    case 'anu':
      if (once('metAnu')) return 'anu_intro';
      if (f.incident && !f.prodFixed) return 'anu_help';
      return 'anu_generic';
    case 'deepa': return once('metDeepa') ? 'deepa_morning' : 'deepa_generic';
    case 'hr': return game.dir.hrWalking ? 'hr_walk' : 'hr_generic';
    case 'manager': return null; // handled by director: talking to him = a new task
    default: return `${id}_generic`;
  }
}

export { REQUEST_POOL, TASKS, completeTask };
