import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { advertiserReport, reviseReports } from '../engine/report.js';
import {
  getPublicView, getSelfView, insightsFor,
  FORBIDDEN_IN_PUBLIC_VIEW, FORBIDDEN_IN_SELF_VIEW,
} from '../engine/insights.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import {
  LOCATION_TIERS, RTO_FREIGHT_PAISE, CAPEX_ALLOCATION_PAISE, CAPEX_TARGETS,
  CAPEX_TIER_CURVE, CAPEX_PHOTOGRAPHY_CURVE,
} from '../engine/constants.js';
import { codShareFor } from '../engine/locations.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { businessFor, realisedBreakEvenCpcPaise } from '../engine/positions.js';

const STATE = makeGameState();
const R1 = runRound(STATE, { mode: 'expected', counterfactualFor: ['halcyon'] });
const R2 = runRound(R1.nextGameState, { mode: 'expected' });
const mine = (result) => result.report.byAdvertiser[PLAYER_ID];

describe('the report has the shape spec 15 asks for', () => {
  test('one row per advertiser, and the round it covers', () => {
    expect(R1.report.round).toBe(STATE.round);
    expect(Object.keys(R1.report.byAdvertiser)).toHaveLength(STATE.advertisers.length);
  });

  test('every documented block is present', () => {
    const row = mine(R1);
    for (const block of ['traffic', 'share', 'positions', 'conversions', 'money',
      'budget', 'quality', 'warnings', 'breakdown']) {
      expect(row, block).toHaveProperty(block);
    }
    expect(row.breakdown).toHaveProperty('byKeyword');
    expect(row.breakdown).toHaveProperty('byQuery');
  });

  test('a report carries NO rows for rivals inside an advertiser slice', () => {
    // getPublicView is the only route to another advertiser's data (R3a).
    const slice = advertiserReport(R1.report, PLAYER_ID);
    expect(JSON.stringify(slice)).not.toContain('kestrel');
    expect(slice.round).toBe(STATE.round);
  });

  test('shares are fractions that decompose to one', () => {
    const s = mine(R1).share;
    expect(s.impressionShare + s.lostToRank + s.lostToBudget).toBeCloseTo(1, 9);
  });

  test('money is integer paise where it is money (R7)', () => {
    const m = mine(R1).money;
    for (const key of ['grossRevenuePaise', 'netRevenuePaise', 'returnedRevenuePaise',
      'grossProfitPaise', 'netProfitPaise']) {
      expect(Number.isSafeInteger(m[key]), key).toBe(true);
    }
  });

  test('cpa is null rather than Infinity when nothing converted', () => {
    const dry = runRound({ ...STATE, round: 1 }, { mode: 'expected' });
    for (const row of Object.values(dry.report.byAdvertiser)) {
      if (row.conversions.final === 0) expect(row.money.cpaPaise).toBeNull();
    }
  });
});

describe('gross and net diverge in the report', () => {
  test('net revenue is never above gross', () => {
    for (const [id, row] of Object.entries(R2.report.byAdvertiser)) {
      expect(row.money.netRevenuePaise, id).toBeLessThanOrEqual(row.money.grossRevenuePaise);
    }
  });

  test('net ROAS is never above gross ROAS', () => {
    for (const [id, row] of Object.entries(R2.report.byAdvertiser)) {
      expect(row.money.netRoas, id).toBeLessThanOrEqual(row.money.grossRoas);
    }
  });

  test('profit is margin on revenue minus what was spent', () => {
    const row = mine(R1);
    expect(row.money.grossProfitPaise)
      .toBeLessThan(row.money.grossRevenuePaise);
    expect(row.money.grossProfitPaise)
      .toBe(Math.round(row.money.grossRevenuePaise * 0.4) - row.traffic.costPaise);
  });
});

describe('the search terms report says what a query EARNED (spec 15.2)', () => {
  const row = R1.report.byAdvertiser[PLAYER_ID];

  test('every breakdown row carries conversions, not just cost', () => {
    // 15.2 specifies conversions on both rows and the engine recorded
    // impressions, clicks and costPaise only. byQuery IS the search terms
    // report and, since negatives are string-only (8.2), the ONLY tool for
    // writing them - so it could tell you what a query cost and never what it
    // earned. A policy reading it to find waste blocked its own best keywords,
    // because every row looked like a row with no conversions.
    for (const [id, r] of Object.entries(row.breakdown.byQuery)) {
      expect(r, id).toHaveProperty('conversions');
      expect(Number.isFinite(r.conversions), id).toBe(true);
    }
    for (const [id, r] of Object.entries(row.breakdown.byKeyword)) {
      expect(r, id).toHaveProperty('conversions');
      expect(Number.isFinite(r.conversions), id).toBe(true);
    }
  });

  test('and at least one query actually shows some', () => {
    // Guards the shape test above from passing on a column of zeroes.
    const total = Object.values(row.breakdown.byQuery)
      .reduce((a, r) => a + r.conversions, 0);
    expect(total).toBeGreaterThan(0);
  });

  test('they reconcile with the round total', () => {
    const byQuery = Object.values(row.breakdown.byQuery)
      .reduce((a, r) => a + r.conversions, 0);
    const byKeyword = Object.values(row.breakdown.byKeyword)
      .reduce((a, r) => a + r.conversions, 0);
    expect(byQuery).toBeCloseTo(row.conversions.final, 6);
    expect(byKeyword).toBeCloseTo(row.conversions.final, 6);
  });

  test('the column carries information the cost column does not', () => {
    // The whole point of adding it. If conversions were just a rescaling of
    // clicks, the search terms report would rank queries the same way with or
    // without it and negatives could be written from cost alone. They cannot:
    // a query's worth depends on its intent and its affinity for this
    // position, neither of which is visible in what it charged.
    const rows = Object.entries(R1.report.byAdvertiser['kestrel'].breakdown.byQuery)
      .filter(([, r]) => r.clicks > 0);
    expect(rows.length).toBeGreaterThan(5);

    const byCost = [...rows].sort((a, b) => b[1].costPaise - a[1].costPaise).map(([id]) => id);
    const byValue = [...rows].sort((a, b) => b[1].conversions - a[1].conversions).map(([id]) => id);
    expect(byValue).not.toEqual(byCost);

    // And the per-click yield genuinely varies, which is what a policy reads.
    const yields = rows.map(([, r]) => r.conversions / r.clicks);
    expect(Math.max(...yields) / Math.min(...yields)).toBeGreaterThan(1.5);
  });

  test('and late conversions are revised into the query that earned them', () => {
    const first = R1.report.byAdvertiser[PLAYER_ID].breakdown.byQuery;
    const revised = R2.nextGameState.history.find((h) => h.round === 1)
      .byAdvertiser[PLAYER_ID].breakdown.byQuery;
    const before = Object.values(first).reduce((a, r) => a + r.conversions, 0);
    const after = Object.values(revised).reduce((a, r) => a + r.conversions, 0);
    expect(after).toBeGreaterThan(before);
  });
});

describe('reports are revised, and remember what they first said (spec 11.4)', () => {
  test('round 1 is rewritten once round 2 lands its late conversions', () => {
    const first = R1.report.byAdvertiser[PLAYER_ID];
    const revised = R2.nextGameState.history.find((h) => h.round === 1)
      .byAdvertiser[PLAYER_ID];

    expect(first.conversions.final).toBeGreaterThan(0);
    expect(revised.conversions.final).toBeGreaterThan(first.conversions.final);
  });

  test('the revised round is stamped with when it changed', () => {
    const revised = R2.nextGameState.history.find((h) => h.round === 1);
    expect(revised.revisedAtRound).toBe(2);
    expect(R1.report.revisedAtRound).toBeNull();
  });

  test('the AsFirstReported twins survive the revision', () => {
    // What you thought you were looking at last week, beside what turned out
    // to be true. Numbers changing after you read them is one of the most
    // disorienting things about a real account.
    const first = R1.report.byAdvertiser[PLAYER_ID];
    const revised = R2.nextGameState.history.find((h) => h.round === 1)
      .byAdvertiser[PLAYER_ID];

    expect(revised.money.grossRoasAsFirstReported)
      .toBeCloseTo(first.money.grossRoas, 12);
    expect(revised.conversions.asFirstReported).toBe(first.conversions.asFirstReported);
    expect(revised.money.grossRoas).toBeGreaterThan(revised.money.grossRoasAsFirstReported);
  });

  test('the cost never moves: only what the clicks later earned', () => {
    const first = R1.report.byAdvertiser[PLAYER_ID];
    const revised = R2.nextGameState.history.find((h) => h.round === 1)
      .byAdvertiser[PLAYER_ID];
    expect(revised.traffic.costPaise).toBe(first.traffic.costPaise);
  });

  test('stillPending falls as the backlog arrives', () => {
    const first = R1.report.byAdvertiser[PLAYER_ID];
    const revised = R2.nextGameState.history.find((h) => h.round === 1)
      .byAdvertiser[PLAYER_ID];
    expect(revised.conversions.stillPending).toBeLessThan(first.conversions.stillPending);
  });

  test('stillPending is this round\'s own clicks, not the whole queue', () => {
    // Every other figure in an AdvertiserRoundReport is about this round's
    // cohort. This one summed the advertiser's entire pending queue, so a
    // round carried other rounds' backlog, the revision below could never
    // clear it, and summing the field across a game triple-counted it.
    let state = makeGameState();
    for (let i = 0; i < 6; i++) state = runRound(state, { mode: 'expected' }).nextGameState;

    const queue = state.advertisers.find((a) => a.id === PLAYER_ID).pendingConversions;
    for (const stored of state.history) {
      const owed = queue
        .filter((e) => e.clickedInRound === stored.round)
        .reduce((a, e) => a + e.count, 0);
      expect(stored.byAdvertiser[PLAYER_ID].conversions.stillPending, `round ${stored.round}`)
        .toBeCloseTo(owed, 6);
    }
  });

  test('and it reaches exactly zero once a round has fully landed', () => {
    let state = makeGameState();
    for (let i = 0; i < 6; i++) state = runRound(state, { mode: 'expected' }).nextGameState;
    // Lag runs to three rounds, so round 1 is long settled by round 6. Close
    // to zero rather than equal to it: the figure decays by SUBTRACTING each
    // late landing from a fractional total, so it lands on float residue
    // (7.1e-15 here) rather than on nothing. Anything reading this as "has it
    // settled" needs a tolerance, and ui/ending.js uses one.
    expect(state.history[0].byAdvertiser[PLAYER_ID].conversions.stillPending)
      .toBeCloseTo(0, 9);
  });

  test('the report stored in history is the report that was returned', () => {
    // The reviser must never see the round it is currently building. It used
    // to: runRound appended the fresh report and then revised the whole array,
    // so the round's own lag-0 conversions - 55% of the distribution - landed
    // twice, once when the report was built and once when the reviser walked
    // over it. Round 1 stored 131.33 conversions where runRound returned 65.66.
    //
    // Every other test in this block compares R1.report against history, so the
    // defect lived exactly in the gap between those two objects and none of
    // them could see it. This is the assertion that closes the gap.
    const stored = R1.nextGameState.history.find((h) => h.round === 1);
    expect(stored).toEqual(R1.report);
  });

  test('a report is never revised in the round that created it', () => {
    // The general form of the above: conversions from THIS round's clicks are
    // already in this round's report. Only earlier rounds have late arrivals.
    for (const result of [R1, R2]) {
      const own = result.nextGameState.history.find((h) => h.round === result.round);
      expect(own.revisedAtRound, `round ${result.round}`).toBeNull();
    }
  });

  test('a round with nothing late is left untouched', () => {
    const untouched = reviseReports([R1.report], {
      currentRound: 9, raw: { byAdvertiser: {} }, advertisers: STATE.advertisers,
    });
    expect(untouched[0]).toBe(R1.report);
  });

  test('history grows by one report per round', () => {
    expect(R1.nextGameState.history).toHaveLength(1);
    expect(R2.nextGameState.history).toHaveLength(2);
  });
});

/**
 * A move at week 5 and the weeks sold before it.
 *
 * Spec 11.3 snapshots each order's value and return rate at click time "so a
 * repositioning (4.5) cannot retroactively change an order that was already
 * sold". The margin laid over those orders was never snapshotted: a revision
 * took it from the advertiser as it stood in the revising week. So a move from
 * mid to premium lifted week 1's gross profit from ₹15,410 to ₹20,791 with not
 * one order changed, and every week of month 1 with it, because each is revised
 * at least once after week 5 while its returns come back.
 *
 * Three games, the same to the end of week 4: one stays, one moves up, one moves
 * down. Nine weeks, so week 4's last return has resolved. The money block is
 * compared whole, because nothing in it may know about a move that came after.
 */
describe('a later price move does not re-price the weeks already sold (spec 11.3)', { timeout: 120_000 }, () => {
  const POSITION = { price: 'mid', purpose: 'performance' };
  const SEARCH = QUERY_SET.queries
    .filter((q) => homeCell(q) === 'mid|performance' && q.returnRateMultiplier === 1 && q.intent !== 'brand')
    .sort((a, b) => b.volumeShareBp - a.volumeShareBp)[0];
  const games = new Map();
  const played = (movePrice) => {
    if (games.has(movePrice)) return games.get(movePrice);
    const breakEven = realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    );
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        capex: { orderConfirmation: 8000000 },
        keywords: [{ text: SEARCH.text, matchType: 'exact', bidPaise: Math.round(breakEven * 1.2) }],
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const id = state.advertisers[0].id;
    for (let week = 1; week <= 9; week++) {
      const decisions = week === 5 && movePrice
        ? { [id]: { position: { price: movePrice, purpose: POSITION.purpose } } } : {};
      state = submitRound(state, decisions, { mode: 'expected' }).nextGameState;
    }
    const game = { state, id };
    games.set(movePrice, game);
    return game;
  };
  const money = ({ state, id }, week) => state.history[week - 1].byAdvertiser[id].money;

  test.each(['premium', 'value'])('weeks 1-4 read the same after a move to %s as with no move', (price) => {
    const stayed = played(null);
    const moved = played(price);
    // Or this proves nothing: the move happened, and every week of month 1 was
    // revised after it.
    expect(moved.state.advertisers[0].position).toMatchObject({ price, repositionedAtRound: 5 });
    for (let week = 1; week <= 4; week++) {
      expect(moved.state.history[week - 1].revisedAtRound, `week ${week}`).toBeGreaterThanOrEqual(5);
      expect(money(stayed, week).grossProfitPaise, `week ${week} sold something`).toBeGreaterThan(0);
      expect(money(moved, week), `week ${week}`).toEqual(money(stayed, week));
    }
  });
});

/**
 * Two keywords removed at week 3, and the weeks they had already sold in.
 *
 * A week's late sales and returns were credited to whichever keyword caught
 * their search in the week they LANDED. So removing a keyword broke the weeks
 * before it in two ways. A search nothing catches any more lost its late sales
 * from the keyword rows altogether. A search a broader keyword took over had them
 * credited to that keyword, a row the week does have, so the rows still added
 * up and were wrong. The search terms rows never had either fault, because each
 * order carries its search; the keyword rows are held to them.
 *
 * "workout leggings" is exact and so wins its search over the phrase "leggings"
 * in the same ad group until week 3, when the phrase takes it over. "sports bra
 * high impact" has nothing else to catch it.
 */
describe('an old week\'s late sales reach the keyword that caught their click', { timeout: 120_000 }, () => {
  const POSITION = { price: 'mid', purpose: 'performance' };
  const search = (text) => QUERY_SET.queries.find((q) => q.text === text);
  const TAKEN_OVER = search('workout leggings');
  const DROPPED = search('sports bra high impact');
  let game = null;
  const played = () => {
    if (game) return game;
    const bid = Math.round(realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    ) * 1.2);
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        capex: {},
        keywords: [
          { text: 'leggings', matchType: 'phrase', bidPaise: bid },
          { text: TAKEN_OVER.text, matchType: 'exact', bidPaise: bid },
          { text: DROPPED.text, matchType: 'exact', bidPaise: bid },
        ],
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const id = state.advertisers[0].id;
    const keywords = state.advertisers[0].adGroups.flatMap((g) => g.keywords);
    const idOf = (text) => keywords.find((k) => k.text === text).id;
    const removed = [idOf(TAKEN_OVER.text), idOf(DROPPED.text)];
    for (let week = 1; week <= 8; week++) {
      let decisions = {};
      if (week === 3) {
        const me = state.advertisers.find((a) => a.id === id);
        decisions = {
          [id]: { adGroups: me.adGroups.map((g) => ({ ...g, keywords: g.keywords.filter((k) => !removed.includes(k.id)) })) },
        };
      }
      state = submitRound(state, decisions, { mode: 'expected' }).nextGameState;
    }
    game = { state, id, phrase: idOf('leggings'), takenOver: idOf(TAKEN_OVER.text), dropped: idOf(DROPPED.text) };
    return game;
  };
  const row = ({ state, id }, week) => state.history[week - 1].byAdvertiser[id];
  const total = (rows, field) => Object.values(rows ?? {}).reduce((a, r) => a + (r[field] ?? 0), 0);

  test('the phrase really took the search over, or this proves nothing', () => {
    const g = played();
    expect(row(g, 2).breakdown.byKeyword[g.takenOver].clicks, 'the exact had it before').toBeGreaterThan(0);
    expect(row(g, 4).breakdown.byQuery[TAKEN_OVER.id].clicks, 'and someone has it after').toBeGreaterThan(0);
    expect(row(g, 4).breakdown.byKeyword[g.takenOver], 'the exact is gone').toBeUndefined();
    expect(row(g, 4).breakdown.byQuery[DROPPED.id]?.clicks ?? 0, 'nothing has this one').toBe(0);
  });

  test.each([1, 2])('week %i: the keyword rows add up to the week, as the search rows do', (week) => {
    const r = row(played(), week);
    expect(r.conversions.returned, 'the week has returns to count').toBeGreaterThan(0);
    expect(total(r.breakdown.byKeyword, 'conversions'), 'sales').toBeCloseTo(r.conversions.final, 6);
    expect(total(r.breakdown.byKeyword, 'returned'), 'returns').toBeCloseTo(r.conversions.returned, 6);
  });

  test.each([1, 2])('week %i: each removed keyword keeps what its one search earned', (week) => {
    const g = played();
    const { byKeyword, byQuery } = row(g, week).breakdown;
    for (const [keyword, query] of [[g.takenOver, TAKEN_OVER], [g.dropped, DROPPED]]) {
      expect(byKeyword[keyword].conversions, `${query.text}: sales`).toBeCloseTo(byQuery[query.id].conversions, 6);
      expect(byKeyword[keyword].returned, `${query.text}: returns`).toBeCloseTo(byQuery[query.id].returned, 6);
    }
  });

  // THE COMMONEST WAY IN, and the search terms report's whole lesson: block a
  // search with a negative. The keyword stays and still matches the search, but
  // nothing catches it any more, which lost its late sales exactly as a removed
  // keyword did. Measured before the fix: week 2's row held 159.30 of the week's
  // 163.27 sales and 61.29 of its 64.64 returns.
  let blocked = null;
  const playedWithNegative = () => {
    if (blocked) return blocked;
    const bid = Math.round(realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    ) * 1.2);
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        capex: {},
        keywords: [{ text: 'leggings', matchType: 'phrase', bidPaise: bid }],
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const id = state.advertisers[0].id;
    for (let week = 1; week <= 8; week++) {
      const decisions = week === 3
        ? { [id]: { campaign: { negatives: [{ text: 'gym leggings', matchType: 'exact' }] } } } : {};
      state = submitRound(state, decisions, { mode: 'expected' }).nextGameState;
    }
    blocked = { state, id };
    return blocked;
  };

  test.each([1, 2])('week %i: a search blocked later keeps its late sales on its keyword\'s row', (week) => {
    const g = playedWithNegative();
    const gym = search('gym leggings');
    expect(row(g, 2).breakdown.byQuery[gym.id].clicks, 'the search sold before the block').toBeGreaterThan(0);
    expect(row(g, 4).breakdown.byQuery[gym.id]?.clicks ?? 0, 'and nothing after it').toBe(0);
    const r = row(g, week);
    expect(total(r.breakdown.byKeyword, 'conversions'), 'sales').toBeCloseTo(r.conversions.final, 6);
    expect(total(r.breakdown.byKeyword, 'returned'), 'returns').toBeCloseTo(r.conversions.returned, 6);
  });
});

describe('missedToBudget (spec 11.2)', () => {
  const constrained = R1.report.byAdvertiser.halcyon;

  test('a budget-limited advertiser is told what it missed', () => {
    expect(constrained.missedToBudget).not.toBeNull();
    expect(constrained.missedToBudget.impressions).toBeGreaterThan(0);
    expect(constrained.missedToBudget.clicks).toBeGreaterThan(0);
  });

  test('it reports the profit, not just the traffic', () => {
    // Sometimes the missed traffic would have lost money and the right action
    // is to leave the budget alone. A counterfactual reporting only extra
    // clicks would say "spend more" every single time.
    expect(constrained.missedToBudget).toHaveProperty('profitIfFundedPaise');
    expect(Number.isSafeInteger(constrained.missedToBudget.profitIfFundedPaise)).toBe(true);
  });

  test('advertisers without a counterfactual get null, not zeroes', () => {
    expect(R1.report.byAdvertiser[PLAYER_ID].missedToBudget).toBeNull();
  });
});

describe('Auction Insights (spec 16)', () => {
  const view = R1.insights[PLAYER_ID];

  test('every rival gets a row, and the viewer does not appear in its own', () => {
    expect(Object.keys(view.rivals)).toHaveLength(STATE.advertisers.length - 1);
    expect(view.rivals[PLAYER_ID]).toBeUndefined();
  });

  test('the six metrics are all present', () => {
    const row = Object.values(view.rivals)[0];
    for (const metric of ['impressionShare', 'overlapRate', 'positionAboveRate',
      'outrankingShare', 'topOfPageRate', 'absTopOfPageRate']) {
      expect(row, metric).toHaveProperty(metric);
    }
  });

  test('every rate is a fraction', () => {
    for (const [id, row] of Object.entries(view.rivals)) {
      for (const [metric, value] of Object.entries(row)) {
        expect(value, `${id}.${metric}`).toBeGreaterThanOrEqual(0);
        expect(value, `${id}.${metric}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('overlap rate is nonzero for someone: rivals do meet', () => {
    expect(Object.values(view.rivals).some((r) => r.overlapRate > 0)).toBe(true);
  });

  const pairOf = ({ both, above, solo }) => {
    const pairwise = {
      ids: ['a', 'b'],
      aShown: [both + solo, both],
      bothShown: [[0, both], [both, 0]],
      bAbove: [[0, above], [both - above, 0]],
      aShownBnot: [[0, solo], [0, 0]],
    };
    const stub = { impressions: 1, eligibleAuctions: 1, topImpressions: 0, absTopImpressions: 0 };
    return insightsFor(pairwise, { a: stub, b: stub }, 'a').rivals.b;
  };

  test('the two metrics sum to one ONLY when the viewer never showed alone', () => {
    // Spec v0.2 asserted they always summed to one and the test was deleted as
    // unsatisfiable. The real relationship is narrower than that claim and
    // wider than "never": position above rate divides by shared auctions,
    // outranking share by shared PLUS solo, so the two coincide exactly when
    // solo is zero and diverge the moment it is not.
    const noSolo = pairOf({ both: 100, above: 30, solo: 0 });
    expect(noSolo.outrankingShare + noSolo.positionAboveRate).toBeCloseTo(1, 12);

    const withSolo = pairOf({ both: 100, above: 30, solo: 50 });
    expect(withSolo.outrankingShare + withSolo.positionAboveRate).toBeGreaterThan(1);
  });

  test('showing where a rival cannot raises outranking share', () => {
    const tight = pairOf({ both: 100, above: 30, solo: 0 });
    const wide = pairOf({ both: 100, above: 30, solo: 100 });
    expect(wide.outrankingShare).toBeGreaterThan(tight.outrankingShare);
  });

  test('an advertiser that beats a rival everywhere outranks it completely', () => {
    expect(pairOf({ both: 100, above: 0, solo: 0 }).outrankingShare).toBe(1);
    expect(pairOf({ both: 100, above: 100, solo: 0 }).outrankingShare).toBe(0);
  });

  test('an unknown advertiser throws rather than returning an empty row', () => {
    expect(() => insightsFor(R1.raw.pairwise, R1.raw.byAdvertiser, 'ghost')).toThrow(/ghost/);
  });
});

describe('getSelfView: what an advertiser knows about itself (R3a)', () => {
  const self = getSelfView(STATE, PLAYER_ID);

  test('it carries the settings a controller needs to change them', () => {
    // R3a as originally written said a controller gets "exactly two things",
    // its report and getPublicView. Neither carries a bid: breakdown.byKeyword
    // is keyed by keyword id and holds impressions, clicks, cost and
    // conversions, with no text, no match type and no bidPaise. "Raise my bid
    // 10%" was not expressible. R3a now reads "never GameState, never another
    // advertiser's record" and this is the third thing.
    expect(self.adGroups[0].keywords[0]).toHaveProperty('bidPaise');
    expect(self.adGroups[0].keywords[0]).toHaveProperty('matchType');
    expect(self.campaign).toHaveProperty('strategy');
    expect(self.campaign).toHaveProperty('negatives');
    expect(self.position).toHaveProperty('price');
    expect(self.bidding).toHaveProperty('observedConvRate');
  });

  test('the catalogue is what you sell, not how well it sells', () => {
    // The line that matters. An advertiser knows its own order value and
    // margin - it set them. It must DISCOVER its conversion rate and its
    // return rate from its own report. A controller handed convRateBase never
    // has to learn one, which is the v0.1 oracle wearing a new name and the
    // whole reason DECISIONS D2 exists.
    expect(self.catalogue).toHaveProperty('aovMeanPaise');
    expect(self.catalogue).toHaveProperty('marginPct');
    expect(self.catalogue).not.toHaveProperty('convRateBase');
    expect(self.catalogue).not.toHaveProperty('returnRate');
  });

  test('and no forbidden field appears anywhere in it', () => {
    const json = JSON.stringify(self);
    for (const field of FORBIDDEN_IN_SELF_VIEW) {
      expect(json.includes(`"${field}"`), field).toBe(false);
    }
  });

  test('it holds no trace of any other advertiser', () => {
    const json = JSON.stringify(self);
    for (const other of STATE.advertisers) {
      if (other.id === PLAYER_ID) continue;
      expect(json.includes(other.id), other.id).toBe(false);
      expect(json.includes(other.domain), other.domain).toBe(false);
    }
  });

  test('mutating the view cannot reach back into the state', () => {
    const copy = getSelfView(STATE, PLAYER_ID);
    copy.adGroups[0].keywords[0].bidPaise = 999999;
    copy.campaign.negatives.push({ text: 'x', matchType: 'broad' });
    expect(STATE.advertisers[0].adGroups[0].keywords[0].bidPaise).not.toBe(999999);
    expect(STATE.advertisers[0].campaign.negatives).toHaveLength(0);
  });

  test('an unknown advertiser throws rather than returning an empty shell', () => {
    expect(() => getSelfView(STATE, 'ghost')).toThrow(/ghost/);
  });

  test('it carries the capital rules every advertiser is told at round 0 (C8)', () => {
    // A policy imports nothing from engine/, so a rival can only decide its
    // week-5 capital if the rules reach it here: which rounds, how much, and
    // where each target's ladder tops out. They are the rules, not anyone's
    // figures, and the player's round 0 card already shows all three.
    expect(self.capital.allocationRounds).toEqual(STATE.budgetSchedule.capexAllocationRounds);
    expect(self.capital.allocationPaise).toBe(CAPEX_ALLOCATION_PAISE);
    const top = (curve) => curve[curve.length - 1].paise;
    for (const target of CAPEX_TARGETS) {
      expect(self.capital.ceilingPaise[target], target).toBe(
        target === 'photography' ? top(CAPEX_PHOTOGRAPHY_CURVE) : top(CAPEX_TIER_CURVE),
      );
    }
  });

  test('and a rival cannot change the rules by editing its copy', () => {
    const copy = getSelfView(STATE, PLAYER_ID);
    copy.capital.allocationRounds.push(9);
    expect(STATE.budgetSchedule.capexAllocationRounds).not.toContain(9);
  });
});

describe('getPublicView is the only door (R3, R3a, spec 16.1)', () => {
  const view = getPublicView(STATE, PLAYER_ID, R1.raw);
  const serialised = JSON.stringify(view);

  test('it exposes identity and creative, which are genuinely public', () => {
    expect(view.advertisers).toHaveLength(STATE.advertisers.length);
    const rival = view.advertisers.find((a) => a.id !== PLAYER_ID);
    expect(rival).toHaveProperty('name');
    expect(rival).toHaveProperty('domain');
    expect(rival.ads[0]).toHaveProperty('headlines');
  });

  test('it exposes the query set, or nobody could write a keyword (H2)', () => {
    expect(view.querySet.length).toBe(STATE.querySet.queries.length);
    expect(view.querySet[0]).toHaveProperty('text');
    expect(view.querySet[0]).toHaveProperty('volumeShareBp');
    expect(view.querySet[0]).toHaveProperty('intent');
  });

  test('but NOT what any of those queries is worth', () => {
    // Withheld from everyone, including the advertiser the affinity favours.
    // Knowing 50,000 people search "cheap gym leggings" is research; knowing
    // what they do after clicking is earned by running the keyword.
    for (const q of view.querySet) {
      expect(q).not.toHaveProperty('priceAffinity');
      expect(q).not.toHaveProperty('convMultiplier');
      expect(q).not.toHaveProperty('tags');
    }
  });

  test('no forbidden field appears anywhere in the serialised view', () => {
    const leaked = FORBIDDEN_IN_PUBLIC_VIEW.filter((f) => serialised.includes(`"${f}"`));
    expect(leaked, `leaked: ${leaked.join(', ')}`).toEqual([]);
  });

  test('no bid, budget, cost or conversion number is reachable', () => {
    for (const needle of ['bidPaise', 'costPaise', 'monthlyBudgetPaise',
      'gradedQuality', 'pendingConversions', 'observedConvRate']) {
      expect(serialised.includes(needle), needle).toBe(false);
    }
  });

  test('a landing page description stays private', () => {
    // Ads Transparency shows creative. It does not show an advertiser's own
    // working notes about its site.
    expect(serialised).not.toContain('landingPageDescription');
    expect(serialised).not.toContain('Category page with filters');
  });

  test('it works without a round context, for round 0', () => {
    const bare = getPublicView(STATE, PLAYER_ID);
    expect(bare.insights).toBeNull();
    expect(bare.querySet.length).toBeGreaterThan(0);
  });

  test('it does not hand back live references into game state', () => {
    const v = getPublicView(STATE, PLAYER_ID, R1.raw);
    v.advertisers[0].ads[0].headlines.push('injected');
    expect(STATE.advertisers[0].adGroups[0].ad.headlines).not.toContain('injected');
  });
});

describe('quality scores reach only their owner (L15)', () => {
  test('the report leaves a slot for them, and the engine does not fill it', () => {
    // Nothing in engine/ may read reportedScore, so report.js cannot compute
    // it. The caller attaches each advertiser's own scores to its own row.
    expect(mine(R1).quality).toEqual({});
  });
});


// ---------------------------------------------------------------------------
// Where the money came from, and where it went back (G4, step 4)
// ---------------------------------------------------------------------------

describe('the location breakdown', () => {
  /**
   * A location report showing only clicks and cost would show three columns
   * differing by volume and nothing else, because location does not touch
   * conversion RATE by design. What it touches is the basket and the return
   * rate - and both arrive late, a return window on top of an attribution lag.
   * So the shape is asserted here and the revision below, because the revision
   * is where the lesson actually lands.
   */
  const rowsOf = (row) => Object.values(row.breakdown.byLocation);

  test('every advertiser that traded gets one row per location', () => {
    for (const advertiser of STATE.advertisers) {
      const row = R1.report.byAdvertiser[advertiser.id];
      if (!row || row.traffic.impressions <= 0) continue;
      const keys = Object.keys(row.breakdown.byLocation);
      expect(keys.length, advertiser.id).toBeGreaterThan(0);
      for (const key of keys) {
        expect(Number(key), `${advertiser.id} tier ${key}`).toBeLessThan(LOCATION_TIERS.length);
      }
    }
  });

  test('the traffic in it sums back to the advertiser own totals', () => {
    for (const advertiser of STATE.advertisers) {
      const row = R1.report.byAdvertiser[advertiser.id];
      if (!row || row.traffic.impressions <= 0) continue;
      const sumOf = (key) => rowsOf(row).reduce((a, r) => a + r[key], 0);
      expect(sumOf('impressions'), advertiser.id).toBeCloseTo(row.traffic.impressions, 6);
      expect(sumOf('clicks'), advertiser.id).toBeCloseTo(row.traffic.clicks, 6);
      expect(sumOf('costPaise'), advertiser.id).toBeCloseTo(row.traffic.costPaise, 6);
    }
  });

  test('impression share is measured against the auctions available THERE', () => {
    // Against the whole market it becomes meaningless the moment anybody can
    // choose where to run, which is what step 6 adds. F12 already records share
    // as the most misread number in this report.
    const row = R1.report.byAdvertiser[PLAYER_ID];
    for (const [tier, r] of Object.entries(row.breakdown.byLocation)) {
      expect(r.eligibleAuctions, `tier ${tier}`).toBeGreaterThan(0);
      expect(r.impressionShare, `tier ${tier}`)
        .toBeCloseTo(r.impressions / r.eligibleAuctions, 9);
      expect(r.impressionShare).toBeLessThanOrEqual(1);
    }
  });

  test('a basket is bigger in the metros than in the towns', () => {
    // Conversions divide in proportion to clicks, because conversion rate is
    // location-independent by design - so any difference in revenue per
    // conversion is the basket and nothing else.
    const rows = rowsOf(R1.report.byAdvertiser[PLAYER_ID]).filter((r) => r.conversions > 0);
    expect(rows.length, 'nothing converted anywhere').toBeGreaterThan(1);
    const perConversion = rows.map((r) => r.grossRevenuePaise / r.conversions);
    expect(perConversion[0]).toBeGreaterThan(perConversion[perConversion.length - 1]);
  });

  test('and nothing has come back yet, because returns resolve later', () => {
    for (const r of rowsOf(R1.report.byAdvertiser[PLAYER_ID])) {
      expect(r.returned).toBe(0);
      expect(r.returnedRevenuePaise).toBe(0);
    }
  });
});

describe('the returns arrive late, and that is the lesson', () => {
  /**
   * Round 1 read after enough rounds have passed for its returns to resolve: an
   * attribution lag of up to three rounds, then a return window on top. A
   * location reads well for several weeks and is then revised downward, which is
   * exactly the shape of the mistake this mechanic exists to teach.
   */
  let state = STATE;
  let rounds = [];
  for (let i = 0; i < 8; i++) {
    const out = runRound(state, { mode: 'expected' });
    state = out.nextGameState;
    rounds.push(out);
  }
  const settled = state.history.find((h) => h.round === 1).byAdvertiser[PLAYER_ID];
  const rows = Object.values(settled.breakdown.byLocation);

  test('returns are attributed to the location the click was in', () => {
    const returned = rows.reduce((a, r) => a + r.returned, 0);
    expect(returned, 'nothing came back at all').toBeGreaterThan(0);
    expect(returned).toBeCloseTo(settled.conversions.returned, 6);
  });

  test('the return RATE rises as the cities get smaller', () => {
    // The gradient the design rests on, and the thing a player can only learn
    // by reading this table after it has been revised.
    const rates = rows.map((r) => r.returned / r.conversions);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i], `tier ${i} against ${i - 1}`).toBeGreaterThan(rates[i - 1]);
    }
  });

  test('so a click is worth less in the towns at exactly the same price', () => {
    // The sentence the whole mechanic exists to make true: same CPC, less money.
    const cpc = rows.map((r) => r.costPaise / r.clicks);
    const netPerClick = rows.map(
      (r) => (r.grossRevenuePaise - r.returnedRevenuePaise) / r.clicks,
    );
    for (let i = 1; i < cpc.length; i++) {
      expect(cpc[i] / cpc[0], `cpc tier ${i} against the metros`).toBeCloseTo(1, 2);
    }
    expect(netPerClick[netPerClick.length - 1]).toBeLessThan(netPerClick[0]);
  });
});

/**
 * The returns that were never sales (I28).
 *
 * Build 1 is a decomposition and nothing else: the player learns which of their
 * returns came back from the door, and not one economic number moves. These are
 * the assertions that make that claim checkable rather than stated — the first
 * is the safety property, and if it ever fails the split has become an addition.
 */
describe('refusals and send-backs are told apart', () => {
  const rows = (result, id = PLAYER_ID) => Object.entries(
    result.report.byAdvertiser[id].breakdown.byLocation ?? {},
  );

  test('every location row carries both halves and the reason for them', () => {
    for (const [tier, row] of rows(R1)) {
      expect(row, `tier ${tier}`).toHaveProperty('refused');
      expect(row, `tier ${tier}`).toHaveProperty('sentBack');
      expect(row.codShare, `tier ${tier}`).toBeGreaterThan(0);
      expect(row.codShare, `tier ${tier}`).toBeLessThan(1);
    }
  });

  test('refused plus sent back is EXACTLY what was returned', () => {
    // The safety property of the whole change. A split that does not add up is
    // an invented number wearing a decomposition's clothes.
    for (const result of [R1, R2]) {
      for (const [tier, row] of rows(result)) {
        expect(row.refused + row.sentBack, `tier ${tier}`)
          .toBeCloseTo(row.returned ?? 0, 10);
      }
    }
  });

  test('neither half is ever negative', () => {
    for (const result of [R1, R2]) {
      for (const [tier, row] of rows(result)) {
        expect(row.refused, `tier ${tier}`).toBeGreaterThanOrEqual(0);
        expect(row.sentBack, `tier ${tier}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('the COD share on a row matches the table for that advertiser', () => {
    // Two axes, so reading the wrong one is a real possibility: a row keyed by
    // location, holding a share that also depends on the advertiser's price.
    const price = STATE.advertisers.find((a) => a.id === PLAYER_ID).position.price;
    for (const [tier, row] of rows(R1)) {
      expect(row.codShare, `tier ${tier}`).toBe(codShareFor(price, Number(tier)));
    }
  });

  test('two advertisers in different price tiers get different COD shares', () => {
    const others = STATE.advertisers.filter((a) => a.position.price
      !== STATE.advertisers.find((x) => x.id === PLAYER_ID).position.price);
    if (others.length === 0) return;
    const mineRows = Object.fromEntries(rows(R1));
    const theirs = Object.fromEntries(rows(R1, others[0].id));
    const tier = Object.keys(mineRows).find((k) => theirs[k]);
    if (tier == null) return;
    expect(theirs[tier].codShare).not.toBe(mineRows[tier].codShare);
  });

  test('the split survives revision, which is when returns actually arrive', () => {
    // Returns resolve two rounds after the conversion, so the interesting rows
    // only exist after `reviseReports` has been through them. A split applied
    // only on the way in would silently stop adding up here.
    const revised = reviseReports([R1.report], {
      currentRound: R2.report.round, raw: R2.raw, advertisers: R2.nextGameState.advertisers,
    });
    for (const report of revised) {
      const byLocation = report.byAdvertiser[PLAYER_ID].breakdown.byLocation ?? {};
      for (const [tier, row] of Object.entries(byLocation)) {
        expect(row.refused + row.sentBack, `tier ${tier}`)
          .toBeCloseTo(row.returned ?? 0, 10);
      }
    }
  });

  test('NOTHING ELSE MOVED: the returned totals are untouched by the split', () => {
    // The claim build 1 rests on, asserted rather than trusted. `refused` and
    // `sentBack` are derived from `returned`; if the derivation ever writes back
    // into it, the market's economics have changed and calibration is stale.
    for (const result of [R1, R2]) {
      const row = mine(result);
      const fromLocations = Object.values(row.breakdown.byLocation ?? {})
        .reduce((a, r) => a + (r.returned ?? 0), 0);
      expect(fromLocations).toBeCloseTo(row.conversions.returned, 6);
    }
  });
});

/**
 * The freight on a refused parcel (I28 build 2).
 *
 * The first shipping cost this engine has ever had. `marginPct` absorbed it
 * silently before, so a parcel refused at the door cost nothing but revenue
 * that never arrived — which is why cash on delivery looked harmless here and
 * does not in life.
 */
describe('refused parcels cost freight', () => {
  const played = () => {
    let s = makeGameState();
    const out = [];
    for (let r = 1; r <= 6; r++) {
      const result = runRound({ ...s, round: r }, { mode: 'expected' });
      out.push(result);
      s = result.nextGameState;
    }
    return { state: s, results: out };
  };

  test('the charge is exactly the refused count times the freight', () => {
    const { state } = played();
    for (const report of state.history) {
      for (const [id, row] of Object.entries(report.byAdvertiser)) {
        expect(row.money.rtoFreightPaise, `${id} wk${report.round}`)
          .toBe(Math.round((row.conversions.refused ?? 0) * RTO_FREIGHT_PAISE));
      }
    }
  });

  test('it comes off NET profit and leaves GROSS alone', () => {
    // Gross is the reading where nothing came back, and if nothing came back
    // there is no freight to pay. It also sharpens D4's trap rather than
    // softening it: the metric month 3 is allocated on now ignores the returns
    // AND what they cost to carry.
    const { state } = played();
    let checked = 0;
    for (const report of state.history) {
      for (const [id, row] of Object.entries(report.byAdvertiser)) {
        const m = row.money;
        if (m.rtoFreightPaise <= 0 || m.grossRevenuePaise <= 0) continue;
        checked += 1;

        // The margin this advertiser ran at, recovered from the gross figures —
        // which is only possible because gross carries no freight term.
        const margin = (m.grossProfitPaise + row.traffic.costPaise) / m.grossRevenuePaise;

        // Net, with the freight added back, must land on the same formula gross
        // uses. If freight had leaked into gross this would miss by twice it.
        const netBeforeFreight = m.netProfitPaise + m.rtoFreightPaise;
        expect(netBeforeFreight, `${id} wk${report.round}`)
          .toBeCloseTo(m.netRevenuePaise * margin - row.traffic.costPaise, -1);
      }
    }
    expect(checked, 'no advertiser paid any freight, so this proved nothing')
      .toBeGreaterThan(0);
  });

  test('no freight is charged in the round the click happened', () => {
    // A return needs the window, so nothing can have come back yet. A charge
    // here would be billing for a parcel that has not been refused.
    const first = runRound(makeGameState(), { mode: 'expected' });
    for (const row of Object.values(first.report.byAdvertiser)) {
      expect(row.money.rtoFreightPaise).toBe(0);
      expect(row.conversions.refused).toBe(0);
    }
  });

  test('refused and sent back still add to returned, after every revision', () => {
    const { state } = played();
    for (const report of state.history) {
      for (const [id, row] of Object.entries(report.byAdvertiser)) {
        expect(row.conversions.refused + row.conversions.sentBack, `${id} wk${report.round}`)
          .toBeCloseTo(row.conversions.returned, 8);
      }
    }
  });

  test('somebody was actually refused, or none of the above proves anything', () => {
    // The guard against a suite that passes because every figure is zero.
    const { state } = played();
    const total = state.history.reduce((a, h) => a + Object.values(h.byAdvertiser)
      .reduce((b, r) => b + (r.conversions.refused ?? 0), 0), 0);
    expect(total).toBeGreaterThan(0);
  });
});

/**
 * Which search sent it back (I32).
 *
 * `queueReturns` has carried `queryId` on every resolved return since it was
 * written, and the revision loop threw it away — only the location was
 * credited. So a player could see that the towns return badly and never that a
 * SEARCH does, which left the one lever available in every round unusable on
 * return grounds.
 *
 * The first test is the safety property: this attributes returns that already
 * happened and must move no total.
 */
describe('returns are attributed to the search that earned them', () => {
  const played = () => {
    let s = makeGameState();
    for (let r = 1; r <= 6; r++) s = runRound({ ...s, round: r }, { mode: 'expected' }).nextGameState;
    return s;
  };

  test('NOTHING MOVED: the query rows sum to the account total', () => {
    // If this ever fails, the attribution has become a second source of returns
    // rather than a breakdown of the ones the account already had.
    const state = played();
    for (const report of state.history) {
      const row = report.byAdvertiser[PLAYER_ID];
      const fromQueries = Object.values(row.breakdown.byQuery ?? {})
        .reduce((a, r) => a + (r.returned ?? 0), 0);
      expect(fromQueries, `week ${report.round}`).toBeCloseTo(row.conversions.returned, 6);
    }
  });

  test('and so do the keyword rows', () => {
    const state = played();
    for (const report of state.history) {
      const row = report.byAdvertiser[PLAYER_ID];
      const fromKeywords = Object.values(row.breakdown.byKeyword ?? {})
        .reduce((a, r) => a + (r.returned ?? 0), 0);
      expect(fromKeywords, `week ${report.round}`).toBeCloseTo(row.conversions.returned, 6);
    }
  });

  test('every query row carries the fields whether or not anything came back', () => {
    // A row whose shape depends on its history makes the view branch on
    // `undefined`, which is how a column ends up reading NaN in one week and a
    // number in the next.
    const state = played();
    for (const report of state.history) {
      for (const [id, r] of Object.entries(report.byAdvertiser[PLAYER_ID].breakdown.byQuery)) {
        expect(r, `${id} week ${report.round}`).toHaveProperty('returned');
        expect(r, `${id} week ${report.round}`).toHaveProperty('returnedRevenuePaise');
        expect(Number.isFinite(r.returned), `${id}`).toBe(true);
      }
    }
  });

  test('no search returns more than it converted', () => {
    const state = played();
    for (const report of state.history) {
      for (const [id, r] of Object.entries(report.byAdvertiser[PLAYER_ID].breakdown.byQuery)) {
        expect(r.returned, `${id} week ${report.round}`)
          .toBeLessThanOrEqual(r.conversions + r.returned + 1e-6);
      }
    }
  });

  test('somebody actually returned something, or none of the above proves anything', () => {
    const state = played();
    const total = state.history.reduce((a, h) => a
      + Object.values(h.byAdvertiser[PLAYER_ID].breakdown.byQuery ?? {})
        .reduce((b, r) => b + (r.returned ?? 0), 0), 0);
    expect(total).toBeGreaterThan(0);
  });

  test('the searches do not all return at the same rate — ON THE REAL SET', () => {
    // The reason this column is worth showing at all: if every search returned
    // alike it would be decoration.
    //
    // IT HAS TO RUN ON `content/querySet.js`, AND THE FIRST VERSION DID NOT.
    // `tests/fixtures/querySet.js` hardcodes `returnRateMultiplier: 1.0` on
    // every query — it exists to satisfy 7.4's rules, not to carry the content's
    // spread — so the same assertion against `makeGameState` measured a flat
    // column and would have reported a working feature as broken. The real set
    // carries six distinct values from 0.85 to 1.2.
    const own = QUERY_SET.queries
      .filter((q) => homeCell(q) === 'mid|lifestyle')
      .sort((a, b) => (b.volumeShareBp ?? 0) - (a.volumeShareBp ?? 0))
      .slice(0, 8);

    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'lifestyle' },
        capex: { committed: {}, pending: [], remainingUnallocatedPaise: 0 },
        keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 3000 })),
        ad: {
          headlines: ['Everyday Athleisure', 'Co-ord Sets', 'All Day Wear'],
          descriptions: [
            'Soft co-ord sets and joggers that look put together, morning to night.',
            'Sizes XS to XXL, free delivery and easy returns across India.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    for (let r = 1; r <= 7; r++) state = submitRound(state, {}, { mode: 'expected' }).nextGameState;

    // WEEK 1, NOT THE LAST WEEK. Two earlier versions of this assertion read
    // `history.at(-1)`, whose returns have not resolved — a return needs two
    // rounds after the conversion — so every rate was 0 and the test reported a
    // working feature as broken, twice.
    const early = state.history.find((h) => h.round === 1)
      .byAdvertiser[BRAND_IDENTITIES[0].id];
    const rates = Object.values(early.breakdown.byQuery)
      .filter((r) => r.conversions > 1)
      // `returned` is a subset of `conversions`, so this is the rate and not a
      // share of some larger cohort.
      .map((r) => r.returned / r.conversions);
    expect(rates.length, 'not enough searches converted to compare').toBeGreaterThan(2);
    expect(Math.max(...rates)).toBeGreaterThan(0);
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(0.01);
  });
});
