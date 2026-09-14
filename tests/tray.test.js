import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { createDraft, changes, updateKeyword, removeKeyword, addNegative } from '../ui/decisions.js';
import { trayLines } from '../ui/shell/tray.js';

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
