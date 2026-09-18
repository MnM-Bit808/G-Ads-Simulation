/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16). The door is DOM and is checked by playing; what it says about a
 * saved game is decided here.
 */
import { describe, test, expect } from 'vitest';
import { doorFacts, changedWeeks } from '../ui/door/read.js';

const report = (costPaise, clicks) => ({ byAdvertiser: { me: { traffic: { costPaise, clicks } } } });

describe('what the door says about a save', () => {
  const saved = (weeksPlayed) => ({
    playerId: 'me',
    weeksPlayed,
    initialState: {
      advertisers: [{ id: 'me', name: 'Vella & Co.', position: { price: 'mid', purpose: 'performance' } }],
    },
  });

  test('the brand, where it sits and how far it got', () => {
    expect(doorFacts(saved(6))).toEqual({
      name: 'Vella & Co.', position: 'mid · performance', played: 6, total: 12, finished: false,
    });
  });

  test('a save of every week is a finished game', () => {
    expect(doorFacts(saved(12)).finished).toBe(true);
  });
});

describe('a changed replay lists the weeks that changed', () => {
  test('as saved against replayed now, in whole rupees and clicks', () => {
    const out = changedWeeks([[5593900, 4284.2]], [report(7824700, 6536.4)], 'me');
    expect(out).toEqual({
      rows: [{ week: 1, thenPaise: 5593900, thenClicks: 4284, nowPaise: 7824700, nowClicks: 6536 }],
      more: 0,
    });
  });

  // Clicks are fractional and the save compares them exactly, so a replay can
  // differ where no figure on screen would (the review, 2026-09-16).
  test('a week that differs below what is shown is not listed', () => {
    const out = changedWeeks(
      [[5593900, 4284.2], [7825000, 3400]],
      [report(5593940, 4284.3), report(7824700, 3500)],
      'me',
    );
    expect(out.rows.map((r) => r.week)).toEqual([2]);
  });

  test('three weeks at most, and how many more', () => {
    const five = [1, 2, 3, 4, 5].map((w) => [w * 100000, w * 10]);
    const out = changedWeeks(five, five.map(([cost, clicks]) => report(cost + 50000, clicks + 5)), 'me');
    expect(out.rows.map((r) => r.week)).toEqual([1, 2, 3]);
    expect(out.more).toBe(2);
  });

  test('a game whose weeks all replay the same lists none', () => {
    const weeks = [[100000, 10], [200000, 20]];
    const out = changedWeeks(weeks, weeks.map(([cost, clicks]) => report(cost, clicks)), 'me');
    expect(out).toEqual({ rows: [], more: 0 });
  });
});
