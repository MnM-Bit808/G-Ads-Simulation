import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { createDraft, changes, updateKeyword, removeKeyword, addNegative } from '../ui/decisions.js';
import { trayLines, capitalWindow } from '../ui/shell/tray.js';

const draft = () => createDraft(getSelfView(makeGameState(), PLAYER_ID));

describe('every change carries an id of its own', () => {
  test('no two rows share one', () => {
    const d = draft();
    const [a, b, c] = d.keywords;
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 500 });
    updateKeyword(d, a.id, { matchType: a.matchType === 'broad' ? 'phrase' : 'broad' });
    updateKeyword(d, b.id, { active: false });
    removeKeyword(d, c.id);
    addNegative(d, { text: 'free', matchType: 'broad' });
    const rows = changes(d);
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(typeof row.id, row.label).toBe('string');
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  test('a row keeps its id while its figures move', () => {
    const d = draft();
    const [a] = d.keywords;
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 500 });
    const first = changes(d)[0].id;
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 900 });
    expect(changes(d)[0].id).toBe(first);
  });
});

describe('the tray', () => {
  test('lines stay in the order their changes were first made', () => {
    const d = draft();
    const [a, b] = d.keywords;
    updateKeyword(d, b.id, { bidPaise: b.bidPaise + 100 });
    const first = trayLines(changes(d), []);
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 100 });
    const second = trayLines(changes(d), first.order);
    expect(second.lines.map((l) => l.id)).toEqual([`keyword-bid:${b.id}`, `keyword-bid:${a.id}`]);
  });

  test('a line whose figures change keeps its place and takes the new text', () => {
    const d = draft();
    const [a, b] = d.keywords;
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 100 });
    updateKeyword(d, b.id, { bidPaise: b.bidPaise + 100 });
    const before = trayLines(changes(d), []);
    updateKeyword(d, a.id, { bidPaise: a.bidPaise + 700 });
    const after = trayLines(changes(d), before.order);
    expect(after.order).toEqual(before.order);
    expect(after.lines[0].text).not.toBe(before.lines[0].text);
  });

  test('an undone change leaves, and the rest keep their order', () => {
    const d = draft();
    const [a, b, c] = d.keywords;
    for (const k of [a, b, c]) updateKeyword(d, k.id, { bidPaise: k.bidPaise + 100 });
    const before = trayLines(changes(d), []);
    before.lines[1].undo();
    const after = trayLines(changes(d), before.order);
    expect(after.lines.map((l) => l.id)).toEqual([before.lines[0].id, before.lines[2].id]);
  });

  test('a change with nothing to take back is listed without an undo', () => {
    const rows = [{ id: 'capital', kind: 'capital', label: 'Capital: nothing committed', detail: 'x', undo: null }];
    expect(trayLines(rows, []).lines[0].undo).toBeNull();
  });
});

describe('the week with a deadline in it asks before it is run past', () => {
  // FOUND BY PLAYING TWELVE WEEKS, 2026-09-19. `capexAllocationRounds` is
  // [1, 5] and `canReposition` is true at round 5 alone, so week 5 carries the
  // last ₹1,20,000 AND the only chance to move — and pressing "Run week N"
  // each time went straight past both. Results then said so at the end:
  // "You built nothing: both allocations went into your ad budget."
  const at = (over = {}) => capitalWindow({
    capexOpen: true, repositionOpen: true, decided: false, seenThisWeek: false, ...over,
  });

  test('an ordinary week has nothing open and never asks', () => {
    const shut = at({ capexOpen: false, repositionOpen: false });
    expect(shut).toEqual({ open: false, half: null, asks: false });
  });

  test('it names which halves are open, so the tray cannot claim one that is not', () => {
    expect(at().half).toBe('both');
    expect(at({ repositionOpen: false }).half).toBe('capital');
    expect(at({ capexOpen: false }).half).toBe('move');
  });

  // THE POINT IS A KNOWING SKIP, NOT A FORCED DECISION. Uncommitted capital
  // becoming ad budget is deliberate (13.3, so that not investing stays
  // viable), so the question is asked once and never again once the player has
  // either staged something or opened Your money in that week.
  test('it asks only when nothing is staged and Your money was never opened', () => {
    expect(at().asks, 'never looked, nothing staged').toBe(true);
    expect(at({ seenThisWeek: true }).asks, 'looked and chose to skip').toBe(false);
    expect(at({ decided: true }).asks, 'already staged something').toBe(false);
    expect(at({ decided: true, seenThisWeek: true }).asks).toBe(false);
  });

  test('a week with nothing open never asks, whatever else is true', () => {
    for (const decided of [true, false]) {
      for (const seenThisWeek of [true, false]) {
        expect(at({ capexOpen: false, repositionOpen: false, decided, seenThisWeek }).asks).toBe(false);
      }
    }
  });
});
