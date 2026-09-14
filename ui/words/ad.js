/**
 * The weekly Your ad's words (the owner's call, 2026-09-15). Read-only: the
 * ad is written once, in round 0, and runs as it is (I9). The part names are
 * the ones the keyword card's Quality Score uses, so the two read alike.
 */

import { line } from './line.js';

export const AD = Object.freeze({
  intro: line('reading', ({ week }) => `Written once, before week ${week}. It runs every week as it is.`),
  asSearchersSee: line('label', 'As searchers see it'),
  sponsored: line('label', 'Sponsored'),
  whoWrote: line('label', 'Who wrote it'),
  you: line('label', 'You'),
  fee: line('label', ({ amount, budget }) => `${amount} of the ${budget} creative budget`),
  free: line('label', ({ budget }) => `free · the ${budget} creative budget went to your ads`),
  hired: line('disclosure', 'A hired writer’s ad runs at the writer’s level, whatever the words say.',
    { why: 'writers' }),
  own: line('disclosure', 'Scored by the game’s own grader, on your words.', { why: 'writers' }),
  gradesTitle: line('label', ({ week }) => `How it grades in week ${week}`),
  expectedCtr: line('label', 'Expected CTR'),
  adRelevance: line('label', 'Ad relevance'),
  landingPage: line('label', 'Landing page'),
  outOf: line('label', ({ value, scale }) => `${value}/${scale}`),
  laterPage: line('reading', ({ part, value, week }) => `${part} ${value} from week ${week}, when the site work `
    + 'goes live.'),
  laterCopy: line('reading', ({ part, value, week }) => `${part} ${value} from week ${week}, when your own `
    + 'words go live.'),
  qsNote: line('reading', 'Each keyword’s Quality Score rates these against the other advertisers on its search.',
    { why: 'qualityScore' }),
  pageTitle: line('label', 'Your landing page'),
  quoted: line('label', ({ text }) => `“${text}”`),
  pageRead: line('label', 'what the grader read'),
  stripAt: line('label', ({ label, week }) => `${label} · week ${week}`),
  stripFrom: line('label', ({ from, label, week }) => `${from} → ${label} · week ${week}`),
});
