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
