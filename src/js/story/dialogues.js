// Dialogue trees.
// A dialogue is an array of nodes, played in order:
//   { s: speaker, t: text | (state) => text, fx, if: (state) => bool, anim, expr, inner, call }
//   { choices: [{ t, fx, next, if, walk, note, call }] }   -> branch to another dialogue key
// speaker: 'player' | 'narrator' | npc id.   fx: see applyFx in game-state.js.
// call: name of a director hook (starts scenes, time skips, endings...).
import { MANAGER_EVIDENCE } from './tasks.js';
import { fmtTime } from '../config.js';

const has = (s, c) => s.clues.includes(c);
const evidence = (s) => MANAGER_EVIDENCE.filter((c) => has(s, c)).length;
const mgrDeployed = (s) => !!s.flags.managerDeployed;
const taskCount = (s) => s.tasks.active.filter((t) => t !== 'singapore').length;

export const DLG = {
  // ------------------------------------------------------------ morning
  intro: [
    { s: 'narrator', t: 'Monday. 8:57 AM. Floor 13.' },
    { s: 'narrator', t: 'You have one goal today: survive until 5:30 PM.' },
    { s: 'player', inner: true, t: 'Get to my desk. Don\'t make eye contact. Easy.' },
  ],
  deepa_morning: [
    { s: 'deepa', t: 'Morning! Mr. Menon was asking for you.', anim: 'talk' },
    { s: 'deepa', t: 'In a good way. Probably. He had his laptop open, so… be careful.', expr: 'worried' },
    { s: 'player', t: 'Thanks, Deepa. Any advice?' },
    { s: 'deepa', t: 'Walk fast. Look busy. Never say "sure".', expr: 'smug' },
  ],
  deepa_generic: [
    { s: 'deepa', t: (s) => (s.act >= 3 ? 'The phones won\'t stop. Everyone wants a free air fryer. I also want a free air fryer.' : 'If anyone asks, I haven\'t seen you. Unless it\'s HR. HR sees everything.'), anim: 'talk' },
  ],

  mgr_morning: [
    { s: 'manager', t: 'Ah, there you are! Got a minute?', anim: 'talk', expr: 'happy' },
    { s: 'player', inner: true, t: 'It is 9:00 AM. It has never, ever been a minute.' },
    { s: 'manager', t: 'Tiny thing. Can you update the Q3 deck before lunch? Just the numbers. And the charts. And the story.' },
    { choices: [
      { t: 'Sure!', fx: { task: 'q3deck', trust: 6, workload: 18, sanity: -2, count: { sure: 1, requests: 1 } }, next: 'mgr_morning_sure' },
      { t: "I'll try.", fx: { task: 'q3deck', trust: 2, workload: 18, count: { requests: 1 } }, next: 'mgr_morning_try' },
      { t: (s) => `I already have ${taskCount(s)} task${taskCount(s) === 1 ? '' : 's'}.`, fx: { task: 'q3deck', trust: -2, workload: 18, sanity: 3, count: { requests: 1 } }, next: 'mgr_morning_busy' },
      { t: 'Walk away slowly', walk: true, fx: { task: 'q3deck', trust: -6, suspicion: 8, sanity: 4, workload: 18, count: { dodged: 1, requests: 1 } }, next: 'mgr_walkaway' },
    ] },
  ],
  mgr_morning_sure: [{ s: 'manager', t: 'Love it. Love the energy. This is why you\'re my favourite. Today.', expr: 'happy' }],
  mgr_morning_try: [{ s: 'manager', t: '"Try." Ha! I\'ll write that down as a yes.', expr: 'smug' }],
  mgr_morning_busy: [
    { s: 'manager', t: 'Great, so this makes it a nice round number!', expr: 'happy' },
    { s: 'player', inner: true, t: 'That is not how numbers work.' },
  ],
  mgr_walkaway: [
    { s: 'narrator', t: 'You turn and walk away very, very slowly, as if he is a bear.' },
    { s: 'manager', t: "…I'll email you!", expr: 'worried' },
  ],

  rahul_intro: [
    { s: 'rahul', t: "Hey. Don't look at me, I'm not here. I arrived at 9:00. Officially.", anim: 'talk' },
    { s: 'player', t: 'It\'s 9:06.' },
    { s: 'rahul', t: 'Time is a social construct. Also, Menon was hovering near your desk earlier.', expr: 'smug' },
    { choices: [
      { t: 'How do you survive here?', fx: { rahul: 5 }, next: 'rahul_rules' },
      { t: 'He already got me. Q3 deck.', if: (s) => s.tasks.active.includes('q3deck'), fx: { rahul: 4, sanity: 2 }, next: 'rahul_sympathy' },
      { t: 'Back to work.', fx: {} },
    ] },
  ],
  rahul_rules: [
    { s: 'rahul', t: 'Three rules. One: never make eye contact with a manager holding a laptop.' },
    { s: 'rahul', t: "Two: if someone says \"quick thing\", it isn't. Three: the restroom stall is the only place he won't follow you." },
    { s: 'rahul', t: 'Eight years. Zero promotions. Zero heart attacks. That\'s the dream.', expr: 'happy' },
  ],
  rahul_sympathy: [
    { s: 'rahul', t: 'The Q3 deck. Classic. Pro tip: Anu has a template. She has a template for everything.', expr: 'sad' },
    { s: 'rahul', t: 'She has a template for making templates.' },
  ],
  rahul_generic: [
    { s: 'rahul', t: (s) => (s.flags.blamedRahul ? 'Oh, hey. Colleague. Friend. Person who said my name to management.' : s.act >= 3 ? 'Production is down and I\'ve never felt more alive. Kidding. I feel nothing.' : 'I\'m in "deep focus mode". It looks exactly like normal mode.'), anim: 'talk' },
  ],
  rahul_coffee: [
    { s: 'rahul', t: 'Ah, the coffee corner. Neutral ground. Like Switzerland, but with oat milk.', anim: 'talk' },
    { s: 'rahul', t: 'Want some gossip? Finance has a spreadsheet tracking who breaks production. There are tabs. With names.', expr: 'smug' },
    { choices: [
      { t: 'Is my name on it?', fx: { rahul: 4 }, next: 'rahul_gossip' },
      { t: 'Any tips for today?', fx: { rahul: 3 }, next: 'rahul_tipline' },
      { t: 'I should get back.', fx: {} },
    ] },
  ],
  rahul_gossip: [
    { s: 'rahul', t: 'Not yet. Menon\'s isn\'t either, which is weird, because he has admin access and a sticky note with the password.' },
    { s: 'rahul', t: 'On his monitor. Pink. You can\'t miss it.', fx: { flag: 'knowsSticky' } },
  ],
  rahul_tipline: [
    { s: 'rahul', t: 'Production runs on a dusty box next to Printer 2. The label says DO NOT TOUCH.', fx: { clue: 'rahul_tip' } },
    { s: 'rahul', t: 'Nobody has ever restarted it. I suspect it would fix everything. I will never test this.' },
  ],
  rahul_hint: [
    { s: 'rahul', t: 'Okay, off the record: that box by the printer? Unplug it, count to ten, plug it back in.', anim: 'talk', fx: { clue: 'rahul_tip' } },
    { s: 'rahul', t: "It's what the original developer did. He retired to Goa. Coincidence? Yes, probably." },
  ],
  rahul_leaving: [
    { s: 'rahul', t: 'Well, that\'s me. 4:58 PM. Earliest socially acceptable exit.', anim: 'talk' },
    { s: 'rahul', t: (s) => (s.rel.rahul >= 55 ? 'Survive the last half hour. I believe in you. Mildly.' : 'See you tomorrow. Or not. Depends on the reorg.') },
  ],

  anu_intro: [
    { s: 'anu', t: 'Morning! I finished Tuesday\'s tasks already. I\'m working on Wednesday.', anim: 'talk', expr: 'happy' },
    { s: 'anu', t: (s) => (s.tasks.active.includes('q3deck') ? 'Oh, the Q3 deck? I have a template! Want it?' : 'If you need anything, I have a template. I have templates for everything.') },
    { choices: [
      { t: 'Yes please! You\'re a lifesaver.', if: (s) => s.tasks.active.includes('q3deck'), fx: { anu: 8, flag: 'deckShortcut' }, next: 'anu_template' },
      { t: 'Do you ever take a break?', fx: { anu: 5 }, next: 'anu_break' },
      { t: 'I\'m good, thanks.', fx: { anu: 1 } },
    ] },
  ],
  anu_template: [{ s: 'anu', t: 'Sent! It has conditional formatting. It will cut your deck time in half.', expr: 'happy' }],
  anu_break: [
    { s: 'anu', t: 'A break? Like… a KitKat?', expr: 'surprised' },
    { s: 'anu', t: '…I have not left this chair since March.', expr: 'worried' },
  ],
  anu_print: [
    { s: 'anu', t: 'Hi! Tiny favour? My quarterly report is waiting at Printer 2. I\'m colour-coding and I can\'t stop mid-colour.', anim: 'talk' },
    { choices: [
      { t: 'Sure, I\'ll grab it.', fx: { task: 'printReport', anu: 5, count: { sure: 1 } } },
      { t: 'The printer hates me.', fx: { task: 'printReport', anu: 2, sanity: -2 }, next: 'anu_print_hate' },
      { t: 'I\'m drowning, sorry.', fx: { anu: -4, sanity: 2 } },
    ] },
  ],
  anu_print_hate: [{ s: 'anu', t: 'The printer hates everyone. That\'s why it\'s fair.', expr: 'smug' }],
  anu_generic: [
    { s: 'anu', t: (s) => (s.act >= 3 ? 'Production is down so I made a spreadsheet of everything that is down. It\'s a long spreadsheet.' : s.tasks.active.includes('printReport') ? 'Did you get the printout? No pressure! (Some pressure.)' : 'I colour-coded my colour codes. Now I need a legend for the legend.'), anim: 'talk' },
  ],
  anu_help: [
    { s: 'anu', t: 'You look like someone who needs production fixed.', anim: 'talk' },
    { choices: [
      { t: 'Can you fix it? Please?', if: (s) => s.rel.anu >= 55, fx: { anu: -3 }, next: 'anu_fixes' },
      { t: 'Can you fix it? Please?', if: (s) => s.rel.anu < 55, fx: {}, next: 'anu_nope' },
      { t: 'Any ideas where to start?', fx: {}, next: 'anu_ideas' },
      { t: 'Never mind.', fx: {} },
    ] },
  ],
  anu_fixes: [
    { s: 'anu', t: 'For you? Okay. Give me ninety seconds and a spreadsheet.', expr: 'happy' },
    { s: 'narrator', t: 'Anu types at a speed that should not be physically possible. The red screens flicker… and go back to normal.', call: 'fixProd:anu' },
    { s: 'anu', t: 'Fixed. I\'ll let you tell Menon. He\'ll give you the credit anyway. Or himself. Probably himself.', expr: 'smug' },
  ],
  anu_nope: [{ s: 'anu', t: 'I would, but I\'m fixing three other things for people who helped me today. Try the logs? Or ask Rahul, he\'s been here since the dinosaurs.', expr: 'worried' }],
  anu_ideas: [
    { s: 'anu', t: 'Check the deploy logs on your computer. Whoever deployed at lunch left fingerprints.' },
    { s: 'anu', t: 'Also, Menon\'s been Googling things in his office. Loudly. He types with one finger.', expr: 'smug' },
  ],

  // ------------------------------------------------------------ the meeting
  meeting: [
    { s: 'narrator', t: '10:00 AM. SYNERGY ALIGNMENT SESSION. Attendance: mandatory. Agenda: none.' },
    { s: 'manager', t: 'Okay team! Today\'s meeting is about aligning on the alignment from last week\'s alignment.', anim: 'talk', expr: 'happy' },
    { s: 'manager', t: 'Any questions before I share my screen for forty minutes?' },
    { choices: [
      { t: 'Nod thoughtfully', fx: { trust: 4, sanity: -4 }, next: 'meeting_nod' },
      { t: '"Could this have been an email?"', fx: { trust: -8, sanity: 8, rahul: 6, reputation: 3 }, next: 'meeting_email' },
      { t: 'Ask a real question', fx: { trust: 2, anu: 4, sanity: -2 }, next: 'meeting_question' },
      { t: 'Doodle on your notepad', fx: { sanity: 5, energy: -2 }, next: 'meeting_doodle' },
    ] },
  ],
  meeting_nod: [
    { s: 'narrator', t: 'You nod at slide 4. You nod at slide 19. You nod at a slide that is just the company logo.' },
    { s: 'manager', t: 'See? This one gets it.', expr: 'happy', call: 'meetingEnd' },
  ],
  meeting_email: [
    { s: 'narrator', t: 'The room goes silent. Somewhere, a printer jams in solidarity.' },
    { s: 'manager', t: '…Great question. Let\'s set up a meeting to discuss it.', expr: 'angry' },
    { s: 'player', inner: true, t: 'Worth it.', call: 'meetingEnd' },
  ],
  meeting_question: [
    { s: 'player', t: 'What exactly are we aligning on?' },
    { s: 'manager', t: 'Excellent. That is exactly the kind of question we will align on next week.', expr: 'smug' },
    { s: 'anu', t: '(whispering) I wrote it down. I write everything down.', call: 'meetingEnd' },
  ],
  meeting_doodle: [
    { s: 'narrator', t: 'You draw a small boat. Then a bigger boat. Then an island with no Wi-Fi. It is beautiful.', call: 'meetingEnd' },
  ],
  meeting_after: [
    { s: 'narrator', t: 'Fifty minutes later, the meeting ends. Action items: zero. Follow-up meetings: two.' },
  ],

  // ------------------------------------------------------------ the config
  mgr_config: [
    { s: 'manager', t: 'Hey, you! One more quick thing.', anim: 'talk', expr: 'happy' },
    { s: 'manager', t: 'Tiny config change. Pricing thing. Flip one value, push to production. Five minutes. Four if you believe.' },
    { s: 'player', inner: true, t: 'Pushing to production. Before lunch. On a Monday. Without review.' },
    { choices: [
      { t: 'Sure, I\'ll deploy it.', fx: { task: 'config', trust: 6, workload: 8, count: { sure: 1, requests: 1 } }, next: 'mgr_config_yes' },
      { t: 'Shouldn\'t someone review it?', fx: { trust: -3, anu: 3, reputation: 2, flag: 'refusedDeploy', count: { requests: 1 } }, next: 'mgr_config_review' },
      { t: 'I\'m not deploying on a Monday.', fx: { trust: -6, sanity: 5, flag: 'refusedDeploy', count: { requests: 1 } }, next: 'mgr_config_no' },
      { t: 'Walk away slowly', walk: true, fx: { trust: -7, suspicion: 6, flag: 'refusedDeploy', count: { dodged: 1, requests: 1 } }, next: 'mgr_config_walk' },
    ] },
  ],
  mgr_config_yes: [{ s: 'manager', t: 'That\'s my rockstar. What could possibly go wrong?', expr: 'happy' }, { s: 'player', inner: true, t: 'Everything. Everything could go wrong.' }],
  mgr_config_review: [{ s: 'manager', t: 'Review? It\'s ONE value. Fine. I\'ll do it myself. How hard can it be?', expr: 'smug' }],
  mgr_config_no: [{ s: 'manager', t: 'Wow. Okay. Old school. Respect. I\'ll just… do it myself. I have the password somewhere.', expr: 'worried' }],
  mgr_config_walk: [{ s: 'manager', t: 'I\'ll take that as a "please do it yourself". Great delegation, by the way!', expr: 'worried' }],

  // ------------------------------------------------------------ roaming requests
  req_rename: [
    { s: 'manager', t: 'Got a minute? Could you rename all the shared files so they say FINAL? People keep opening the non-final finals.', anim: 'talk' },
    { choices: 'request:rename' },
  ],
  req_forward: [
    { s: 'manager', t: 'Quick one! Forward "the email" to everyone. Again. Nobody read it the first four times.', anim: 'talk' },
    { choices: 'request:forward' },
  ],
  req_print2: [
    { s: 'manager', t: 'Could you print the quarterly numbers? In colour this time. Numbers look more positive in colour.', anim: 'talk' },
    { choices: 'request:print2' },
  ],
  req_deckdeck: [
    { s: 'manager', t: 'Got a minute? Leadership loved the idea of the deck. They want a deck about the deck.', anim: 'talk' },
    { choices: 'request:deckdeck' },
  ],
  req_timesheet: [
    { s: 'manager', t: 'Friendly reminder that timesheets are due. Today. By you. Tiny thing!', anim: 'talk' },
    { choices: 'request:timesheet' },
  ],
  req_overload: [
    { s: 'manager', t: 'Got a min—', anim: 'talk' },
    { s: 'player', t: 'I physically cannot hold another task. My to-do list has a to-do list.', expr: 'angry' },
    { s: 'manager', t: '…Fair. I\'ll ask Anu. She loves tasks. She\'s like a task sponge.', expr: 'worried', fx: { anu: -3, sanity: 3 } },
  ],
  req_self: [
    { s: 'manager', t: 'Oh! You came to ME. Love the initiative. Speaking of which — got a minute?', anim: 'talk', expr: 'happy' },
  ],
  stairs_out: [
    { s: 'narrator', t: (s) => (s.stats.energy < 20 ? 'Thirteen floors. You made it to floor nine and sat on the stairs for a while. It still counts.' : 'Thirteen floors down. Your legs hate you. Your manager cannot find you. Worth it.') },
  ],
  req_knock: [
    { s: 'manager', t: 'Come in, come in! Door\'s always open. Metaphorically. Actually, since you\'re here — got a minute?', anim: 'talk', expr: 'happy' },
  ],

  // ------------------------------------------------------------ incident
  incident: [
    { s: 'manager', t: 'PRODUCTION IS DOWN. Well — up. Very up. We sold forty thousand air fryers for zero rupees.', anim: 'frustrated', expr: 'surprised' },
    { s: 'manager', t: 'Quick question, totally casual, no reason: who deployed?', expr: 'worried' },
    { choices: [
      { t: 'I did. You asked me to.', if: (s) => s.flags.deployedByPlayer, fx: { trust: -4, reputation: -4, sanity: 5, anu: 5, rahul: 5, flag: 'admitted' }, next: 'incident_admit' },
      { t: 'You did. At 12:05.', if: (s) => mgrDeployed(s) && evidence(s) >= 1, fx: { trust: -10, suspicion: 5, flag: 'accusedEarly' }, next: 'incident_accuse' },
      { t: 'Let me check the logs.', fx: { reputation: 2 }, next: 'incident_logs' },
      { t: 'No idea.', fx: { suspicion: 10 }, next: 'incident_noidea' },
      { t: 'Maybe Rahul?', fx: { rahul: -25, chaos: 1, flag: 'blamedRahulEarly' }, next: 'incident_rahul' },
    ] },
  ],
  incident_admit: [
    { s: 'manager', t: 'I— that— hm. Honesty. So refreshing. So inconvenient.', expr: 'worried' },
    { s: 'manager', t: 'Fix it before 4:30 and we never speak of this. Except in the retrospective.', fx: { task: 'fixProd' } },
  ],
  incident_accuse: [
    { s: 'manager', t: 'Me? I— that\'s a very bold theory for a Monday.', expr: 'surprised' },
    { s: 'manager', t: 'Why don\'t you focus on fixing it, and I\'ll focus on… managing the narrative.', expr: 'smug', fx: { task: 'fixProd' } },
  ],
  incident_logs: [{ s: 'manager', t: 'Yes! Logs! Very proactive. Fix it before 4:30. The board is asking questions. With their faces.', fx: { task: 'fixProd' } }],
  incident_noidea: [{ s: 'manager', t: 'Hm. That\'s exactly what the person who did it would say. Anyway! Fix it. Before 4:30.', expr: 'smug', fx: { task: 'fixProd' } }],
  incident_rahul: [
    { s: 'rahul', t: '(from across the room) I can hear you!', expr: 'angry' },
    { s: 'manager', t: 'Noted. Very helpful. Still, fix it before 4:30, please.', fx: { task: 'fixProd' } },
  ],
  prod_box: [
    { s: 'narrator', t: 'A dusty tower hums under the table. A sticky note says: PRODUCTION — DO NOT TOUCH (seriously).' },
    { choices: [
      { t: 'Unplug it. Count to ten. Plug it back in.', fx: {}, call: 'fixProd:restart' },
      { t: 'Leave it alone', fx: { sanity: -2 } },
    ] },
  ],
  prod_fixed_mgr: [
    { s: 'manager', t: 'Production\'s back! Great teamwork, everyone. And by teamwork I mean mostly me, supervising.', anim: 'celebrate', expr: 'happy' },
  ],

  // ------------------------------------------------------------ the name
  blame: [
    { s: 'manager', t: 'So. Management wants a name for the incident report.', anim: 'talk', expr: 'worried' },
    { s: 'manager', t: (s) => (s.flags.admitted ? 'You already told me it was you. Which is… convenient. For me.' : 'I was thinking… yours. It\'s short. Very easy to spell.'), expr: 'smug' },
    { choices: [
      { t: 'Show him the evidence', if: (s) => mgrDeployed(s) && evidence(s) >= 2, note: (s) => `${evidence(s)} pieces of evidence`, fx: { ach: 'WHO_DEPLOYED' }, next: 'blame_confront' },
      { t: 'It was you. Everyone knows.', if: (s) => mgrDeployed(s) && evidence(s) < 2, note: 'Not enough evidence yet', fx: { trust: -8, suspicion: 8 }, next: 'blame_weak' },
      { t: 'Fine. Put my name.', fx: { reputation: -14, sanity: -10, rahul: 8, anu: 6, trust: 8, flag: 'tookBlame' }, next: 'blame_take' },
      { t: 'It was Rahul.', fx: { rahul: -40, chaos: 1, flag: 'blamedRahul', trust: 3 }, next: 'blame_rahul' },
      { t: 'Blame the printer.', fx: {}, next: 'blame_printer' },
    ] },
  ],
  blame_confront: [
    { s: 'narrator', t: (s) => `You lay it out: ${[has(s, 'deploy_log') ? 'the deploy log' : null, has(s, 'manager_phone') ? 'his phone call' : null, has(s, 'edit_history') ? 'his search history' : null, has(s, 'sticky_password') ? 'the pink sticky note' : null].filter(Boolean).join(', ')}.` },
    { s: 'manager', t: '…Where did you get that?', expr: 'surprised' },
    { s: 'manager', t: 'Let\'s not be hasty. How would you like a promotion? Team lead. Tiny raise. Enormous title.', expr: 'smug' },
    { choices: [
      { t: 'Accept the promotion', fx: { flag: 'hushPromotion', trust: 20, reputation: 5, sanity: -6 }, next: 'blame_hush' },
      { t: 'Report it to HR', fx: { flag: 'reportedToHR', hr: 40, trust: -40, reputation: 10, sanity: 8 }, next: 'blame_report' },
    ] },
  ],
  blame_hush: [
    { s: 'manager', t: 'Welcome to management! First lesson: got a minute?', expr: 'happy', fx: { ach: 'MIDDLE_MANAGEMENT' } },
    { s: 'player', inner: true, t: 'Oh no. It\'s contagious.' },
  ],
  blame_report: [
    { s: 'narrator', t: 'You forward everything to Priya from HR. Your phone buzzes before you even look up.' },
    { s: 'hr', t: '"Thank you. We\'ll handle it. Please enjoy the rest of your day." — Priya, HR', expr: 'smug' },
    { s: 'manager', t: 'Did you just… Did you CC HR?', expr: 'angry' },
  ],
  blame_weak: [
    { s: 'manager', t: 'Do you have proof? No? Then it\'s a theory. And theories don\'t go in incident reports.', expr: 'smug' },
    { s: 'manager', t: 'So — whose name?' },
    { choices: [
      { t: 'Fine. Put my name.', fx: { reputation: -14, sanity: -10, rahul: 8, anu: 6, trust: 8, flag: 'tookBlame' }, next: 'blame_take' },
      { t: 'It was Rahul.', fx: { rahul: -40, chaos: 1, flag: 'blamedRahul', trust: 3 }, next: 'blame_rahul' },
      { t: 'Blame the printer.', fx: {}, next: 'blame_printer' },
    ] },
  ],
  blame_take: [
    { s: 'manager', t: 'Wonderful. Very brave. Very… career-limiting. I\'ll spell it right.', expr: 'happy', call: 'tookBlame' },
    { s: 'player', inner: true, t: (s) => (s.flags.deployedByPlayer ? 'Fair. I did push the button.' : 'I didn\'t even push the button.') },
  ],
  blame_rahul: [
    { s: 'manager', t: 'Rahul! Of course. He has "deployer energy".', expr: 'smug' },
    { s: 'player', inner: true, t: 'Rahul will remember this. Rahul remembers everything.' },
  ],
  blame_printer: [
    { s: 'player', t: 'It was the printer.' },
    { s: 'manager', t: (s) => (s.counters.printerFails >= 2 ? '…The printer. It HAS been acting suspicious all day. I\'ll allow it.' : 'The printer? It\'s a printer. It can barely print.'), expr: 'surprised' },
    { s: 'narrator', t: (s) => (s.counters.printerFails >= 2 ? 'The incident report now reads: "Root cause: Printer 2." Printer 2 does not appeal.' : 'He stares at you. You stare back. Somewhere, Printer 2 jams out of spite.'), fx: { flag: 'blamedPrinter' }, call: 'blamePrinter' },
  ],

  // ------------------------------------------------------------ the end of the day
  mgr_lastthing: [
    { s: 'manager', t: 'Before you go — one more quick thing.', anim: 'talk', expr: 'happy' },
    { s: 'manager', t: 'Singapore wants a call. 9 PM. Just thirty minutes. Or three hours. Time zones are fun!' },
    { choices: [
      { t: 'Sure.', fx: { task: 'singapore', trust: 10, sanity: -14, workload: 15, count: { sure: 1, requests: 1 }, flag: 'acceptedLast' }, next: 'last_sure' },
      { t: 'I\'m logging off at 5:30.', fx: { trust: -5, sanity: 10, count: { requests: 1 } }, next: 'last_no' },
      { t: 'I have a… dentist appointment.', fx: { suspicion: 6, sanity: 6, count: { requests: 1 } }, next: 'last_dentist' },
      { t: 'Walk away slowly', walk: true, fx: { trust: -6, sanity: 4, count: { dodged: 1, requests: 1 } }, next: 'mgr_walkaway' },
    ] },
  ],
  last_sure: [{ s: 'manager', t: 'Legend. I\'ll send the invite. And a pre-read. And a pre-pre-read.', expr: 'happy' }],
  last_no: [{ s: 'manager', t: 'Boundaries! Love that for you. Hate it for me.', expr: 'worried' }],
  last_dentist: [{ s: 'manager', t: 'At 9 PM? Wow. Dedicated dentist. Okay! Floss for me.', expr: 'smug' }],

  hr_walk: [
    { s: 'hr', t: 'Hello.', expr: 'neutral' },
    { s: 'player', inner: true, t: 'She has a clipboard. Why does she have a clipboard.' },
    { s: 'hr', t: 'Don\'t mind me. Just gathering information. For no reason.' },
  ],
  hr_generic: [
    { s: 'hr', t: (s) => (s.act >= 3 ? 'Busy day. Lots of paperwork. Some of it has names on it.' : 'Everything is fine. I\'m just here. Observing. Normally.'), anim: 'talk', expr: 'smug' },
    { choices: [
      { t: 'Can I report something?', if: (s) => s.flags.managerDeployed && evidence(s) >= 2 && !s.flags.reportedToHR && !s.flags.hushPromotion, fx: { flag: 'reportedToHR', hr: 40, trust: -40, reputation: 10, ach: 'WHO_DEPLOYED' }, next: 'hr_report' },
      { t: 'Am I in trouble?', fx: { sanity: -3 }, next: 'hr_trouble' },
      { t: 'Nice clipboard.', fx: { hr: 5 }, next: 'hr_clip' },
    ] },
  ],
  hr_report: [
    { s: 'hr', t: 'Oh, this is… thorough. The deploy log, the password, the search history. You\'ve been busy.', expr: 'surprised' },
    { s: 'hr', t: 'Leave it with me. And maybe don\'t accept any "quick promotions" today.', expr: 'smug' },
  ],
  hr_trouble: [{ s: 'hr', t: 'Nobody is ever "in trouble". Some people are just "in a process".', expr: 'smug' }],
  hr_clip: [{ s: 'hr', t: 'Thank you. It holds forty-seven forms. None of them are about you. Yet.', expr: 'happy' }],

  leave_early: [
    { s: 'hr', t: (s) => `Leaving at ${fmtTime(s.time)}? Bold strategy.`, expr: 'smug' },
    { choices: [
      { t: 'Go back to my desk', fx: { sanity: -4 }, call: 'cancelLeave' },
      { t: '"Doctor\'s appointment."', fx: { suspicion: 12, chaos: 1 }, call: 'leave:elevator' },
      { t: '"I quit."', fx: { flag: 'quit' }, next: 'leave_quit' },
    ] },
  ],
  leave_quit: [
    { s: 'hr', t: '…I\'ll need that in writing.', expr: 'surprised' },
    { s: 'player', t: 'I QUIT. There. I said it in writing, out loud.', call: 'leave:elevator' },
  ],
  leave_confirm: [
    { s: 'player', inner: true, t: (s) => (s.time < 1020 ? 'Leave now? It\'s only ' + fmtTime(s.time) + '. Someone might notice.' : 'Leave? The day is done. Probably. Hopefully.') },
    { choices: [
      { t: 'Leave', fx: {}, call: 'leave:$via' },
      { t: 'Not yet', fx: {} },
    ] },
  ],

  // ------------------------------------------------------------ lunch
  lunch: [
    { s: 'narrator', t: 'Today\'s special is Mystery Curry. The mystery is what\'s in it.' },
    { choices: [
      { t: 'Eat with Rahul', if: (s) => s.time < 800, fx: { rahul: 8, sanity: 8 }, next: 'lunch_rahul' },
      { t: 'Eat with Anu', if: (s) => s.time < 800, fx: { anu: 8, sanity: 3, energy: 3 }, next: 'lunch_anu' },
      { t: 'Eat alone by the window', fx: { sanity: 12 }, next: 'lunch_alone' },
      { t: 'Working lunch at the counter', fx: { workload: -8, sanity: -4, trust: 3 }, next: 'lunch_work' },
    ] },
  ],
  lunch_rahul: [
    { s: 'rahul', t: 'You know what I love about lunch? For thirty minutes, nobody can prove I\'m not working on something important.', anim: 'talk' },
    { s: 'rahul', t: 'Also: Menon asked IT how to "undo a push". Twice. Make of that what you will.', expr: 'smug', call: 'lunchDone' },
  ],
  lunch_anu: [
    { s: 'anu', t: 'I meal-prep in colour order. Monday is orange.', anim: 'talk', expr: 'happy' },
    { s: 'anu', t: '…I\'m so tired. Don\'t tell anyone.', expr: 'tired', call: 'lunchDone' },
  ],
  lunch_alone: [{ s: 'narrator', t: 'You eat in silence. Nobody asks you for anything. This is the best thirty minutes of your week.', call: 'lunchDone' }],
  lunch_work: [{ s: 'narrator', t: 'You eat curry with one hand and answer emails with the other. Both suffer.', call: 'lunchDone' }],

  // ------------------------------------------------------------ body limits
  passout: [
    { s: 'narrator', t: 'Your body files a formal complaint. You put your head down "for one second".' },
    { s: 'narrator', t: 'You wake up 45 minutes later. Someone has put a sticky note on your forehead: "nice nap".' },
  ],
  meltdown: [
    { s: 'narrator', t: 'Something inside you snaps. You stand up and yell "NEW SYNERGY!" at nobody.' },
    { s: 'narrator', t: 'Everyone pretends not to notice. Deepa slowly slides a stress ball across the floor to you.' },
  ],
  meltdown2: [
    { s: 'narrator', t: 'It happens again. This time you also flip the whiteboard and declare yourself "CEO of Feelings".' },
    { s: 'narrator', t: 'Building security is very polite about it.', fx: { flag: 'escortedOut' }, call: 'leave:security' },
  ],
  manager_pc: [
    { s: 'narrator', t: 'Mr. Menon\'s screen is unlocked. A pink sticky note on the bezel says: pwd: password123_FINAL.', fx: { clue: 'sticky_password' } },
    { s: 'narrator', if: (s) => s.flags.managerDeployed, t: 'His browser history: "how to undo deploy", "undo deploy fast", "is it legal to blame intern".', fx: { clue: 'edit_history' } },
    { s: 'narrator', if: (s) => !s.flags.managerDeployed, t: 'His browser history: "synergy synonyms", "how to look busy in meeting", "air fryer recipes".' },
    { s: 'player', inner: true, t: (s) => (s.flags.managerDeployed ? 'Well. That\'s not great. For him.' : 'Nothing incriminating. Just deeply sad.') },
  ],
  manager_pc_caught: [
    { s: 'manager', t: 'Can I help you? You seem very interested in my monitor.', expr: 'angry' },
    { s: 'player', t: 'Just admiring the… bezel.', fx: { suspicion: 15, trust: -8 } },
  ],
};

// Shared follow-up for manager requests: the four canonical responses.
export function requestChoices(taskId, s) {
  return [
    { t: 'Sure.', fx: { task: taskId, trust: 5, workload: 12, sanity: -4, count: { sure: 1, requests: 1 } }, next: 'req_sure' },
    { t: 'I\'ll try.', fx: { task: taskId, trust: 2, workload: 12, sanity: -2, count: { requests: 1 } }, next: 'req_try' },
    { t: `I already have ${taskCount(s)} tasks.`, fx: { trust: -4, sanity: 3, count: { requests: 1 } }, next: taskCount(s) >= 3 ? 'req_mercy' : 'req_busy' },
    { t: 'Walk away slowly', walk: true, fx: { trust: -6, suspicion: 5, sanity: 4, count: { dodged: 1, requests: 1 } }, next: 'mgr_walkaway' },
  ];
}
DLG.req_sure = [{ s: 'manager', t: 'You\'re a star. A tired star. The best kind.', expr: 'happy' }];
DLG.req_try = [{ s: 'manager', t: 'Trying is doing! I read that on a mug.', expr: 'happy' }];
DLG.req_busy = [{ s: 'manager', t: 'Then one more won\'t even show up on the graph!', expr: 'smug', fx: { task: '$pending', workload: 12 } }];
DLG.req_mercy = [{ s: 'manager', t: '…Oh. That IS a lot. I\'ll ask Anu. She\'s basically a task sponge.', expr: 'worried', fx: { anu: -2 } }];
