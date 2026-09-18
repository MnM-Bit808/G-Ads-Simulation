/**
 * What the Studio's Where and when shows, read from the draft without a page
 * (design/where-when/, chosen by the owner 2026-09-15: the day to scale, and
 * the map beside three bars).
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getSelfView } from '../engine/insights.js';
import {
  DAYPART_BLOCKS, LOCATION_TIERS, MAX_BID_MULTIPLE, MAX_CLICKS_AGGRESSION,
} from '../engine/constants.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { createDraft, daypartRows, locationRows, changes } from '../ui/decisions.js';
import {
  hourTop, PLACE_TOP, settle, hoursModel, placesModel, setHour, setPlace,
} from '../ui/where/read.js';

const draft = () => createDraft(getSelfView(makeGameState(), PLAYER_ID));

/** A week's report carrying only the per-place figures `locationRows` reads. */
const week = (clicks) => ({
  byAdvertiser: {
    [PLAYER_ID]: {
      breakdown: {
        byLocation: Object.fromEntries(clicks.map((n, tier) => [String(tier), {
          impressions: n * 12, clicks: n, costPaise: n * 1500, conversions: n / 25,
          grossRevenuePaise: n * 9000, returned: n / 100, returnedRevenuePaise: n * 900,
          refused: n / 250, sentBack: n / 150, codShare: 0.6 + tier / 10, eligibleAuctions: n * 20,
        }])),
      },
    },
  },
});

describe('how far a bar goes', () => {
  test('under manual bidding, to four times the keyword bid', () => {
    expect(hourTop('manual')).toBe((MAX_BID_MULTIPLE - 1) * 100);
  });

  test('under Maximise clicks, to four times less what the strategy already adds', () => {
    // It bids MAX_CLICKS_AGGRESSION times the keyword before any adjustment.
    const top = hourTop('maxClicks');
    expect(top % 5).toBe(0);
    expect(1 + top / 100).toBeLessThanOrEqual(MAX_BID_MULTIPLE / MAX_CLICKS_AGGRESSION);
    expect(1 + (top + 5) / 100).toBeGreaterThan(MAX_BID_MULTIPLE / MAX_CLICKS_AGGRESSION);
  });

  test('a place goes as far as an hour under manual bidding, since one cap covers both (G4)', () => {
    expect(PLACE_TOP).toBe(hourTop('manual'));
  });

  test('a drag or a key lands on a whole step, between off and the top', () => {
    expect(settle(33, 300)).toBe(35);
    expect(settle(-140, 300)).toBe(-100);
    expect(settle(420, 150)).toBe(150);
  });
});

describe('the hours', () => {
  test('one block per daypart block, each as wide as its hours, the day in all', () => {
    const model = hoursModel(draft());
    expect(model.blocks.map((b) => b.label)).toEqual(DAYPART_BLOCKS.map((b) => b.label));
    expect(model.blocks.reduce((sum, b) => sum + b.hours, 0)).toBe(24);
    expect(model.hourly).toHaveLength(24);
  });

  test('the figures are the ones today\'s card shows', () => {
    const d = draft();
    const rows = daypartRows(d);
    for (const [i, block] of hoursModel(d).blocks.entries()) {
      expect(block, block.label).toMatchObject({ clicks: rows[i].clicks, rate: rows[i].rate, thin: rows[i].thin });
    }
  });

  test('the strategies that set their own bid each hour say the top varies', () => {
    const d = draft();
    expect(hoursModel({ ...d, strategy: 'manual' }).varies).toBe(false);
    expect(hoursModel({ ...d, strategy: 'targetCpa', strategyParams: { targetCpaPaise: 50000 } }).varies).toBe(true);
  });

  /**
   * D11 is accepted "and told": under a strategy that predicts conversions the
   * player's hour adjustment lands on top of the strategy's own lean, so the
   * hour counts twice, and the game says so. The classic form said it on its
   * daypart card; the switch-over's part 2 deleted that card, so the section
   * that owns the hours says it now, or the ledger claims a disclosure the game
   * does not make.
   */
  test('an hour adjustment that counts twice says so, and only then (D11)', () => {
    const d = draft();
    expect(hoursModel({ ...d, strategy: 'manual' }).countsTwice).toBe(false);
    expect(hoursModel({ ...d, strategy: 'maxClicks' }).countsTwice).toBe(false);
    for (const strategy of ['targetCpa', 'targetRoas', 'maxConv']) {
      expect(hoursModel({ ...d, strategy, strategyParams: { targetCpaPaise: 50000, targetRoas: 4 } }).countsTwice,
        strategy).toBe(true);
    }
  });

  test('and the section draws that sentence, with its "why?"', () => {
    const render = readFileSync(fileURLToPath(new URL('../ui/where/render.js', import.meta.url)), 'utf8');
    expect(render).toMatch(/model\.countsTwice/);
    expect(render).toMatch(/WHERE\.hoursTwice/);
  });

  test('a setting saved above the top is shown at the top, and kept as it was', () => {
    const d = draft();
    d.daypartAdjustments = [500, 0, 0, 0, 0, 0];
    const [first] = hoursModel(d).blocks;
    expect(first).toMatchObject({ percent: 500, shown: hourTop(d.strategy), above: true });
    expect(d.daypartAdjustments[0]).toBe(500);
  });

  test('a change goes through the form, so the tray words it as today', () => {
    const d = draft();
    setHour(d, 3, 30);
    expect(d.daypartAdjustments[3]).toBe(30);
    expect(changes(d).map((c) => c.label)).toContain('Afternoon bid 0% → +30%');
  });
});

describe('the places', () => {
  const played = () => ({ d: draft(), history: [week([400, 600, 1000]), week([100, 300, 600])] });

  test('three rows with the figures today\'s table shows', () => {
    const { d, history } = played();
    const rows = locationRows(d, history, PLAYER_ID);
    const model = placesModel(d, history, PLAYER_ID);
    expect(model.rows.map((r) => r.id)).toEqual([...LOCATION_TIERS]);
    for (const [i, row] of model.rows.entries()) {
      expect(row, row.id).toMatchObject({
        clicks: rows[i].clicks, cpcPaise: rows[i].cpcPaise, keptPerClickPaise: rows[i].keptPerClickPaise,
        codShare: rows[i].codShare, refusedRate: rows[i].refusedRate, sentBackRate: rows[i].sentBackRate,
      });
    }
  });

  test('the map pulses with where this account\'s clicks came from', () => {
    const { d, history } = played();
    const { shares } = placesModel(d, history, PLAYER_ID);
    expect(shares).toEqual({ tier1: 500 / 3000, tier2: 900 / 3000, tier3: 1600 / 3000 });
  });

  test('before any clicks, no kind of place pulses', () => {
    expect(placesModel(draft(), [], PLAYER_ID).shares).toBeNull();
  });

  test('a change goes through the form, so the tray words it as today', () => {
    const d = draft();
    setPlace(d, 0, 50);
    expect(d.locationAdjustments[0]).toBe(50);
    expect(changes(d).map((c) => c.label)).toContain('Metros bid 0% → +50%');
  });
});
