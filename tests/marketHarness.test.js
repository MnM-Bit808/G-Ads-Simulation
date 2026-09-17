import { describe, test, expect } from 'vitest';
import {
  harnessPlayer, playMarket, writerGates, PLAYER, CELLS, prepaidDecision, RUNGS,
  movesFrom, moveDecision, ROUND0_PAGES, pageGates,
} from '../scripts/market-harness.js';
import { composeDescription } from '../content/landingPage.js';
import { gradeAdOffline, validateAdCopy } from '../agents/grader.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import {
  MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, CREATIVE_ALLOCATION_PAISE, REPOSITION_COST_PAISE,
} from '../engine/constants.js';
import { isOneStep, parseCell } from '../engine/positions.js';
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

  test('the prepaid mode offers its rung from week 1 and still sends week 5\'s capital (I34, C8)', async () => {
    // A decision that dropped the capital would lose the second ₹1,20,000 and
    // measure a poorer player than any real one, which is C8 again.
    expect(RUNGS[0]).toBe(0);
    const { state } = await playMarket({
      seed: 1, cell: 'value|performance', rounds: 5, playerDecision: prepaidDecision(3000),
    });
    expect(state.advertisers.find((a) => a.id === PLAYER).campaign.prepaidDiscountPaise).toBe(3000);
    const budget = (round) => state.history.find((h) => h.round === round).byAdvertiser[PLAYER].budget.monthlyBudgetPaise;
    expect(budget(5)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });

  test('the move mode goes everywhere spec 4.5 allows, and nowhere else', () => {
    for (const cell of CELLS) {
      for (const to of movesFrom(cell)) expect(isOneStep(parseCell(cell), parseCell(to)), `${cell} to ${to}`).toBe(true);
    }
    // Two or three from every cell: one purpose step, and a price step either way
    // that the grid has room for.
    expect(CELLS.flatMap(movesFrom)).toHaveLength(14);
  });

  test('the move mode moves at week 5 and still sends week 5\'s capital (4.5, C8)', async () => {
    const { state } = await playMarket({
      seed: 1, cell: 'value|performance', rounds: 5,
      playerDecision: moveDecision({ price: 'mid', purpose: 'performance' }),
    });
    expect(state.advertisers.find((a) => a.id === PLAYER).position)
      .toMatchObject({ price: 'mid', purpose: 'performance', repositionedAtRound: 5 });
    const budget = (round) => state.history.find((h) => h.round === round).byAdvertiser[PLAYER].budget.monthlyBudgetPaise;
    expect(budget(5)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE - REPOSITION_COST_PAISE);
  });
});

describe('the self-writing player, and the gates it is judged by (round 0 redesign)', () => {
  test('the same player, writing its own ad', () => {
    const own = harnessPlayer('mid|lifestyle', 'diy');
    expect(own.writerTier).toBe('diy');
    expect(own.keywords).toEqual(harnessPlayer('mid|lifestyle').keywords);
  });

  test('it writes as a careful player would, for its own square: both copy grades 8 or more', () => {
    // Agreed with the owner before the first run: a careful writer echoes its own
    // keywords, and the gates exist to catch the rule being too generous, which
    // is where a strong writer is.
    const rivalNames = BRAND_IDENTITIES.filter((b) => b.id !== PLAYER).map((b) => b.name);
    for (const cell of CELLS) {
      const { ad, keywords } = harnessPlayer(cell, 'diy');
      expect(validateAdCopy(ad).valid, cell).toBe(true);
      const grade = gradeAdOffline(ad, { keywords, rivalNames }, 0);
      expect(grade.expectedCtr, cell).toBeGreaterThanOrEqual(8);
      expect(grade.adRelevance, cell).toBeGreaterThanOrEqual(8);
    }
  });

  test('and describes the same page as the hiring player, so only the writing differs', () => {
    for (const cell of CELLS) {
      expect(harnessPlayer(cell, 'diy').ad.landingPageDescription)
        .toBe(harnessPlayer(cell).ad.landingPageDescription);
    }
  });

  const row = (seed, ownRank, ownNet, hiredNet, rivalNet) => ({
    seed, cell: 'mid|lifestyle',
    own: { rank: ownRank, net: ownNet, rivals: { a: rivalNet, b: rivalNet } },
    hired: { rank: 4, net: hiredNet, rivals: { a: 100, b: 100 } },
  });

  test('a self-writer that climbs one place, a hire that does not move, rivals within 5%: pass', () => {
    const before = [row(1, 5, 10, 50, 100), row(2, 5, 10, 50, 100)];
    const after = [row(1, 4, 20, 50, 96), row(2, 4, 20, 50, 96)];
    expect(writerGates(before, after).ok).toBe(true);
  });

  test('a climb of more than one place fails', () => {
    const before = [row(1, 6, 10, 50, 100)];
    const after = [row(1, 4, 20, 50, 100)];
    expect(writerGates(before, after).rank.ok).toBe(false);
  });

  test('any change at all to the hiring player fails', () => {
    const before = [row(1, 5, 10, 50, 100)];
    const after = [row(1, 5, 10, 51, 100)];
    expect(writerGates(before, after).hiredUnmoved).toBe(false);
  });

  test('a rival whose median profit falls by more than 5% fails, and is named', () => {
    const before = [row(1, 5, 10, 50, 100)];
    const after = [row(1, 5, 10, 50, 94)];
    const out = writerGates(before, after);
    expect(out.ok).toBe(false);
    expect(out.rivals.filter((r) => !r.ok).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

/**
 * GRADING THE PAGE AS IT STANDS (the owner, 2026-09-17). Round 0 writes the
 * player's page description from its capital, and the grader scores that
 * description. The harness player used to type "A plain product page." and buy
 * nothing at round 0, so no mode could see the page at all: before and after
 * would have matched and every gate passed on nothing. It now writes its page
 * the way round 0 does, and `page` plays whole games with round-0 capital.
 */
describe('the harness player\'s page, and the page gates', { timeout: 60_000 }, () => {
  test('its page is written from its round-0 capital, as round 0 writes it', () => {
    for (const cell of CELLS) {
      expect(harnessPlayer(cell).ad.landingPageDescription, cell).toBe('A plain product page.');
      expect(harnessPlayer(cell, 'diy').ad.landingPageDescription, cell).toBe('A plain product page.');
    }
    const guide = harnessPlayer('mid|performance', 'agency', { sizeGuide: 2500000 });
    expect(guide.capex).toEqual({ sizeGuide: 2500000 });
    expect(guide.ad.landingPageDescription).toBe(composeDescription({ sizeGuide: 2500000 }));
  });

  test('the page mode buys each page at round 0 and still sends week 5\'s capital (C8)', async () => {
    expect(Object.keys(ROUND0_PAGES)).toEqual(['keep', 'guide', 'reviews', 'topPage', 'photography']);
    expect(ROUND0_PAGES.keep).toEqual({});
    const { state } = await playMarket({ seed: 1, cell: 'value|performance', rounds: 5, capex: ROUND0_PAGES.reviews });
    const me = state.advertisers.find((a) => a.id === PLAYER);
    expect(me.capex.committed.landingPage).toBe(ROUND0_PAGES.reviews.landingPage);
    expect(me.adGroups[0].ad.landingPageDescription).toBe(composeDescription(ROUND0_PAGES.reviews));
    const budget = (round) => state.history.find((h) => h.round === round).byAdvertiser[PLAYER].budget.monthlyBudgetPaise;
    expect(budget(5)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });

  // Rows in the shape the three modes write, small enough to reason about.
  const rivals = (x) => ({ a: 1000 * x, b: 1000 * x });
  const market = (seed, net) => ({ seed, cell: 'mid|lifestyle', net, rank: 4 });
  const capital = (seed, { keep = 100, photography = 150, sizeGuide = 130, landingPage = 140, orderConfirmation = 110, r = 1 } = {}) => ({
    seed, cell: 'mid|lifestyle', keep, photography, sizeGuide, landingPage, orderConfirmation,
    rivals: Object.fromEntries(['keep', 'photography', 'sizeGuide', 'landingPage', 'orderConfirmation'].map((k) => [k, rivals(r)])),
  });
  const page = (seed, { keep = 100, guide = 120, reviews = 140, topPage = 150, photography = 130, r = 1 } = {}) => ({
    seed, cell: 'mid|lifestyle',
    ...Object.fromEntries(Object.entries({ keep, guide, reviews, topPage, photography }).map(([k, net]) => [k, { net, rivals: rivals(r) }])),
  });
  const runs = (over = {}) => ({
    market: { before: [market(1, 10)], after: [market(1, 10)] },
    capital: { before: [capital(1)], after: [capital(1, { sizeGuide: 135 })] },
    page: { before: [page(1)], after: [page(1, { reviews: 130 })] },
    ...over,
  });

  test('an honest change passes: nothing else moves, week-5 pages gain, round-0 pages lose a little', () => {
    const out = pageGates(runs());
    expect(out.hardOk).toBe(true);
    expect(out.stopOk).toBe(true);
  });

  test('G1: any difference at all in a market that buys no page fails, and names it', () => {
    const out = pageGates(runs({ market: { before: [market(1, 10)], after: [market(1, 11)] } }));
    expect(out.market.ok).toBe(false);
    expect(out.market.differ).toEqual(['1|mid|lifestyle']);
    expect(out.hardOk).toBe(false);
  });

  test('G2: keeping the money, or confirming orders, must not move at week 5', () => {
    const out = pageGates(runs({ capital: { before: [capital(1)], after: [capital(1, { orderConfirmation: 111 })] } }));
    expect(out.capitalFixed.ok).toBe(false);
    expect(out.hardOk).toBe(false);
  });

  test('G6: a week-5 page purchase whose median advantage falls stops the change', () => {
    const out = pageGates(runs({ capital: { before: [capital(1)], after: [capital(1, { photography: 149 })] } }));
    expect(out.capitalGain.find((g) => g.target === 'photography').ok).toBe(false);
    expect(out.stopOk).toBe(false);
    expect(out.hardOk).toBe(true);
  });

  test('G7: a round-0 page that stops beating keep, or loses over a quarter of its advantage, stops the change', () => {
    const flipped = pageGates(runs({ page: { before: [page(1)], after: [page(1, { guide: 99 })] } }));
    expect(flipped.page.find((p) => p.name === 'guide')).toMatchObject({ flipped: true, ok: false });
    // reviews: advantage 40 before, 29 after: 27.5% lost.
    const shrunk = pageGates(runs({ page: { before: [page(1)], after: [page(1, { reviews: 129 })] } }));
    expect(shrunk.page.find((p) => p.name === 'reviews')).toMatchObject({ flipped: false, ok: false });
    expect(shrunk.stopOk).toBe(false);
  });

  test('G8: a rival whose median profit moves more than 5% either way, in either mode, stops the change and is named', () => {
    const out = pageGates(runs({ page: { before: [page(1)], after: [page(1, { r: 1.06 })] } }));
    const moved = out.rivals.filter((r) => !r.ok);
    expect(moved.map((r) => `${r.mode}:${r.variant}:${r.id}`)).toContain('page:reviews:a');
    expect(moved.every((r) => r.mode === 'page')).toBe(true);
    expect(out.stopOk).toBe(false);
  });
});
