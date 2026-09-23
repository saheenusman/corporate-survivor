// Task definitions. "mins" = in-game minutes spent in the work montage.
export const TASKS = {
  emails: {
    name: 'Answer your emails', where: 'Your desk', mins: 30,
    fx: { energy: -5, sanity: -3, workload: -6, reputation: 1 },
    lines: ['Replying "Noted." to fourteen emails…', 'Unsubscribing from the newsletter about newsletters…', 'Marking everything as read. Strategically.'],
  },
  q3deck: {
    name: 'Update the Q3 deck', where: 'Your desk', mins: 70, shortMins: 30,
    fx: { energy: -12, sanity: -7, workload: -14, reputation: 5, trust: 5 },
    lines: ['Moving a chart two pixels to the left…', 'Changing "growth" to "strategic growth"…', 'Adding a slide that says "Questions?"', 'Saving as Q3_deck_v13_FINAL.pptx'],
  },
  config: {
    name: 'Deploy the "small config change"', where: 'Your desk', mins: 20,
    fx: { energy: -4, sanity: -2, workload: -8, trust: 6, flag: 'deployedByPlayer' },
    lines: ['Changing one value from true to True…', 'Skipping code review. It is a Monday.', 'Deployed. Nothing bad can happen now.'],
  },
  printReport: {
    name: "Print Anu's quarterly report", where: 'Printer 2', printer: true,
    fx: { anu: 10, workload: -5, reputation: 2 },
  },
  deckdeck: {
    name: 'Make a deck about the deck', where: 'Your desk', mins: 40,
    fx: { energy: -8, sanity: -8, workload: -10, trust: 4, reputation: 2 },
    lines: ['Slide 1: "The Deck". Slide 2: "About".', 'Adding a Venn diagram of two identical circles…', 'Exporting to PDF so nobody can edit it.'],
  },
  rename: {
    name: 'Rename every file to "FINAL"', where: 'Your desk', mins: 20,
    fx: { energy: -3, sanity: -5, workload: -6, trust: 3 },
    lines: ['report.xlsx → report_FINAL.xlsx', 'report_FINAL.xlsx → report_FINAL_FINAL.xlsx', 'FINAL_FINAL_v7_REAL_FINAL.xlsx. Perfect.'],
  },
  forward: {
    name: 'Forward "the email" to everyone again', where: 'Your desk', mins: 10,
    fx: { energy: -2, sanity: -3, workload: -4, trust: 2 },
    lines: ['Reply-all… Reply-all… Reply-all…', 'Someone replied "please remove me from this list" to the whole list.'],
  },
  print2: {
    name: 'Print it again, but in colour', where: 'Printer 2', printer: true,
    fx: { workload: -4, trust: 3 },
  },
  timesheet: {
    name: 'Fill in your timesheet', where: 'Your desk', mins: 15,
    fx: { sanity: -4, workload: -5, reputation: 1 },
    lines: ['Logging four hours of "alignment"…', 'Logging one hour of "logging hours".'],
  },
  singapore: {
    name: 'Join the 9 PM call with Singapore', where: 'Tonight. From home. Sadly.', impossible: true,
    fx: {},
  },
  fixProd: {
    name: 'Fix production (somehow)', where: 'Anywhere. Ask around.', special: true,
    fx: {},
  },
};

export const CLUES = {
  finance_rumor: 'Finance: a pricing config changed right before lunch. Air fryers are now ₹0.',
  manager_phone: 'Mr. Menon on the phone: "I just changed ONE value, sir."',
  manager_phone_you: 'Mr. Menon on the phone: "Someone on my team deployed it."',
  deploy_log: 'Deploy log: 12:05 PM — deployed by m.menon (from the shared admin login).',
  deploy_log_you: 'Deploy log: deployed by you. At his request. In writing? …No.',
  edit_history: "Mr. Menon's browser history: \"how to undo deploy\", \"is it legal to blame intern\".",
  sticky_password: 'The shared admin password is on a sticky note on Mr. Menon\'s monitor.',
  rahul_tip: 'Rahul: production runs on a dusty box near the printer. Nobody has ever restarted it.',
  hr_deadline: 'HR needs a name for the incident report by 4:30 PM.',
};

// Clues that point at the manager. Two or more = enough to confront him.
export const MANAGER_EVIDENCE = ['manager_phone', 'deploy_log', 'edit_history', 'sticky_password'];
