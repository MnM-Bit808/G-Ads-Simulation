import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AREAS, SECTIONS, RETIRED_SLOTS, sectionOf, sectionsIn, sectionState, visibilityRules, entranceSlots, slotOpen,
} from '../ui/shell/sections.js';
import { CHAPTERS } from '../ui/guide/chapters.js';
import { SETTLES_AFTER_ROUNDS } from '../ui/dashboard.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

// Where each Studio section sets the slots its parts carry.
const DRAWN_BY = {
  week: 'ui/week/render.js', keywords: 'ui/keywords/render.js', typed: 'ui/typed/render.js',
  ad: 'ui/ad/render.js', money: 'ui/money/render.js', where: 'ui/where/render.js',
  returns: 'ui/returns/render.js', rivals: 'ui/rivals/render.js', twelve: 'ui/results/render.js',
  learned: 'ui/results/render.js', reveal: 'ui/results/render.js', books: 'ui/results/render.js',
};

// Every card today's page draws, by the slot it carries: the page's own
// articles, the decision form's cards and the trends chart.
const CARD_SLOTS = [
  ...[...read('ui/index.html').matchAll(/<article class="card[^"]*" data-slot="([^"]+)"/g)].map((m) => m[1]),
  ...[...read('ui/decisions.js').matchAll(/dataset\.slot = '([^']+)'/g)].map((m) => m[1]),
  ...[...read('ui/chart.js').matchAll(/dataset\.slot = '([^']+)'/g)].map((m) => m[1]),
];

describe('every card on today\'s page has one place in the new layout', () => {
  test('all nineteen are found, each once', () => {
    expect(CARD_SLOTS).toHaveLength(19);
    expect(new Set(CARD_SLOTS).size).toBe(19);
  });

  test.each(CARD_SLOTS)('%s sits in exactly one section, or is retired', (slot) => {
    const homes = SECTIONS.filter((s) => s.slots.includes(slot)).length;
    expect(homes + (RETIRED_SLOTS.includes(slot) ? 1 : 0), slot).toBe(1);
  });

  test('no section names a card that does not exist', () => {
    for (const s of SECTIONS) {
      for (const slot of s.slots) expect(CARD_SLOTS, `${s.key}: ${slot}`).toContain(slot);
    }
  });

  test('Your keywords draws its own card, so the guide can still open it', () => {
    expect(RETIRED_SLOTS).toContain('keywords');
    expect(sectionOf('keywords').key).toBe('keywords');
  });

  test('Where and when draws its own bars, so the guide can still open both', () => {
    for (const slot of ['places', 'hours']) {
      expect(RETIRED_SLOTS, slot).toContain(slot);
      expect(sectionOf(slot).key, slot).toBe('where');
    }
  });

  test('What people typed draws its own list and Block words, so the guide can still open both', () => {
    for (const slot of ['terms', 'negatives']) {
      expect(RETIRED_SLOTS, slot).toContain(slot);
      expect(sectionOf(slot).key, slot).toBe('typed');
    }
  });

  test('Your money draws its own capital, month, bidding and week 8, so the guide can still open all five', () => {
    for (const slot of ['window', 'budget', 'split', 'bidding', 'deadline']) {
      expect(RETIRED_SLOTS, slot).toContain(slot);
      expect(sectionOf(slot).key, slot).toBe('money');
    }
  });

  test('the Market area is one section, Rivals, drawing the market\'s figures and the rival cards', () => {
    expect(sectionsIn('market').map((s) => s.key)).toEqual(['rivals']);
    for (const slot of ['insights', 'trends', 'market']) expect(RETIRED_SLOTS, slot).toContain(slot);
    // The rival cards keep the classic Auction insights' slot.
    expect(sectionOf('insights').key).toBe('rivals');
    expect(sectionOf('market').key).toBe('rivals');
  });

  test('Returns draws its own figures, weeks, discount and levers, so the guide can still open it', () => {
    for (const slot of ['returns', 'prepaid']) {
      expect(RETIRED_SLOTS, slot).toContain(slot);
      expect(sectionOf(slot).key, slot).toBe('returns');
    }
    expect(entranceSlots(SECTIONS.find((s) => s.key === 'returns')))
      .toEqual(['returns-figures', 'returns', 'prepaid', 'returns-levers']);
  });

  test('Your week draws its own figures, chart and impressions, so the guide can still open all three', () => {
    for (const slot of ['headline', 'share', 'revised']) {
      expect(RETIRED_SLOTS, slot).toContain(slot);
      expect(sectionOf(slot).key, slot).toBe('week');
    }
  });

  // CLAUDE.md's trap: "show me on the card" must land on something that exists.
  test.each(Object.entries(CHAPTERS))('the guide\'s %s can open the section holding its card', (_, c) => {
    expect(sectionOf(c.yourAccount), c.yourAccount).not.toBeNull();
  });

  // Found drawing the Guide as a page (2026-09-15): three chapters pointed where
  // their idea is not shown. A chapter may name a part only the Studio draws
  // (`studioAccount`); the classic page keeps `yourAccount`.
  test.each(Object.entries(CHAPTERS))('in the Studio, the guide\'s %s lands on a part its section really draws', (_, c) => {
    const slot = c.studioAccount ?? c.yourAccount;
    const s = sectionOf(slot);
    expect(s, slot).not.toBeNull();
    expect(read(DRAWN_BY[s.key]), `${s.key} draws ${slot}`).toContain(`'${slot}'`);
  });

  test('who writes the ad is shown where the writer is: Your ad', () => {
    expect(sectionOf(CHAPTERS.writers.studioAccount).key).toBe('ad');
  });

  test('defending your own name is shown where searches for your name are marked', () => {
    expect(sectionOf(CHAPTERS.ownName.yourAccount).key).toBe('typed');
    expect(read('ui/typed/render.js')).toContain('TYPED.yourName()');
  });

  test('what only a simulation can tell you is shown where its replays are, after the last week', () => {
    expect(sectionOf(CHAPTERS.counterfactuals.studioAccount).area).toBe('results');
  });
});

describe('a section opens when it has something true to say', () => {
  const find = (key) => SECTIONS.find((s) => s.key === key);

  test('Returns opens the week the first returns settle, not at a typed week', () => {
    const returns = find('returns');
    expect(returns.opensAt).toBe(SETTLES_AFTER_ROUNDS + 1);
    expect(sectionState(returns, { played: SETTLES_AFTER_ROUNDS, seen: {} }).locked).toBe(true);
    expect(sectionState(returns, { played: SETTLES_AFTER_ROUNDS + 1, seen: {} }))
      .toMatchObject({ locked: false, fresh: true });
  });

  // "Show me" waits for its section (the owner, 2026-09-15): Returns is locked
  // before week 6, and Results, where the replays are, before week 12.
  test('"Show me" waits while the section it would open is locked', () => {
    expect(slotOpen('returns', { played: SETTLES_AFTER_ROUNDS })).toBe(false);
    expect(slotOpen('returns', { played: SETTLES_AFTER_ROUNDS + 1 })).toBe(true);
    expect(slotOpen('results-moments', { played: TOTAL_ROUNDS - 1 })).toBe(false);
    expect(slotOpen('results-moments', { played: TOTAL_ROUNDS })).toBe(true);
    expect(slotOpen('share', { played: 1 })).toBe(true);
    expect(slotOpen('no-such-slot', { played: TOTAL_ROUNDS })).toBe(false);
  });

  test('its dot goes once it has been opened', () => {
    const returns = find('returns');
    const at = { played: SETTLES_AFTER_ROUNDS + 1, seen: {} };
    const { seenKey } = sectionState(returns, at);
    expect(sectionState(returns, { ...at, seen: { [seenKey]: true } }).fresh).toBe(false);
  });

  test('Your money carries a dot in a week the capital window is open, until opened that week', () => {
    const money = find('money');
    expect(sectionState(money, { played: 4, seen: {}, windowOpen: false }).fresh).toBe(false);
    const open = sectionState(money, { played: 4, seen: {}, windowOpen: true });
    expect(open.fresh).toBe(true);
    expect(sectionState(money, { played: 4, seen: { [open.seenKey]: true }, windowOpen: true }).fresh)
      .toBe(false);
  });

  test('Results is four sections, in the order they are read, each opening after the last week', () => {
    // The owner's choice, 2026-09-15 (design/results/).
    const results = sectionsIn('results');
    expect(results.map((s) => s.label)).toEqual(['Twelve weeks', 'What you learned', 'Where they sat', 'Everyone’s books']);
    for (const s of results) {
      expect(sectionState(s, { played: TOTAL_ROUNDS - 1, seen: {} }).locked, s.key).toBe(true);
      // And each carries a dot until it is opened.
      expect(sectionState(s, { played: TOTAL_ROUNDS, seen: {} }), s.key).toMatchObject({ locked: false, fresh: true });
    }
  });

  test('every area but the guide has sections; the guide opens its drawer instead', () => {
    for (const area of AREAS) expect(sectionsIn(area.key).length > 0, area.key).toBe(area.key !== 'guide');
  });
});

// Found planning Returns: rebuilding Your money took its week-5 entrance away,
// because the shell looked for the section's cards among the classic ones only.
describe('a first visit enters the parts the section shows', () => {
  const find = (key) => SECTIONS.find((s) => s.key === key);

  test('a rebuilt section enters the parts it draws; a classic one its cards', () => {
    expect(entranceSlots(find('money'))).toEqual(['window', 'budget', 'split', 'bidding', 'deadline']);
    // Since the Market area was rebuilt no section shows a classic card, so
    // the classic branch is held by a section of that shape.
    expect(entranceSlots({ slots: ['insights', 'trends'] })).toEqual(['insights', 'trends']);
  });

  test('every section that can be visited fresh has something to enter', () => {
    const fresh = SECTIONS.filter((s) => s.opensAt || s.key === 'money');
    for (const s of fresh) expect(entranceSlots(s).length, s.key).toBeGreaterThan(0);
  });

  test('the shell enters a rebuilt section\'s own parts, not only the classic cards', () => {
    const shell = read('ui/shell/shell.js');
    expect(shell).toMatch(/entranceSlots\(/);
    expect(shell).not.toMatch(/s\.slots\.map\(\(slot\) => `\[data-slot/);
  });
});

describe('a section is a filter over today\'s page', () => {
  const css = visibilityRules();

  test('each section hides every other section\'s cards', () => {
    for (const s of SECTIONS.filter((x) => x.slots.length > 0)) {
      expect(css).toContain(`:not([data-section="${s.key}"])`);
      for (const slot of s.slots) expect(css).toContain(`[data-slot="${slot}"]`);
    }
  });

  test('retired cards are hidden in every section', () => {
    for (const slot of RETIRED_SLOTS) {
      expect(css).toMatch(new RegExp(`\\.studio-cards :is\\([^)]*\\[data-slot="${slot}"\\]`));
    }
  });
});
