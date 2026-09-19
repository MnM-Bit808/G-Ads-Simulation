import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AREAS, SECTIONS, sectionOf, sectionsIn, sectionState, entranceSlots, slotOpen,
  areaEntry,
} from '../ui/shell/sections.js';
import { CHAPTERS, GOING_DEEPER } from '../ui/guide/chapters.js';
import { SETTLES_AFTER_ROUNDS } from '../ui/dashboard.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

// Where each Studio section sets the slots its parts carry.
const DRAWN_BY = {
  week: 'ui/week/render.js', keywords: 'ui/keywords/render.js', typed: 'ui/typed/render.js',
  ad: 'ui/ad/render.js', money: 'ui/money/render.js', where: 'ui/where/render.js',
  returns: 'ui/returns/render.js', rivals: 'ui/rivals/render.js', twelve: 'ui/results/render.js',
  learned: 'ui/results/render.js', reveal: 'ui/results/render.js', books: 'ui/results/render.js',
  playtest: 'ui/results/render.js',
};

// Every slot the Studio's sections say they draw. Until the switch-over's part
// 2 this read the classic page's cards out of ui/index.html and checked each had
// one home; the page has no cards now, so the guarantee that survives is the
// one that matters: a section's own module really sets what the section claims.
const DRAWN_SLOTS = [...new Set(SECTIONS.flatMap((s) => s.draws ?? []))];

describe('every part a section claims is a part its module draws', () => {
  test('the sections between them draw every slot once', () => {
    const all = SECTIONS.flatMap((s) => s.draws ?? []);
    expect(all.length).toBe(DRAWN_SLOTS.length);
    expect(DRAWN_SLOTS.length).toBeGreaterThan(18);
  });

  test.each(DRAWN_SLOTS)('%s is set by the module that draws it', (slot) => {
    const section = SECTIONS.find((s) => s.draws?.includes(slot));
    expect(read(DRAWN_BY[section.key]), `${section.key} draws ${slot}`).toContain(`'${slot}'`);
  });

  test('Your keywords draws its own card, so the guide can still open it', () => {
    expect(sectionOf('keywords').key).toBe('keywords');
  });

  test('Where and when draws its own bars, so the guide can still open both', () => {
    for (const slot of ['places', 'hours']) {
      expect(sectionOf(slot).key, slot).toBe('where');
    }
  });

  test('What people typed draws its own list and Block words, so the guide can still open both', () => {
    for (const slot of ['terms', 'negatives']) {
      expect(sectionOf(slot).key, slot).toBe('typed');
    }
  });

  test('Your money draws its own capital, month, bidding and week 8, so the guide can still open all five', () => {
    for (const slot of ['window', 'budget', 'split', 'bidding', 'deadline']) {
      expect(sectionOf(slot).key, slot).toBe('money');
    }
  });

  test('the Market area is one section, Rivals, drawing the market\'s figures and the rival cards', () => {
    expect(sectionsIn('market').map((s) => s.key)).toEqual(['rivals']);
    // The rival cards keep the classic Auction insights' slot.
    expect(sectionOf('insights').key).toBe('rivals');
    expect(sectionOf('market').key).toBe('rivals');
  });

  test('Returns draws its own figures, weeks, discount and levers, so the guide can still open it', () => {
    for (const slot of ['returns', 'prepaid']) {
      expect(sectionOf(slot).key, slot).toBe('returns');
    }
    expect(entranceSlots(SECTIONS.find((s) => s.key === 'returns')))
      .toEqual(['returns-figures', 'returns', 'prepaid', 'returns-levers']);
  });

  test('Your week draws its own figures, chart and impressions, so the guide can still open all three', () => {
    for (const slot of ['headline', 'share', 'revised']) {
      expect(sectionOf(slot).key, slot).toBe('week');
    }
  });

  // CLAUDE.md's trap: "show me on the card" must land on something that exists.
  // A ground-floor chapter points at a round 0 STEP rather than a card — it is
  // opened before the account exists — so only the nuance chapters are held here.
  const deeper = GOING_DEEPER.map((id) => [id, CHAPTERS[id]]);
  test.each(deeper)('the guide\'s %s can open the section holding its card', (_, c) => {
    expect(sectionOf(c.yourAccount), c.yourAccount).not.toBeNull();
  });

  // Found drawing the Guide as a page (2026-09-15): three chapters pointed where
  // their idea is not shown. A chapter may name a part only the Studio draws
  // (`studioAccount`); the classic page keeps `yourAccount`.
  test.each(deeper)('in the Studio, the guide\'s %s lands on a part its section really draws', (_, c) => {
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

  // The switch-over, part 1: the shell no longer draws the classic page, so a
  // section with nothing of its own would draw nothing.
  test('every section is one the shell draws itself', () => {
    const shell = read('ui/shell/shell.js');
    for (const s of SECTIONS) {
      const drawn = s.area === 'results' || shell.includes(`s.key === '${s.key}'`)
        || (s.draws?.includes('keywords') && shell.includes("s.draws?.includes('keywords')"));
      expect(drawn, s.key).toBe(true);
    }
  });

  test('and the shell builds its own context rather than the classic page', () => {
    const shell = read('ui/shell/shell.js');
    expect(shell).toContain('studioContext(game');
    expect(shell).not.toContain('renderDashboard');
  });
});

// Found drawing the Guide as a page (2026-09-15): the rail's area buttons always
// opened an area's first section, so a player who left Where and when for the
// Guide came back to Your week.
describe('an area remembers where the player was', () => {
  test('its rail button opens the section last open there, or its first', () => {
    expect(areaEntry('brand', {})).toBe('week');
    expect(areaEntry('brand', { brand: 'where' })).toBe('where');
    expect(areaEntry('market', { brand: 'where' })).toBe('rivals');
  });

  test('and never a section from another area', () => {
    expect(areaEntry('brand', { brand: 'twelve' })).toBe('week');
  });

  test('the shell asks it on every rail button but the Guide\'s, which keeps its chapter', () => {
    const shell = read('ui/shell/shell.js');
    expect(shell).toContain('open(areaEntry(area.key, view.lastIn');
    expect(shell).toMatch(/view\.lastIn\[s\.area\] = key;/);
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

// The switch-over, part 1 (design/switch-over/, 2026-09-16): the questions were a
// card at the foot of Everyone's books, where a tester who read the first section
// and stopped never met them.
describe('the playtest questions are a Results section on the playtest link only', () => {
  test('Results has four sections, and a fifth, "Before you go", on the playtest link', () => {
    expect(sectionsIn('results').map((s) => s.key)).toEqual(['twelve', 'learned', 'reveal', 'books']);
    expect(sectionsIn('results', { playtest: true }).map((s) => s.key))
      .toEqual(['twelve', 'learned', 'reveal', 'books', 'playtest']);
  });

  test('it opens after the last week, as the rest of Results does', () => {
    expect(SECTIONS.find((s) => s.key === 'playtest').opensAt).toBe(TOTAL_ROUNDS);
  });

  test('the rail\'s Playtest opens it after the last week, rather than downloading past the questions', () => {
    expect(read('ui/shell/shell.js')).toContain("open('playtest')");
  });

  test('the rail\'s Results goes back to it on the playtest link', () => {
    expect(areaEntry('results', { results: 'playtest' }, { playtest: true })).toBe('playtest');
    expect(areaEntry('results', { results: 'playtest' })).toBe('twelve');
  });
});

// Found planning Returns: rebuilding Your money took its week-5 entrance away,
// because the shell looked for the section's cards among the classic ones only.
describe('a first visit enters the parts the section shows', () => {
  const find = (key) => SECTIONS.find((s) => s.key === key);

  test('a section enters the parts it draws', () => {
    expect(entranceSlots(find('money'))).toEqual(['window', 'budget', 'split', 'bidding', 'deadline']);
    // There was a second branch here, for a section that showed the classic
    // page's cards rather than drawing its own. The switch-over's part 2
    // deleted the page and with it `slots`, so there is one answer now.
    expect(entranceSlots({})).toEqual([]);
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

/**
 * THE GUIDE AREA LISTS TWENTY-THREE CHAPTERS IN THE SECTION RAIL, so its rows
 * carry titles, not short section names — "Capital: spending on the business,
 * not the ads" beside "Your week".
 */
describe('a row in the section list keeps the height its title needs', () => {
  const css = read('ui/studio.css');
  // A plain search rather than a built regex: the selectors are full of dots
  // and braces, and escaping them twice is how the first draft of this helper
  // silently matched any character where it meant a literal dot.
  const rule = (selector) => {
    const at = css.indexOf(`body.studio ${selector} {`);
    expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  /**
   * FOUND BY THE OWNER, 2026-09-19: "multiple overlapping texts". `.studio-list`
   * is a COLUMN FLEX CONTAINER, so once its rows did not fit — which twenty-three
   * chapters never will — flex shrank them, `min-height` stopped the shrink at
   * 42px, and every wrapped title printed over the row below it. Twenty of the
   * twenty-five rows overflowed.
   *
   * The list already scrolls. The rows have to refuse to shrink and let it.
   */
  test('it refuses to shrink, because the list scrolls instead', () => {
    expect(rule('.studio-item'), 'a row that shrinks squashes its own title')
      .toMatch(/flex-shrink:\s*0/);
  });

  /**
   * And the row a chapter title sits in grows. `.studio-item` is 42px for the
   * short names; a chapter overrides it, and both halves are needed — without
   * `flex-shrink: 0` the growth is taken straight back by the parent.
   */
  test('and a chapter row grows to fit, rather than clipping the title', () => {
    const chapter = rule('.studio-item.studio-chapter');
    expect(chapter).toMatch(/height:\s*auto/);
    expect(chapter).toMatch(/line-height:\s*1\.3/);
    expect(rule('.studio-list'), 'the list has to scroll if the rows will not shrink')
      .toMatch(/overflow-y:\s*auto/);
  });
});
