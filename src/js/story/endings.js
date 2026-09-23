// Endings. evaluateEnding() is called when the player leaves the building or the
// day runs out. Order matters: dramatic outcomes beat quiet ones.
import { fmtTime, T } from '../config.js';

export const ENDINGS = {
  chaos: { name: 'Chaos', tag: 'Escorted out' },
  whistleblower: { name: 'Whistleblower', tag: 'Integrity: 100%' },
  middle: { name: 'Middle Management', tag: '"Got a minute?"' },
  hero: { name: 'Corporate Hero', tag: 'You won. Did you?' },
  enlightenment: { name: 'Enlightenment', tag: 'Left at five. Felt free.' },
  escape: { name: 'The Escape', tag: 'Tomorrow is Tuesday.' },
  overtime: { name: 'Overtime', tag: 'Part of the office now' },
};

const avgRel = (s) => (s.rel.rahul + s.rel.anu + s.rel.manager) / 3;

export function evaluateEnding(s, how) {
  const f = s.flags, st = s.stats, c = s.counters;
  if (f.quit || f.escortedOut || c.chaos >= 5 || st.reputation <= 10) return 'chaos';
  if (f.reportedToHR) return 'whistleblower';
  if (f.hushPromotion || (c.sure >= 7 && s.rel.manager >= 70)) return 'middle';
  const hero = c.tasksDone >= 6 && st.reputation >= 65 && f.prodFixed;
  if (how === 'overtime') return hero ? 'hero' : 'overtime';
  if (hero && s.time >= T(17, 0)) return 'hero';
  if (s.time >= T(17, 0) && st.sanity >= 45 && st.energy >= 20 && st.workload <= 60 && avgRel(s) >= 50 && st.reputation >= 40) return 'enlightenment';
  return 'escape';
}

// Lines revealed one by one. [text, style] where style = huge | small | undefined.
export function endingLines(id, s) {
  const t = fmtTime(s.leftAt ?? s.time);
  const sure = s.counters.sure;
  switch (id) {
    case 'hero': return [
      ['You completed every task.'], ['You fixed production.'],
      [`You said "Sure" ${sure} time${sure === 1 ? '' : 's'}.`], ['You were promoted.'],
      ['Your workload is now 200%.'], ['You won.', 'huge'], ['Did you?', 'small'],
    ];
    case 'escape': return [
      [`${t}.`], ['The elevator doors close.'], ['Nobody said "Got a minute?"'],
      ['You escaped.', 'huge'], ['Tomorrow is Tuesday. Tuesday has a stand-up.', 'small'],
    ];
    case 'middle': return [
      ['You accepted the promotion.'], ['New title. New lanyard. Same Monday.'],
      ['Tomorrow you will walk up to someone\'s desk and say…'], ['"Got a minute?"', 'huge'],
    ];
    case 'whistleblower': return [
      ['You sent everything to HR.'], ['Mr. Menon is now "pursuing other opportunities".'],
      ['Production is up. Morale is up.'], ['Your inbox is also up. Way up.'], ['Integrity: 100%', 'huge'],
    ];
    case 'chaos': return s.flags.quit ? [
      ['You said "I quit."'], ['Out loud. In the lobby. To HR.'], ['Building security helped you carry your fake plant.'],
      ['Legendary.', 'huge'], ['Your badge no longer opens doors. It never really did.', 'small'],
    ] : [
      ['Building security walked you out.'], ['Your desk plant was confiscated as evidence.'], ['It was a fake plant.'],
      ['Legendary.', 'huge'], ['Your name is now a cautionary slide in onboarding.', 'small'],
    ];
    case 'enlightenment': return [
      [`${t}.`], ['You simply stood up and left.'], ['Nobody noticed.'],
      ['For the first time in a long time, you felt free.'], ['Free.', 'huge'],
    ];
    case 'overtime': default: return [
      ['5:30 PM came and went.'], ['The motion-sensor lights turned off.'], ['The cleaning crew found you at 9 PM.'],
      ['You are part of the office now.', 'huge'],
    ];
  }
}
