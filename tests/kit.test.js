/**
 * The kit's pure parts (plans/2026-09-14-round-zero-redesign.md, section 8).
 * The drawing is checked by playing it; what can be decided without a page is
 * decided here.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliderMaxPaise, SLIDER_FLOOR_PAISE } from '../ui/kit/card.js';
import { plannerRows, PLANNER_ROWS } from '../ui/kit/planner.js';
import { QUERY_SET } from '../content/querySet.js';
import { studioRule, studioToken, rgb, contrast } from './fixtures/studioCss.js';

describe('a text box can be made out wherever it sits', () => {
  // Measured playing round 0's step 4 (2026-09-14): 1.65:1 against the page,
  // under the 3:1 a control's edge needs; the owner had it raised. The boxes
  // sit on the page (step 4's ad), a keyword card (a typed bid) and the
  // planner drawer (its search and bid).
  const outline = rgb(studioRule('.kfield', 'border'));
  test.each([
    ['the page', () => studioToken('--studio-page')],
    ['a card', () => studioToken('--studio-card')],
    ['the planner drawer', () => studioRule('.kplanner', 'background')],
  ])('against %s', (_, ground) => {
    expect(contrast(outline, rgb(ground()))).toBeGreaterThanOrEqual(3);
  });
});

describe('Adjust several\'s tick can be made out on any card', () => {
  // It has no words, so its outline is all that shows it is there: measured at
  // 1.52:1 on a card playing Your keywords, under the 3:1 a control needs.
  const outline = rgb(studioRule('.kcheck', 'border'));
  test.each([
    ['a card', () => studioToken('--studio-card')],
    ['a paused card', () => studioRule('.kcard.paused', 'background')],
  ])('on %s', (_, ground) => {
    expect(contrast(outline, rgb(ground()))).toBeGreaterThanOrEqual(3);
  });
});

describe('what the Studio marks hidden stays hidden', () => {
  // A class that sets `display` outranks the browser's own rule for `hidden`,
  // so the tray showed "0 changes waiting" beside "No changes yet", and Adjust
  // several's bar sat on top of the tray's lines (found playing Your keywords).
  test('over any display a class gives it', () => {
    const css = readFileSync(new URL('../ui/studio.css', import.meta.url), 'utf8');
    expect(css).toMatch(/body\.studio \[hidden\] \{ display: none !important; \}/);
  });
});

describe('the slider\'s range, fixed while the page is up', () => {
  test('never shorter than the floor', () => {
    expect(sliderMaxPaise([])).toBe(SLIDER_FLOOR_PAISE);
    expect(sliderMaxPaise([{ bidPaise: 3300 }, { bidPaise: 5700 }])).toBe(SLIDER_FLOOR_PAISE);
  });

  test('half again the highest bid, up to the next ten rupees', () => {
    expect(sliderMaxPaise([{ bidPaise: 9000 }])).toBe(14000);
    expect(sliderMaxPaise([{ bidPaise: 9001 }])).toBe(14000);
    expect(sliderMaxPaise([{ bidPaise: 10000 }])).toBe(15000);
  });
});

describe('the planner\'s rows', () => {
  const rows = (over = {}) => plannerRows({ queries: QUERY_SET.queries, weeklyVolume: QUERY_SET.weeklyVolume, ...over });

  test('biggest first, as Keyword Planner gives them, and no more than a screenful', () => {
    const { rows: list } = rows();
    expect(list).toHaveLength(PLANNER_ROWS);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].weekly).toBeGreaterThanOrEqual(list[i].weekly);
  });

  test('what is typed filters, and the biggest matches come first', () => {
    const { rows: list } = rows({ term: 'leggings' });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.text.includes('leggings'))).toBe(true);
  });

  test('a search already held is marked, and left out of "add all"', () => {
    const first = rows().rows[0].text;
    const out = rows({ held: new Set([first]) });
    expect(out.rows[0]).toMatchObject({ text: first, held: true });
    expect(out.addable).not.toContain(first);
  });

  test('your own words are offered only when the planner does not hold them', () => {
    expect(rows({ term: 'zzqx plumbing' }).own).toBe('zzqx plumbing');
    expect(rows({ term: QUERY_SET.queries[0].text }).own).toBeNull();
    expect(rows({ term: 'zzqx plumbing', held: new Set(['zzqx plumbing']) }).own).toBeNull();
  });

  test('Keyword Planner\'s columns, and nothing else', () => {
    expect(Object.keys(rows().rows[0]).sort()).toEqual(['held', 'intent', 'text', 'weekly']);
  });
});
