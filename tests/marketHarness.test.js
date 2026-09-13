import { describe, test, expect } from 'vitest';
import { harnessPlayer, playMarket, PLAYER } from '../scripts/market-harness.js';
import { MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, CREATIVE_ALLOCATION_PAISE } from '../engine/constants.js';
import { writerTier } from '../content/writers.js';

/**
 * The market harness measures the market before and after a change (C8), so
 * its player has to be a real one. Three throwaway harnesses before it were
 * not: the round-0 capital was handed over in a shape that lost it, and the
 * week-5 capital decision the form always sends was never sent.
 */
describe('the market harness plays a real player (DECISIONS C8)', { timeout: 60_000 }, () => {
  const agencyLeftover = CREATIVE_ALLOCATION_PAISE - writerTier('agency').pricePaise;

  test('F15\'s player: six searches of its cell, its brand, the agency writer', () => {
    const player = harnessPlayer('mid|lifestyle');
    expect(player.keywords).toHaveLength(7);
    expect(player.keywords.filter((k) => k.matchType === 'phrase')).toHaveLength(6);
    expect(player.writerTier).toBe('agency');
    expect(player.capex).toEqual({});
  });

  test('its round-0 money arrives in month 1, and its week-5 money in month 2', async () => {
    const { state } = await playMarket({ seed: 1, cell: 'value|performance', rounds: 5 });
    const budget = (round) => state.history.find((h) => h.round === round).byAdvertiser[PLAYER].budget.monthlyBudgetPaise;
    expect(budget(1)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE + agencyLeftover);
    expect(budget(5)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
    expect(state.advertisers.filter((a) => a.policyId)).toHaveLength(state.advertisers.length - 1);
  });
});
