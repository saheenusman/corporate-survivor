// NPC daily schedules: [minute, spot, optional pose override].
// Times: 537 = 8:57, 600 = 10:00, 720 = noon, 900 = 3 PM, 1020 = 5 PM.
export const SCHEDULES = {
  rahul:   [[0, 'offstage'], [546, 'desk_rahul'], [625, 'coffee_rahul'], [650, 'desk_rahul'], [740, 'cafe_rahul'], [790, 'desk_rahul'], [890, 'coffee_rahul'], [915, 'desk_rahul'], [1018, 'offstage']],
  anu:     [[0, 'desk_anu'], [598, 'meet_2'], [650, 'desk_anu'], [760, 'cafe_anu'], [795, 'desk_anu'], [940, 'printer_spot'], [955, 'desk_anu'], [1045, 'offstage']],
  manager: [[0, 'mgr_seat'], [597, 'meet_head'], [652, 'mgr_seat'], [668, 'floor_mgr'], [700, 'floor_mgr2'], [724, 'mgr_seat'], [750, 'cafe_mgr'], [790, 'mgr_seat', 'sitPhone'], [855, 'floor_mgr'], [880, 'mgr_seat'], [930, 'floor_mgr2'], [955, 'meet_head'], [977, 'mgr_seat'], [1020, 'offstage']],
  hr:      [[0, 'offstage'], [956, 'meet_hr'], [982, 'offstage']],
  deepa:   [[0, 'recep_seat'], [755, 'cafe_deepa'], [790, 'recep_seat'], [1040, 'offstage']],
  arjun:   [[0, 'desk_arjun'], [599, 'meet_3'], [651, 'desk_arjun'], [742, 'cafe_arjun'], [778, 'desk_arjun'], [860, 'water'], [872, 'desk_arjun'], [1025, 'offstage']],
  neha:    [[0, 'desk_neha'], [640, 'window_neha'], [655, 'desk_neha'], [743, 'cafe_neha'], [778, 'desk_neha'], [920, 'window_neha'], [935, 'desk_neha'], [1030, 'offstage']],
  dev:     [[0, 'desk_dev'], [700, 'coffee_b'], [712, 'desk_dev'], [745, 'cafe_dev'], [785, 'desk_dev'], [900, 'sofa'], [930, 'desk_dev'], [1010, 'offstage']],
  kiran:   [[0, 'desk_kiran'], [830, 'printer_q'], [846, 'desk_kiran'], [1000, 'offstage']],
};

// Conversations the player can physically walk up to and overhear.
export const SCENES = [
  {
    id: 'finance', from: 746, to: 776, at: { x: -13.6, z: 7.2 }, range: 5.5, who: ['arjun', 'neha'],
    lines: [
      ['arjun', 'Did you see the pricing dashboard? Someone changed a config right before lunch.'],
      ['neha', 'Air fryers are listed at zero rupees. People are buying twelve.'],
      ['arjun', 'Finance is calling it a "visionary loss leader". I call it a typo.'],
      ['neha', 'Whoever deployed that is going to have a very long afternoon.'],
    ],
    clue: 'finance_rumor', needs: 'anyDeploy',
  },
  {
    id: 'phone', from: 818, to: 852, at: { x: 12.6, z: -8.8 }, range: 6.2, who: ['manager'],
    lines: [
      ['manager', 'Yes sir. No sir. It was just ONE value. True, capital T.'],
      ['manager', 'The system should have warned me. It is a very rude system.'],
      ['manager', "We'll find out who did it, sir. I already have a… strong candidate."],
    ],
    linesYou: [
      ['manager', 'Yes sir. Someone on my team deployed it. Very small change.'],
      ['manager', 'Very big… consequences. Forty thousand air fryers, sir.'],
      ['manager', "No, I didn't review it. I was in a meeting about reviews."],
    ],
    clue: 'manager_phone', clueYou: 'manager_phone_you', needs: 'anyDeploy',
  },
  {
    id: 'hr', from: 960, to: 978, at: { x: -12.4, z: -8.6 }, range: 6.5, who: ['hr', 'manager'],
    lines: [
      ['hr', 'The board wants a name for the incident report by 4:30.'],
      ['manager', 'A name. Right. Any name?'],
      ['hr', 'Ideally the correct one.'],
      ['manager', '…Ideally.'],
    ],
    clue: 'hr_deadline',
  },
];

// Short ambient lines when you walk past someone. [npc, minFrom, minTo, text]
export const BARKS = [
  ['anu', 0, 900, 'Just colour-coding my colour codes.'],
  ['anu', 0, 900, "I finished Tuesday's tasks. On Friday."],
  ['anu', 900, 2000, 'I have a spreadsheet for this. It is also on fire.'],
  ['rahul', 0, 900, 'Looking busy is a full-time job.'],
  ['rahul', 0, 2000, 'Rule one: never make eye contact with a manager holding a laptop.'],
  ['rahul', 900, 2000, "Don't run. Running looks like initiative."],
  ['manager', 0, 900, "Let's circle back. On everything. Forever."],
  ['manager', 0, 900, 'Love the energy. Keep it. I may need some.'],
  ['manager', 900, 2000, 'Everything is fine. This is what fine looks like.'],
  ['deepa', 0, 2000, 'Synergex, Deepa speaking. No, he is in a meeting. He is always in a meeting.'],
  ['deepa', 0, 2000, "Sign here, here, and here. No, I don't know what it's for either."],
  ['arjun', 0, 2000, 'Revenue is… a vibe.'],
  ['neha', 0, 2000, 'Can we make the logo bigger? Said nobody who has seen the logo.'],
  ['neha', 900, 2000, "No, Mom, I haven't had lunch. It's 3 PM here too."],
  ['dev', 0, 2000, 'Works on my machine.'],
  ['kiran', 0, 2000, "Found a bug. Marked it as a feature. Everyone's happy."],
  ['hr', 0, 2000, 'Just gathering information. For no reason.'],
];
