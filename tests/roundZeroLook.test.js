/**
 * Round 0 in the Studio, measured from its stylesheet: what the eye and the
 * finger need from a control, which a green render test cannot see.
 */
import { describe, test, expect } from 'vitest';
import { studioRule, studioToken, rgb, contrast } from './fixtures/studioCss.js';

const px = (value) => Number(value.match(/(\d+(?:\.\d+)?)px/)[1]);

describe('the guess grid under each rival ad (step 2)', () => {
  // Built at 18 by 12px with 3px between, and an outline of 2.1:1 against the
  // page; the owner had them raised (2026-09-14).
  const width = px(studioRule('.r0-mini-cell', 'width'));
  const height = px(studioRule('.r0-mini-cell', 'height'));
  const gap = px(studioRule('.r0-mini', 'gap'));

  test('a cell can be tapped without hitting its neighbour', () => {
    // WCAG 2.5.8: a target under 24px passes if a 24px circle on its centre
    // meets no other target, which holds when the centres are 24px apart.
    expect(width + gap, 'across').toBeGreaterThanOrEqual(24);
    expect(height + gap, 'down').toBeGreaterThanOrEqual(24);
  });

  test('the grid\'s columns and rows match the cells', () => {
    expect(studioRule('.r0-mini', 'grid-template-columns')).toBe(`repeat(3, ${width}px)`);
    expect(studioRule('.r0-mini', 'grid-template-rows')).toBe(`repeat(2, ${height}px)`);
  });

  test('an empty cell\'s outline can be made out against the page', () => {
    const outline = rgb(studioRule('.r0-mini-cell', 'border'));
    expect(contrast(outline, rgb(studioToken('--studio-page')))).toBeGreaterThanOrEqual(3);
  });
});

describe('the icon strip\'s greyed-out areas (Market and Results, all through round 0)', () => {
  // Measured in Task 15 at 2.18:1 against the strip; the owner had them raised
  // to about 3.5:1, and no further, so they still read as off beside the rest.
  const rail = rgb(studioToken('--studio-rail'));
  const off = contrast(rgb(studioRule('.studio-area:disabled', 'color')), rail);
  const on = contrast(rgb(studioRule('.studio-area', 'color')), rail);

  test('can be read', () => {
    expect(off).toBeGreaterThanOrEqual(3);
  });

  test('and still look off beside an area that works', () => {
    expect(on - off).toBeGreaterThanOrEqual(1.5);
  });
});

/**
 * STEP 1'S THREE KINDS OF BOX MUST NOT LOOK ALIKE (2026-09-25, section 7 of
 * plans/2026-09-24-density-and-polish.md).
 *
 * They did. `.r0-level` — a price tier's figures — and `.r0-where` — the whole
 * "Where the searches are" section — carried the SAME border, the SAME 20px
 * radius and the SAME fill, and `.r0-panel`, the break-even conclusion, used
 * that radius too while shouting in three ways at once: a red tint, a red
 * border and red-tinted text.
 *
 * Border, fill and shadow each say "this is a separate object". Spent
 * uniformly they say nothing, and on that screen the break-even sum — the
 * number the whole step exists to arrive at — read as no more important than a
 * tier's row count.
 *
 * WHAT IS HELD HERE IS THE DISTINCTION, NOT THE VALUES. Any of these may be
 * restyled; what may not happen is the three collapsing back into one
 * treatment, which is how it got here and would not be noticed again.
 */
describe('step 1 spends its emphasis by role', () => {
  const box = (selector) => ({
    border: studioRule(selector, 'border'),
    radius: studioRule(selector, 'border-radius'),
    background: studioRule(selector, 'background'),
  });
  const tier = box('.r0-level');
  const section = box('.r0-where');
  const conclusion = box('.r0-panel');

  test('a tier tile and the section around the map are not the same object', () => {
    expect(JSON.stringify(tier)).not.toBe(JSON.stringify(section));
  });

  test('the tiers read as one table: no border of their own', () => {
    // Three bordered tiles are three objects. The tiers are columns of one
    // thing, so the seam between them is a gap, not an outline.
    expect(tier.border ?? '0', 'a tier tile has no border').toMatch(/^(0|none)/);
  });

  test('the break-even panel makes ONE red signal, not three', () => {
    // It keeps the tint, because red is the player's own colour and the panel
    // is what a click is worth TO YOU. The border was the third shout.
    // `studioRule` resolves a token to its value, so compare against the value.
    expect(conclusion.background, 'the tint stays').toBe(studioToken('--studio-panel'));
    expect(conclusion.border ?? '0', 'the red border went').toMatch(/^(0|none)/);
    // And the tint is the ONLY red: the edge token it used is gone from it.
    expect(conclusion.border ?? '0').not.toContain(studioToken('--studio-panel-edge'));
  });

  test('and the sum is the largest thing in it, so weight comes from size', () => {
    const sum = Number(studioRule('.r0-panel .r0-sum', 'font').match(/(\d+)px/)[1]);
    const body = Number(studioRule('.r0-panel p', 'font-size').match(/(\d+)px/)[1]);
    expect(sum).toBeGreaterThanOrEqual(body * 1.8);
  });
});
