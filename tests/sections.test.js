import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AREAS, SECTIONS, RETIRED_SLOTS, sectionOf, sectionsIn, sectionState, visibilityRules, entranceSlots,
} from '../ui/shell/sections.js';
import { CHAPTERS } from '../ui/guide/chapters.js';
import { SETTLES_AFTER_ROUNDS } from '../ui/dashboard.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

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

  test('Results opens after the last week', () => {
    const results = find('results');
    expect(sectionState(results, { played: TOTAL_ROUNDS - 1, seen: {} }).locked).toBe(true);
    expect(sectionState(results, { played: TOTAL_ROUNDS, seen: {} }).locked).toBe(false);
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
    expect(entranceSlots(find('rivals'))).toEqual(['insights', 'trends']);
  });

  test('every section that can be visited fresh has something to enter', () => {
    const fresh = SECTIONS.filter((s) => s.opensAt || s.key === 'money');
    for (const s of fresh.filter((x) => x.key !== 'results')) {
      expect(entranceSlots(s).length, s.key).toBeGreaterThan(0);
    }
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
