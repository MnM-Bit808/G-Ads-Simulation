import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { advertiserReport, reviseReports } from '../engine/report.js';
import {
  getPublicView, getSelfView, insightsFor,
  FORBIDDEN_IN_PUBLIC_VIEW, FORBIDDEN_IN_SELF_VIEW,
} from '../engine/insights.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';

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
