/**
 * The field guide's chapters (stage C2, plans/2026-09-12-content-model-and-field-guide.md).
 *
 * The guide is where the screens' explanations go, so it is where a false
 * sentence would do the most damage and be read least often. Each chapter says
 * how real Google Ads does something and then what this game does, and both
 * halves are held here:
 *
 * - the real half must carry a source, unless the chapter is a game device with
 *   no real equivalent (an absence cannot be cited);
 * - the game half must cite the DECISIONS entries or spec sections it rests on,
 *   and every one of them must exist;
 * - the game half types no number: every figure arrives from `guideFigures`,
 *   which reads the engine's constants, so a chapter cannot drift from them.
 *
 * WHAT THESE TESTS CANNOT DO. They prove a cited entry exists, not that the
 * chapter agrees with it. That is checked by reading, when a chapter is written
 * and whenever an entry it cites changes.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHAPTERS, CONTENTS, START_HERE, GOING_DEEPER, chapter, basic, DEPARTURE_MAX_WORDS,
} from '../ui/guide/chapters.js';
import { guideFigures } from '../ui/guide/figures.js';
import { GUIDE } from '../ui/words/guide.js';
import { sectionOf } from '../ui/shell/sections.js';
import { MAX_BID_MULTIPLE, ATTRIBUTION_LAG_DISTRIBUTION } from '../engine/constants.js';
import { ARRIVAL_SHAPE } from '../ui/dashboard.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const DECISIONS = read('DECISIONS.md');
const SPEC = read('ENGINE_SPEC_v0.3.md');
const FIGURES = guideFigures();
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the ledger or the spec hold this citation? */
function cited(id) {
  if (/^H\d+$/.test(id)) {
    const start = DECISIONS.indexOf('\n## H.');
    const section = DECISIONS.slice(start, DECISIONS.indexOf('\n## ', start + 1));
    return new RegExp(`^${id.slice(1)}\\. `, 'm').test(section);
  }
  if (id.startsWith('§')) return new RegExp(`^#+ ${escape(id.slice(1))} `, 'm').test(SPEC);
  return new RegExp(`^### ${escape(id)}\\. `, 'm').test(DECISIONS);
}

/**
 * Every "why" the screens point at, from every module in ui/words/. Loaded
 * with Vite's glob rather than a file URL, which the project folder's spaces
 * break.
 */
const WORD_MODULES = import.meta.glob('../ui/words/*.js', { eager: true });

async function screenWhys() {
  expect(Object.keys(WORD_MODULES).length).toBeGreaterThan(0);
  const whys = new Set();
  for (const module of Object.values(WORD_MODULES)) {
    for (const group of Object.values(module)) {
      if (typeof group !== 'object' || group === null) continue;
      for (const entry of Object.values(group)) if (entry?.why) whys.add(entry.why);
    }
  }
  return whys;
}

const base = {
  title: 'A title',
  real: () => 'How real Google Ads does it.',
  realSources: [{ label: 'Google Ads Help', url: 'https://support.google.com/google-ads/' }],
  game: () => 'What this game does.',
  cites: ['I27'],
  // Since 2026-09-19 a chapter must say where it departs, or why it does not.
  departs: ['and here is the one way it is not like the real thing'],
  yourAccount: 'returns',
};

describe('a chapter is refused unless it is whole', () => {
  test('a whole chapter is accepted', () => {
    expect(chapter(base).title).toBe('A title');
  });

  test('it needs a title, a real half and a game half', () => {
    expect(() => chapter({ ...base, title: '' })).toThrow();
    expect(() => chapter({ ...base, real: undefined })).toThrow();
    expect(() => chapter({ ...base, game: undefined })).toThrow();
  });

  test('the real half needs a source, unless the chapter is a game device', () => {
    expect(() => chapter({ ...base, realSources: [] })).toThrow(/source/);
    expect(chapter({ ...base, realSources: [], device: true }).device).toBe(true);
  });

  test('the game half must cite something', () => {
    expect(() => chapter({ ...base, cites: [] })).toThrow(/cite/);
  });
});

describe('the chapters', () => {
  // The two-halves tests read GOING_DEEPER: a ground-floor chapter has one
  // plain paragraph and no citation, and is held to its own rules below.
  const entries = GOING_DEEPER.map((id) => [id, CHAPTERS[id]]);

  test('there are chapters to check', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  test.each(entries)('%s: each half is under 120 words', (_, c) => {
    for (const half of [c.real(FIGURES), c.game(FIGURES)]) {
      expect(wordCount(half)).toBeGreaterThan(10);
      expect(wordCount(half)).toBeLessThanOrEqual(120);
    }
  });

  test.each(entries)('%s: every citation exists in DECISIONS.md or the spec', (_, c) => {
    for (const id of c.cites) expect(cited(id), id).toBe(true);
  });

  /**
   * The attribution chapter's example names two days doing two different jobs:
   * the day the sale is COUNTED ON, and the day the figure MOVES. It once said
   * "adds a conversion to Monday, on Friday", which is true — Google Ads Help,
   * *Understand your conversion tracking data*: "if your ad was clicked on last
   * week and that traffic converted this week, both the click and the
   * conversion are reported back to last week" — and read as a typo, in the one
   * chapter whose job is explaining why a number a player has already read
   * changes afterwards. The owner read it as an error (2026-09-16), which is
   * the only test that matters for a sentence.
   */
  test('the attribution chapter keeps its two days apart', () => {
    const real = CHAPTERS.attributionLag.real(FIGURES);
    // The sale is counted on the day of the click.
    expect(real).toMatch(/counted on Monday, the day of the click/);
    // And the figure moves later, which is a separate clause.
    expect(real).toMatch(/change on Friday/);
    expect(real).not.toMatch(/adds a conversion to Monday, on Friday/);
  });

  test.each(entries)('%s: every real source is a link, unless it is a device', (_, c) => {
    if (c.device) return;
    expect(c.realSources.length).toBeGreaterThan(0);
    for (const source of c.realSources) expect(source.url).toMatch(/^https:\/\//);
  });

  test.each(entries)('%s: the game half and the title type no number', (_, c) => {
    const blank = Object.fromEntries(c.needs.map((name) => [name, 'X']));
    expect(c.title).not.toMatch(/\d/);
    expect(c.game(blank)).not.toMatch(/\d/);
  });

  test.each(entries)('%s: it renders whole with the figures the game supplies', (_, c) => {
    for (const name of c.needs) expect(Object.keys(FIGURES), name).toContain(name);
    expect(`${c.real(FIGURES)} ${c.game(FIGURES)}`).not.toMatch(/undefined|NaN/);
  });

  test.each(entries)('%s: "in your account" points at a part that exists', (_, c) => {
    // Until the switch-over's part 2 this asked the classic page and the
    // decision form. The page is gone, so the part a chapter points at is one a
    // Studio section draws; tests/sections.test.js holds the other half, that
    // the section's own module really sets the slot.
    expect(c.yourAccount).not.toBe('decisions');
    expect(sectionOf(c.studioAccount ?? c.yourAccount), c.yourAccount).not.toBeNull();
  });

  test.each(entries)('%s: related chapters exist', (_, c) => {
    for (const id of c.related) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  // The Guide page shows `related` as "Read beside it", so the owner asked for a
  // read-through first (2026-09-15). Its one rule: chapters that rest on the same
  // departure read beside each other, as the two under the bid cap now do.
  test('the chapters that cite the bid cap read beside each other (D13)', () => {
    const capped = entries.filter(([, c]) => c.cites.includes('D13')).map(([id]) => id);
    expect(capped.length).toBeGreaterThan(1);
    for (const id of capped) {
      for (const other of capped) if (other !== id) expect(CHAPTERS[id].related, id).toContain(other);
    }
  });

  // Found drawing the Guide as a page (2026-09-15): two chapters named a classic
  // card ("the returns card", "The share card") that the Studio does not draw.
  // What the game does is said of the figure, so it reads true in both looks.
  test.each(entries)('%s: what the game does names no card', (_, c) => {
    expect(c.game(FIGURES)).not.toMatch(/\bcards?\b/i);
  });

  // Places scale an account's returns (LOCATION_RETURN_MULTIPLIER, normalised
  // to the country; F14 holds its effect on send-backs open). Drawing the Guide
  // page put this chapter beside an account sending back 28.0% of delivered
  // orders against its 30% (2026-09-15).
  test('the returns chapter gives the send-back rate as the country\'s, which where you sell moves', () => {
    const game = CHAPTERS.returnsSplit.game(FIGURES);
    expect(game).toContain(`${FIGURES.postDelivery} of delivered orders across the country`);
    expect(game).toContain('depending on where you sell');
    expect(CHAPTERS.returnsSplit.cites).toContain('F14');
  });

  // THE GAP PLAYING IT FOUND (2026-09-19). Your week's six figures are the
  // first thing after round 0 and a player reads them twelve times. Net profit,
  // ROAS and cost per conversion appeared in no chapter at all — only as the
  // names of Google's bidding strategies inside `smartBidding` and `hours`.
  test('the three figures that had no chapter now have one', () => {
    const c = CHAPTERS.readingTheWeek;
    const said = `${c.real(FIGURES)} ${c.game(FIGURES)}`.toLowerCase();
    for (const term of ['net profit', 'return on ad spend', 'cost per conversion']) {
      expect(said, `readingTheWeek never says ${term}`).toContain(term);
    }
    // It hangs off the six figures themselves, not off some other card.
    expect(c.yourAccount).toBe('headline');
  });

  // It would be easy, and wrong, to say Google cannot report profit. Its own
  // "About conversion values" gives "sales revenue or profit margins" as the
  // examples of what to report, so the first draft of this chapter was false.
  // What is true is narrower: here you do not choose, and nobody uploads the
  // return (Google Ads Help: About conversion adjustments).
  test('it does not claim Google cannot report profit', () => {
    const c = CHAPTERS.readingTheWeek;
    const said = [c.real(FIGURES), c.game(FIGURES), ...c.departs.map((d) => d(FIGURES))].join(' ');
    expect(said).not.toMatch(/Google (Ads )?(cannot|can't|never) (report|show|know)[^.]*profit/i);
    expect(c.real(FIGURES)).toMatch(/sales revenue or profit margins/);
    expect(c.realSources.map((s) => s.url)).toContain('https://support.google.com/google-ads/answer/7686447');
  });

  test('the chapters with a bid adjustment say no bid passes the cap, and cite it (D13)', () => {
    // Where and when's bars stop at the cap and say so (2026-09-15); the guide
    // behind their "why?" links has to agree, from the constant itself.
    expect(FIGURES.bidCap).toBe(`${MAX_BID_MULTIPLE} times`);
    for (const id of ['hours', 'cashOnDelivery']) {
      // The cap is a DEPARTURE, so from 2026-09-19 it may be said in the block
      // rather than the half. It must still be said, and still as a figure —
      // which is why a departure may be a function of the figures it quotes.
      const said = [CHAPTERS[id].game(FIGURES), ...CHAPTERS[id].departs.map((d) => d(FIGURES))];
      expect(said.some((text) => text.includes(`${FIGURES.bidCap} your keyword bid`)), id).toBe(true);
      expect(CHAPTERS[id].cites, id).toContain('D13');
    }
  });
});

describe('every chapter can be reached, and every link lands', () => {
  test('every "why" on a screen names a chapter', async () => {
    for (const why of await screenWhys()) expect(Object.keys(CHAPTERS), why).toContain(why);
  });

  test('the contents list names only chapters', () => {
    for (const id of CONTENTS) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  test('no chapter is an orphan', async () => {
    const reachable = new Set([...(await screenWhys()), ...CONTENTS]);
    for (const id of Object.keys(CHAPTERS)) expect(reachable.has(id), id).toBe(true);
  });
});

describe('a departure is a field, not a sentence buried in the prose', () => {
  // MEASURED 2026-09-19: in `hours` the departure ran to 73 words of 109, and
  // in `cashOnDelivery` 65 of 118 — the two chapters both testers named as the
  // hardest to read. And five more chapters declared no departure while stating
  // one inside their prose, where no reader could find it and no test could
  // reach it. So it becomes a field of its own.
  const departures = (id) => CHAPTERS[id].departs.map((entry) => entry(FIGURES));

  test('a chapter declares its departures as a list', () => {
    expect(CHAPTERS.hours.departs).toBeInstanceOf(Array);
    expect(departures('hours')).toHaveLength(3);
  });

  test('each one is short enough to read on its own', () => {
    for (const line of departures('hours')) {
      expect(wordCount(line), line).toBeLessThanOrEqual(25);
    }
  });

  // A departure is no less a claim than the half it came out of, so it types no
  // number either: it may be a function of the figures it quotes, exactly as
  // the two halves are (the owner's choice, 2026-09-19). `hours` quotes the bid
  // cap, which is MAX_BID_MULTIPLE and must not become the typed word "four".
  test('a departure may quote a figure, and it arrives from the engine', () => {
    const capped = departures('hours').find((line) => line.includes(FIGURES.bidCap));
    expect(capped, 'the cap should reach the reader as a figure').toBeTruthy();
    expect(capped).toContain(`${MAX_BID_MULTIPLE} times`);
    expect(CHAPTERS.hours.needs).toContain('bidCap');
  });

  test('a plain string is allowed too, and comes back as a line', () => {
    const made = chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departs: ['the game does this its own way'],
    });
    expect(made.departs[0]({})).toBe('the game does this its own way');
  });

  // The word itself goes. It is the name of the field now, and a beginner has
  // never met it in this sense; the block's own heading says what it is.
  test('the chapter that had three departures no longer says so in prose', () => {
    expect(CHAPTERS.hours.game(FIGURES)).not.toMatch(/departs?/i);
  });

  test('a chapter with none says so in words, so the claim can be checked', () => {
    const made = chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departsNot: 'the game does this exactly as Google does',
    });
    expect(made.departs).toEqual([]);
    expect(made.departsNot).toMatch(/exactly/);
  });

  test('a boolean is refused, because a reason can be checked and true cannot', () => {
    expect(() => chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms', departsNot: true,
    })).toThrow(/reason/);
  });

  test('declaring both, or neither, is refused', () => {
    const base = {
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
    };
    expect(() => chapter({ ...base, departs: ['one'], departsNot: 'none' })).toThrow(/both/);
    expect(() => chapter({ ...base })).toThrow(/where it departs/);
  });
});

describe('every chapter says where it departs, or why it does not', () => {
  const departures = (id) => CHAPTERS[id].departs.map((entry) => entry(FIGURES));

  test.each(GOING_DEEPER)('%s declares one or the other, for real', (id) => {
    const c = CHAPTERS[id];
    expect(c.departs.length > 0 || Boolean(c.departsNot), id).toBe(true);
    // Task 1 gave twelve chapters a truthful holding sentence. Task 2 replaces
    // every one, and this is what stops it surviving.
    expect(c.departsNot ?? '', id).not.toMatch(/not pulled out yet/);
  });

  test('every departure is its own line, and short enough to read', () => {
    for (const id of GOING_DEEPER) {
      for (const line of departures(id)) {
        expect(wordCount(line), `${id}: ${line}`).toBeLessThanOrEqual(DEPARTURE_MAX_WORDS);
      }
    }
  });

  // MEASURED 2026-09-19: eight chapters labelled a departure, and five more
  // stated one inside their prose where nobody could find it. Pulled out, there
  // are far more of them than were ever labelled.
  test('there are far more of them than the eight that used to be labelled', () => {
    const all = GOING_DEEPER.flatMap((id) => departures(id));
    expect(all.length).toBeGreaterThan(18);
  });

  test('no game half still carries a departure in its prose', () => {
    for (const id of GOING_DEEPER) {
      const game = CHAPTERS[id].game(FIGURES);
      expect(game, id).not.toMatch(/departs?\b/i);
      expect(game, `${id} still enumerates its departures mid-paragraph`)
        .not.toMatch(/kinder than a real market/i);
    }
  });

  // The five that were buried. Naming them here means a later edit cannot
  // quietly fold one back into the prose it came out of.
  test.each(['kindMarket', 'returnsSplit', 'counterfactuals', 'rankOrBudget', 'ownName'])(
    '%s, which used to hide its departure in prose, now declares it',
    (id) => {
      expect(departures(id).length, id).toBeGreaterThan(0);
    },
  );

  test('a departure never drops the citation it rests on', () => {
    for (const id of GOING_DEEPER) {
      expect(CHAPTERS[id].cites.length, id).toBeGreaterThan(0);
      for (const c of CHAPTERS[id].cites) expect(cited(c), `${id} cites ${c}`).toBe(true);
    }
  });
});

describe('a figure says what it is counting', () => {
  // THE SENTENCE A TESTER READ OUT. "55% this week, then 28%, then 12% and then
  // 5%" never said 55% OF WHAT, and four percentages attached to no noun is not
  // an explanation. Fixed at the source, so the noun travels with the number
  // everywhere the figure is quoted (plans/2026-09-19-guide-rewrite.md, rule 4).
  test('the arrival shape names the orders it is counting', () => {
    expect(ARRIVAL_SHAPE).toMatch(/^55% of orders/);
    expect(ARRIVAL_SHAPE).toContain('in the week of the click');
  });

  test('it is still read off the constant, share for share', () => {
    for (const share of ATTRIBUTION_LAG_DISTRIBUTION) {
      expect(ARRIVAL_SHAPE).toContain(`${Math.round(100 * share)}%`);
    }
  });

  test('the chapter quoting it does not say the noun twice', () => {
    const game = CHAPTERS.attributionLag.game(FIGURES);
    expect(game).toContain(FIGURES.lagShape);
    expect(game.match(/of orders/g) ?? [], 'the noun arrives with the figure').toHaveLength(1);
  });

  // The other eleven carry their noun in the sentence around them, checked by
  // hand on 2026-09-19. This holds the one that could not.
  test('every figure the guide quotes reaches a reader as words, not a bare share', () => {
    for (const [name, value] of Object.entries(FIGURES)) {
      expect(String(value).trim(), name).not.toBe('');
      expect(String(value), name).not.toMatch(/^0\.\d+$/);
    }
  });
});

describe('a beginner can parse a sentence of it', () => {
  // A sentence ends at a full stop, a colon or a semicolon: the colon counts
  // because a clause after one is a new thought to hold, which is what the
  // bound is about.
  const sentences = (text) => text.split(/(?<=[.:;])\s+/).map((s) => s.trim()).filter(Boolean);
  const halves = GOING_DEEPER.map((id) => [id, CHAPTERS[id]]).flatMap(([id, c]) => [
    [`${id}.real`, c.real(FIGURES)], [`${id}.game`, c.game(FIGURES)],
  ]);

  // MEASURED 2026-09-19, before the rewrite: the median chapter's longest
  // sentence ran to 32 words in its game half and 28 in its real one, with
  // maxima of 41 and 40. Both testers who gave up called the guide too hard.
  test.each(halves)('%s keeps every sentence to 25 words', (name, text) => {
    for (const s of sentences(text)) {
      expect(wordCount(s), `${name}: ${s}`).toBeLessThanOrEqual(25);
    }
  });

  // A topic sentence you can act on, before any qualification. Before the
  // rewrite: 4 of 13 game halves and 6 of 13 real ones.
  test.each(halves)('%s opens in 15 words or fewer', (name, text) => {
    expect(wordCount(sentences(text)[0]), `${name}: ${sentences(text)[0]}`).toBeLessThanOrEqual(15);
  });

  // SEEDED FROM WHAT IS IN THE FILE, not invented: `shape` twice, `lean` as a
  // noun twice, `stack` as a verb twice, and `departs` nine times. It is a
  // ratchet — a word joins the first time a reader trips on one, and never
  // leaves.
  const BANNED = [
    [/\bshapes?\b/i, 'a distribution called a shape'],
    [/\bleans?\b/i, 'lean, as a noun'],
    [/\bstacks?\b/i, 'stack, as a verb'],
    [/\bdeparts?\b/i, 'departs — it is a field now, not a word'],
  ];
  test.each(halves)('%s uses none of the words a reader tripped on', (name, text) => {
    for (const [pattern, why] of BANNED) {
      expect(pattern.test(text), `${name} uses ${why}`).toBe(false);
    }
  });

  test('the departures follow the same rules as the halves', () => {
    for (const id of GOING_DEEPER) {
      for (const line of CHAPTERS[id].departs.map((entry) => entry(FIGURES))) {
        for (const s of sentences(line)) {
          expect(wordCount(s), `${id}: ${s}`).toBeLessThanOrEqual(25);
        }
        for (const [pattern, why] of BANNED) {
          expect(pattern.test(line), `${id} uses ${why}`).toBe(false);
        }
      }
    }
  });
});

describe('the guide has a ground floor as well as its nuance chapters', () => {
  const madeBasic = (over = {}) => basic({
    title: 'What a keyword is',
    plain: () => 'A keyword is a word or phrase you choose.',
    sources: [{ label: 'Google Ads Help: Keywords', url: 'https://support.google.com/google-ads/answer/6323' }],
    step: 3,
    then: 'broadMatch',
    ...over,
  });

  test('a ground-floor chapter is one plain paragraph, and says where it is used', () => {
    const made = madeBasic();
    expect(made.kind).toBe('basic');
    expect(made.plain({})).toMatch(/^A keyword/);
    expect(made.step).toBe(3);
    expect(made.then).toBe('broadMatch');
  });

  test('a nuance chapter says which kind it is too, so nobody has to guess', () => {
    expect(CHAPTERS.hours.kind).toBe('chapter');
  });

  // The rule chapter() already follows: an absence cannot be cited, but
  // anything real must be.
  test('it needs a source unless it is a game device', () => {
    expect(() => madeBasic({ sources: [] })).toThrow(/source/);
    expect(madeBasic({ sources: [], device: true }).device).toBe(true);
  });

  test('it must name the chapter that continues it', () => {
    expect(() => madeBasic({ then: undefined })).toThrow(/continues/);
  });

  // IT NEVER DISCLOSES A DEPARTURE. `then` hands the reader to the chapter that
  // owns one — "Your budget" departs, and `weeklySplit` is where it is said.
  test('and that chapter has to exist', () => {
    for (const id of START_HERE) {
      expect(Object.keys(CHAPTERS), `${id} continues into ${CHAPTERS[id].then}`)
        .toContain(CHAPTERS[id].then);
    }
  });

  test('it must say which round 0 step asks for it', () => {
    expect(() => madeBasic({ step: 0 })).toThrow(/step/);
    expect(() => madeBasic({ step: 6 })).toThrow(/step/);
    expect(() => madeBasic({ step: undefined })).toThrow(/step/);
  });

  // ONE ORDERED BOOK, the ground floor first, so turning the page at the end of
  // it lands on the first nuance chapter. That is the ladder, for free.
  test('the book is one list, the ground floor first', () => {
    expect(CONTENTS).toEqual([...START_HERE, ...GOING_DEEPER]);
    expect(START_HERE.length).toBeGreaterThan(0);
    // 14 since 2026-09-19: `readingTheWeek` was added because playing the game
    // showed net profit, ROAS and CPA were defined in none of the other 22.
    expect(GOING_DEEPER).toHaveLength(14);
    expect(CONTENTS[START_HERE.length]).toBe(GOING_DEEPER[0]);
  });

  test('every chapter in the book exists, whichever kind it is', () => {
    for (const id of CONTENTS) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  test('the ground floor runs in the order round 0 asks', () => {
    const steps = START_HERE.map((id) => CHAPTERS[id].step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});

describe('the guide’s own labels follow the rules its chapters do', () => {
  // Found by playing it, 2026-09-19: the contents page promised "two halves"
  // of every chapter — which the ground floor does not have — and used the one
  // word the rewrite retired. The banned list covered CHAPTERS and not the
  // labels around them, so it caught neither.
  const BANNED = [
    [/\bshapes?\b/i, 'a distribution called a shape'],
    [/\bleans?\b/i, 'lean, as a noun'],
    [/\bstacks?\b/i, 'stack, as a verb'],
    [/\bdeparts?\b/i, 'departs — it is a field now, not a word'],
  ];

  test.each(Object.keys(GUIDE))('%s uses none of the words a reader tripped on', (name) => {
    const text = GUIDE[name]({ n: 1, of: 14, title: 'A title', step: 3 });
    for (const [pattern, why] of BANNED) {
      expect(pattern.test(text), `GUIDE.${name} uses ${why}`).toBe(false);
    }
  });

  test('the introduction describes both kinds of chapter, and counts neither', () => {
    const intro = GUIDE.intro();
    expect(intro).toContain('Start here');
    expect(intro).toContain('Going deeper');
    expect(intro, 'a new chapter must not make it wrong').not.toMatch(/\d|thirteen|fourteen/i);
  });
});

describe('the ground floor covers every control round 0 asks for', () => {
  const sentences = (t) => t.split(/(?<=[.:;])\s+/).map((s) => s.trim()).filter(Boolean);

  test('there are nine of them, one per control', () => {
    expect(START_HERE).toHaveLength(9);
  });

  // ONE PER STEP, and every step covered. The first run teaches the world; these
  // teach the controls; the thirteen keep the surprises (the design's section 3).
  test('all five of round 0’s steps have at least one', () => {
    const steps = new Set(START_HERE.map((id) => CHAPTERS[id].step));
    expect([...steps].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('two are game devices, and every other one carries a source', () => {
    const devices = START_HERE.filter((id) => CHAPTERS[id].device);
    expect(devices, `devices: ${devices}`).toHaveLength(2);
    for (const id of START_HERE) {
      if (CHAPTERS[id].device) continue;
      expect(CHAPTERS[id].sources.length, id).toBeGreaterThan(0);
      for (const s of CHAPTERS[id].sources) {
        expect(s.url, `${id}: ${s.label}`).toMatch(/^https:\/\//);
        expect(s.label, s.url).toBeTruthy();
      }
    }
  });

  // The rewrite's rules apply here too: these are the chapters a beginner reads
  // first, so they are held hardest.
  test.each(START_HERE)('%s opens in 15 words, and keeps every sentence to 25', (id) => {
    const text = CHAPTERS[id].plain(FIGURES);
    const ss = sentences(text);
    expect(wordCount(ss[0]), `${id} opens: ${ss[0]}`).toBeLessThanOrEqual(15);
    for (const s of ss) expect(wordCount(s), `${id}: ${s}`).toBeLessThanOrEqual(25);
  });

  test.each(START_HERE)('%s uses none of the words a reader tripped on', (id) => {
    const text = CHAPTERS[id].plain(FIGURES);
    for (const [pattern, why] of [
      [/\bshapes?\b/i, 'shape'], [/\bleans?\b/i, 'lean'],
      [/\bstacks?\b/i, 'stack'], [/\bdeparts?\b/i, 'departs'],
    ]) {
      expect(pattern.test(text), `${id} uses ${why}`).toBe(false);
    }
  });

  test.each(START_HERE)('%s types no number into its prose', (id) => {
    expect(CHAPTERS[id].plain(FIGURES), id).not.toMatch(/\b\d+(\.\d+)?%/);
  });

  // ONE WORD, ONE HOME. The controls live here; the world lives in the first
  // run; a term is never defined twice in two voices.
  test('it teaches the controls and leaves the world to the first run', () => {
    const titles = START_HERE.map((id) => CHAPTERS[id].title.toLowerCase()).join(' | ');
    for (const control of ['keyword', 'bid', 'budget', 'landing page', 'ad']) {
      expect(titles, `${control} should have a chapter`).toContain(control);
    }
  });
});

describe('the ground floor can be found from the step that needs it', () => {
  // A GROUND FLOOR NOBODY FINDS IS WORTH NOTHING. Before this, round 0 carried
  // 134 pieces of text and six "why?" links, onto four of the thirteen
  // chapters — so the depth existed and was unreachable where a beginner most
  // needed it (plans/2026-09-19-ground-floor.md, section 6).
  test('every ground-floor chapter has a why? somewhere that opens it', async () => {
    const whys = await screenWhys();
    for (const id of START_HERE) {
      expect([...whys], `${id} is unreachable: nothing links to it`).toContain(id);
    }
  });

  // How many a player can SEE is counted in tests/words.test.js, against the
  // drawing rather than the data: a `why` on a line nobody draws is not a link.
  test('round 0 links to more chapters than the four it used to reach', async () => {
    const { R0 } = await import('../ui/words/roundZero.js');
    const reached = new Set(Object.values(R0).map((entry) => entry.why).filter(Boolean));
    expect(reached.size, `reaches ${[...reached].join(', ')}`).toBeGreaterThanOrEqual(8);
  });

  test('every why? in round 0 names a chapter that exists', async () => {
    const { R0 } = await import('../ui/words/roundZero.js');
    for (const [name, entry] of Object.entries(R0)) {
      if (entry.why) expect(Object.keys(CHAPTERS), `R0.${name}`).toContain(entry.why);
    }
  });
});
