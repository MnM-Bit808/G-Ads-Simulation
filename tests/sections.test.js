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

/**
 * THE STUDIO HAS A SCALE, AND DRIFT IS HOW IT LOST THE LAST ONE (I48).
 *
 * The stylesheet carried 25 distinct font sizes. Seven were used once or
 * twice — 10.5, 12.5, 13.5, 17, 19, 22, 34 — and two of those seven were
 * added the same afternoon they were found, while fixing a different kind of
 * drift in Everyone's books. A size used once is not a decision.
 *
 * The same object told the same story: the big figure over a label was 24px
 * in Where and when, 26 in Rivals, 28 in Your week and Results, 30 in
 * Returns. One object, five sections, four sizes.
 *
 * Text, because this suite cannot render. It catches the return of the exact
 * values that were collapsed, not every future sin.
 */
describe('the Studio keeps one scale', () => {
  const css = read('ui/studio.css');

  test('the one-off sizes do not come back', () => {
    const gone = ['10.5px', '12.5px', '13.5px'];
    for (const size of gone) {
      expect(css.includes(`font-size: ${size}`), `${size} is back`).toBe(false);
    }
  });

  test('the big figure is one size, named once', () => {
    expect(css).toMatch(/--studio-figure:\s*\d+px/);
    // I48 held five per-section rules here. I49 replaced four of them with the
    // kit's one figure, so what is left to hold is the kit's — plus the two
    // that are still a section's own: Where and when's inline baseline figure,
    // and Results' ordinal, which is a figure with no strip around it.
    for (const sel of ['.kfig-value', '.ww-figure strong', '.rs-big']) {
      const rule = css.split('\n').find((l) => l.startsWith(`body.studio ${sel} {`));
      expect(rule, `${sel} has no rule`).toBeTruthy();
      expect(rule, `${sel} sets its own figure size`).toContain('var(--studio-figure)');
    }
  });

  test('a display heading has one line-height, and the page hero is the exception', () => {
    const heights = [...css.matchAll(/font: 800 ([^;]*?)\/(\d(?:\.\d+)?) var\(--studio-display\)/g)]
      .map((m) => ({ size: m[1], lh: m[2] }));
    // `/1` is a figure sitting on its own baseline. Of the rest, headings are
    // 1.1 — except the 48px page title, where a heading that size wants to be
    // tighter than a heading half of it. A named exception, not a stray.
    const rest = heights.filter((h) => h.lh !== '1');
    const hero = rest.filter((h) => h.size === '48px');
    expect(hero.map((h) => h.lh)).toEqual(['0.95']);
    expect([...new Set(rest.filter((h) => h.size !== '48px').map((h) => h.lh))]).toEqual(['1.1']);
  });

  test('a card is one padding, one gap, one edge, one corner', () => {
    for (const name of ['--studio-card-pad', '--studio-card-gap', '--studio-card-edge', '--studio-radius']) {
      expect(css, `${name} is not declared`).toContain(`${name}:`);
    }
    /**
     * Two cards are not section cards, and say so here rather than by
     * drifting: `.door-card` is the whole screen before a game exists, and
     * `.pt-card` is a 560px centred form. Both are standalone panels and are
     * deliberately more generous than a card carrying figures.
     */
    const PANELS = ['door-card', 'pt-card'];
    const rules = [...css.matchAll(/^body\.studio \.([a-z]+-card) \{([^}]*)\}/gm)]
      .filter(([, name]) => !PANELS.includes(name));
    expect(rules.length).toBeGreaterThan(5);
    for (const [, name, body] of rules) {
      expect(body, `.${name} sets its own padding`).toMatch(/padding: var\(--studio-card-pad(-tight)?\)/);
      expect(body, `.${name} sets its own corner`).toMatch(/border-radius: var\(--studio-radius\)/);
    }
  });
});

/**
 * THE FIGURE AND THE METER ARE COMPONENTS NOW (I49).
 *
 * Four sections built the same figure themselves and had already drifted to
 * four sizes of the same number (I48) and two label styles. Three built the
 * same thin meter at two heights. They call `ui/kit/` for both now.
 *
 * Text, because this suite cannot render — but a section reaching for its own
 * `-figure`/`-value` class again is exactly how the last set drifted.
 */
describe('the kit owns the figure and the meter', () => {
  const USERS = {
    'ui/week/render.js': 'Your week',
    'ui/returns/render.js': 'Returns',
    'ui/rivals/render.js': 'Rivals',
    'ui/results/render.js': 'Results',
  };

  test.each(Object.entries(USERS))('%s asks the kit for its figures', (path) => {
    expect(read(path)).toMatch(/from '\.\.\/kit\/figure\.js'/);
  });

  test('and none of them builds one of its own again', () => {
    const GONE = ['yw-stat', 'yw-big', 'yw-label', 'rs-stat', 'rv-figure', 'rv-value',
      'rv-big', 'wr-figure', 'wr-label', 'wr-value'];
    const css = read('ui/studio.css');
    for (const cls of GONE) {
      expect(css.includes(`body.studio .${cls} {`), `.${cls} is back in the stylesheet`).toBe(false);
      for (const path of Object.keys(USERS)) {
        expect(read(path).includes(`'${cls}'`), `${path} draws .${cls} again`).toBe(false);
      }
    }
  });

  test('the meter is one height, and the three that are not meters keep their own', () => {
    const css = read('ui/studio.css');
    expect(css).toMatch(/body\.studio \.kmeter \{[^}]*height: 6px/);
    // Each of these shares the word "track" and is a different object: two
    // stacked bars, a drag target, and the bid slider's rail.
    for (const cls of ['rs-track', 'ww-track', 'yad-track']) {
      expect(css.includes(`body.studio .${cls} {`), `.${cls} should keep its own rule`).toBe(true);
    }
    for (const cls of ['rv-track', 'wt-track', 'wm-track']) {
      expect(css.includes(`body.studio .${cls} {`), `.${cls} should be the kit's meter now`).toBe(false);
    }
  });
});

/**
 * THE TRAY WRAPS BEFORE IT PUSHES THE PAGE (I50, 2026-09-25).
 *
 * `.studio-tray` is a nowrap flex row, and a finished game puts two
 * `flex-shrink: 0` buttons in it: "Back to the menu" at 180px and "See your
 * results" at 198px, which want 420px with the gap and padding against a
 * 375px phone. Measured: the document scrolled to 467px on all four Results
 * sections. The last screen of a finished game is the one a playtester is
 * most likely to reach on a phone.
 *
 * The deadline tray already wrapped for exactly this reason. The fix is that
 * rule made general, and this holds both halves of it.
 */
describe('a phone never scrolls sideways because of the tray', () => {
  const css = read('ui/studio.css');
  const phone = css.match(/@media \(max-width: 560px\) \{[\s\S]*?\n\}/g) ?? [];
  const trayBlock = phone.find((b) => b.includes('.studio-tray'));

  test('there is a narrow rule for the tray at all', () => {
    expect(trayBlock, 'no phone rule for .studio-tray').toBeTruthy();
  });

  test('it lets the tray wrap and grow instead of overflowing', () => {
    expect(trayBlock).toMatch(/flex-wrap: wrap/);
    // A fixed 76px row cannot hold a second line.
    expect(trayBlock).toMatch(/height: auto/);
  });

  test('and lets the two buttons shrink, which is what actually overflowed', () => {
    expect(trayBlock, 'the buttons still refuse to shrink')
      .toMatch(/\.studio-exit, \.studio-run\)?[\s\S]{0,120}flex: 1 1 auto/);
  });
});

/**
 * WHAT A PHONE PLAYTHROUGH FOUND (I51, 2026-09-25).
 *
 * Played end to end at 375px on the live build: round 0's five steps, twelve
 * weeks, the week-5 capital decision, every section, the guide drawer and all
 * four Results sections. Two things it could not do well.
 *
 * The keyword planner's row gave its three fixed columns 226px and the gaps
 * another 30 out of 326, leaving the name 70px against the 95-134 its text
 * wants — so every keyword ellipsised to "cheap g...". Reading a keyword is
 * the whole of what that drawer is for.
 *
 * And several controls measured 13 to 21px tall against WCAG 2.5.8's 24x24
 * minimum, including the forty-eight cells of the Where they sat quiz.
 */
describe('a phone can reach and read everything', () => {
  const css = read('ui/studio.css');

  test('the planner gives a keyword its own line on a phone', () => {
    const block = (css.match(/@media \(max-width: 560px\) \{[\s\S]*?\n\}/g) ?? [])
      .find((b) => b.includes('.kplanner-row'));
    expect(block, 'no phone rule for the planner row').toBeTruthy();
    expect(block, 'the name does not take the row').toMatch(/\.kplanner-name[\s\S]{0,80}grid-column: 1 \/ -1/);
    // An ellipsis is what hid the words; on a phone it wraps instead.
    expect(block).toMatch(/\.kplanner-name strong \{ white-space: normal/);
  });

  test('the small controls carry a hit area of at least 24px', () => {
    const rule = css.match(/body\.studio :is\(button\.why,[^)]*\)::after \{[^}]*\}/);
    expect(rule, 'no grown hit area').toBeTruthy();
    expect(rule[0]).toMatch(/min-width: 24px/);
    expect(rule[0]).toMatch(/min-height: 24px/);
    // Every control the playthrough measured under 24px is in the list.
    for (const sel of ['button.why', '.wt-act', '.rs-next', '.ktoggle', '.guide-sources a']) {
      expect(rule[0], `${sel} is not covered`).toContain(sel);
    }
    /**
     * `.wm-line` MEETS THE SAME MINIMUM THE OTHER WAY, and must not be added
     * to the list above. It already draws its grip with `::after` — a 4px
     * seam — so the min-width/min-height there overrode it into a 24px block
     * with a halo: a cube where a seam belongs, which the owner found live.
     * A control that owns its `::after` widens itself instead.
     */
    expect(css, 'the budget seam is back in the pseudo-element rule')
      .not.toMatch(/:is\(button\.why[^)]*\.wm-line[^)]*\)::after/);
    expect(css, 'the budget seam no longer meets 24px on its own')
      .toMatch(/body\.studio \.wm-line \{[^}]*width: 24px/);
  });

  test('and the grown area is the pseudo-element, so no word moves', () => {
    // Padding on `why?` would re-space the figure above it on every screen.
    const rule = css.match(/body\.studio :is\(button\.why,[^)]*\)::after \{[^}]*\}/)[0];
    expect(rule).toMatch(/position: absolute/);
    expect(rule).not.toMatch(/padding/);
  });

  test('the quiz cells grow to a finger on a phone, and only there', () => {
    const block = (css.match(/@media \(max-width: 560px\) \{[\s\S]*?\n\}/g) ?? [])
      .find((b) => b.includes('.r0-mini-cell'));
    expect(block, 'the quiz cells do not grow on a phone').toBeTruthy();
    expect(block).toMatch(/\.r0-mini-cell \{ width: 34px; height: 26px; \}/);
    // The desktop rule is untouched: there they are a diagram, not a target.
    expect(css).toMatch(/body\.studio \.r0-mini-cell \{ width: 26px; height: 20px;/);
  });
});

/**
 * MOTION WITH A JOB (I52, 2026-09-25).
 *
 * The makeover capped the app at five to seven motions and kept a rejected
 * list with the test each candidate failed. Two of these were on it, so the
 * guards hold what was decided ABOUT them as much as the code.
 */
describe('the motions added after playing it', () => {
  const css = read('ui/studio.css');
  const shell = read('ui/shell/shell.js');

  test('a section settles on every visit, not only its first', () => {
    expect(shell, 'the shell still only arrives on a first visit').toMatch(/else settle\(shown\)/);
    expect(css).toMatch(/@keyframes studio-settle/);
    expect(css).toMatch(/body\.studio \.settling \{ animation: studio-settle 300ms/);
  });

  test('the revision tint runs WITH the play, not on every redraw', () => {
    // `.moved` is a standing fact about a week; `.was` is the play. Binding the
    // animation to `.moved` alone would replay it on every render.
    expect(css).toMatch(/body\.studio \.yw-chart\.was \.yw-col\.moved \{ animation: studio-moved/);
    expect(css).not.toMatch(/^body\.studio \.yw-col\.moved \{ animation:/m);
  });

  test('both have a reduced-motion answer', () => {
    const reduce = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? [];
    expect(reduce.some((b) => /\.settling \{ animation: none/.test(b))).toBe(true);
    expect(reduce.some((b) => /\.yw-col\.moved \{ animation: none/.test(b))).toBe(true);
  });

  test('the lit edge is a hairline, not a shadow or a gradient behind the content', () => {
    const rule = css.match(/body\.studio :is\(\.rs-card[^)]*\)::before \{[^}]*\}/);
    expect(rule, 'no lit edge').toBeTruthy();
    expect(rule[0]).toMatch(/height: 1px/);
    expect(rule[0]).toMatch(/linear-gradient\(90deg, transparent/);
    expect(rule[0], 'a card must not catch clicks on its edge').toMatch(/pointer-events: none/);
    expect(rule[0]).not.toMatch(/box-shadow/);
  });

  /**
   * THE ONE THAT WAS ASKED FOR AND NOT BUILT. Counting a figure up to its new
   * reading shows in-between numbers the engine never reported, and this
   * simulation is worth something only while every figure on screen is one it
   * actually produced. The rule is older than the request:
   * plans/2026-09-13-studio-makeover.md motion row 2, and
   * plans/2026-09-19-first-run-and-ground-floor.md.
   */
  test('no figure counts up to its value, anywhere', () => {
    for (const path of ['ui/week/render.js', 'ui/results/render.js', 'ui/money/render.js',
      'ui/kit/figure.js', 'ui/returns/render.js']) {
      const body = read(path);
      expect(body, `${path} animates a number`).not.toMatch(/requestAnimationFrame[\s\S]{0,200}textContent\s*=/);
    }
    // And the rule itself is still written down where the next person looks.
    expect(read('plans/2026-09-13-studio-makeover.md')).toMatch(/never a counting ticker/);
  });
});
