import { describe, test, expect } from 'vitest';
import {
  POLICIES, disciplined, spender, cautious, automator, grossOptimiser, brandDefender,
  affordableCpcPaise, grossAffordableCpcPaise,
} from '../agents/policies.js';
import { playGame } from '../game.js';
import { getSelfView, getPublicView } from '../engine/insights.js';
import { makeGameState, deformed, PLAYER_ID } from './fixtures/gameState.js';

const STATE = makeGameState();
const SELF = getSelfView(STATE, PLAYER_ID);
const VIEW = getPublicView(STATE, PLAYER_ID);

/** A settled-looking report, so a policy has something to react to. */
const reportWith = (over = {}) => ({
  traffic: { impressions: 20000, clicks: 800, costPaise: 900000, eligibleAuctions: 40000 },
  share: { impressionShare: 0.5, lostToRank: 0.2, lostToBudget: 0.3 },
  conversions: { asFirstReported: 20, final: 30, stillPending: 5, returned: 6 },
  money: { grossRoas: 6, netRoas: 5, netProfitPaise: 100000, grossProfitPaise: 200000 },
  breakdown: { byQuery: {}, byKeyword: {} },
  ...over,
});

const ALL = Object.entries(POLICIES);

describe('all six policies obey the contract', () => {
  test('each is a pure function of three views', () => {
    for (const [id, policy] of ALL) {
      const before = JSON.stringify([SELF, VIEW]);
      const a = JSON.stringify(policy(SELF, null, VIEW));
      const b = JSON.stringify(policy(SELF, null, VIEW));
      expect(a, id).toBe(b);
      expect(JSON.stringify([SELF, VIEW]), id).toBe(before);
    }
  });

  test('each survives a round-1 null report', () => {
    for (const [id, policy] of ALL) {
      const decision = policy(SELF, null, VIEW);
      expect(decision, id).toBeTruthy();
      expect(decision.campaign, id).toBeTruthy();
    }
  });

  test('each writes only integer paise bids inside its own bounds (R7)', () => {
    for (const [id, policy] of ALL) {
      const decision = policy(SELF, reportWith(), VIEW);
      for (const group of decision.adGroups ?? []) {
        for (const keyword of group.keywords) {
          expect(Number.isSafeInteger(keyword.bidPaise), `${id} ${keyword.id}`).toBe(true);
          expect(keyword.bidPaise, `${id} ${keyword.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  test('each names a strategy the engine actually has', () => {
    const known = ['manual', 'maxClicks', 'targetCpa', 'targetRoas', 'maxConv'];
    for (const [id, policy] of ALL) {
      expect(known, id).toContain(policy(SELF, reportWith(), VIEW).campaign.strategy);
    }
  });
});

describe('spender: broad, unblocked, and above its ceiling', () => {
  const decision = spender(SELF, reportWith(), VIEW);

  test('it broadens every keyword that carries tags', () => {
    for (const keyword of decision.adGroups[0].keywords) {
      expect(keyword.matchType, keyword.text).toBe('broad');
    }
  });

  test('but leaves an untagged keyword alone, or it would match nothing', () => {
    // An untagged keyword is inert on broad (8.4). Broadening one would take it
    // out of the auction entirely, making this rival quieter rather than louder.
    const untagged = deformed(STATE, (x) => {
      x.advertisers[0].adGroups[0].keywords = x.advertisers[0].adGroups[0].keywords
        .map((k) => ({ ...k, tags: [], taggedContentHash: null, matchType: 'phrase' }));
    });
    const self = getSelfView(untagged, PLAYER_ID);
    for (const keyword of spender(self, reportWith(), VIEW).adGroups[0].keywords) {
      expect(keyword.matchType).toBe('phrase');
    }
  });

  test('it never writes a negative, however wasteful the report', () => {
    const wasteful = reportWith({
      breakdown: { byQuery: { [VIEW.querySet[0].id]: { clicks: 900, conversions: 0 } }, byKeyword: {} },
    });
    expect(spender(SELF, wasteful, VIEW).campaign.negatives).toEqual([]);
  });

  test('and it bids above what it can afford', () => {
    expect(decision.adGroups[0].keywords[0].bidPaise)
      .toBeGreaterThan(affordableCpcPaise(SELF, reportWith()));
  });
});

describe('cautious: efficient, and poorer for it', () => {
  test('it bids well under the disciplined opening', () => {
    const shy = cautious(SELF, null, VIEW).adGroups[0].keywords[0].bidPaise;
    const sane = disciplined(SELF, null, VIEW).adGroups[0].keywords[0].bidPaise;
    expect(shy).toBeLessThan(sane);
  });

  test('it holds its nerve at ordinary levels of lost rank', () => {
    // Compared against its own report-informed ceiling, not its round-1 one.
    // The two differ, and correctly: with a report it can see that only 20% of
    // its orders came back rather than the 25% it assumed, so what it believes
    // it can afford RISES. Any assertion that pinned the two together would be
    // asserting the policy never learns.
    const calm = reportWith({ share: { lostToRank: 0.2, lostToBudget: 0 } });
    const target = Math.round(affordableCpcPaise(SELF, calm) * 0.35);
    expect(cautious(SELF, calm, VIEW).adGroups[0].keywords[0].bidPaise).toBe(target);
  });

  test('it creeps up only when it is losing most of the market', () => {
    const panicked = cautious(SELF, reportWith({ share: { lostToRank: 0.8, lostToBudget: 0 } }), VIEW);
    const calm = cautious(SELF, reportWith({ share: { lostToRank: 0.2, lostToBudget: 0 } }), VIEW);
    expect(panicked.adGroups[0].keywords[0].bidPaise)
      .toBeGreaterThan(calm.adGroups[0].keywords[0].bidPaise);
  });

  test('and never past half of what it can afford', () => {
    const panicked = reportWith({ share: { lostToRank: 0.9, lostToBudget: 0 } });
    let self = SELF;
    for (let i = 0; i < 20; i++) {
      self = { ...self, adGroups: cautious(self, panicked, VIEW).adGroups };
    }
    // Its ceiling is derived from what IT believes it can afford, which is the
    // report-informed figure, so that is what the bound has to be measured
    // against. Twenty rounds of panic cannot push it past half.
    expect(self.adGroups[0].keywords[0].bidPaise)
      .toBeLessThanOrEqual(Math.round(affordableCpcPaise(SELF, panicked) * 0.5));
  });
});

describe('automator: it never stays anywhere long enough to find out', () => {
  test('a disappointing round moves it to the next strategy', () => {
    const poor = reportWith({ money: { netRoas: 1.0, grossRoas: 2, netProfitPaise: -1, grossProfitPaise: 1 } });
    expect(automator(SELF, poor, VIEW).campaign.strategy).not.toBe(SELF.campaign.strategy);
  });

  test('a good round leaves it where it is', () => {
    const good = reportWith({ money: { netRoas: 9, grossRoas: 11, netProfitPaise: 1, grossProfitPaise: 1 } });
    expect(automator(SELF, good, VIEW).campaign.strategy).toBe(SELF.campaign.strategy);
    expect(automator(SELF, good, VIEW).campaign.strategyParams).toBeUndefined();
  });

  test('it supplies the parameter each strategy needs, or the engine throws', () => {
    // targetRoas throws on a zero or missing target rather than silently
    // substituting 1, and targetCpa on a non-positive one (12.2).
    let self = SELF;
    const poor = reportWith({ money: { netRoas: 1.0, grossRoas: 2, netProfitPaise: -1, grossProfitPaise: 1 } });
    for (let i = 0; i < 6; i++) {
      const decision = automator(self, poor, VIEW);
      const { strategy, strategyParams } = decision.campaign;
      if (strategy === 'targetCpa') expect(strategyParams.targetCpaPaise).toBeGreaterThan(0);
      if (strategy === 'targetRoas') expect(strategyParams.targetRoas).toBeGreaterThan(0);
      self = { ...self, campaign: { ...self.campaign, strategy, strategyParams } };
    }
  });

  test('it cycles rather than getting stuck', () => {
    const poor = reportWith({ money: { netRoas: 1.0, grossRoas: 2, netProfitPaise: -1, grossProfitPaise: 1 } });
    let self = SELF;
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const { strategy, strategyParams } = automator(self, poor, VIEW).campaign;
      seen.add(strategy);
      self = { ...self, campaign: { ...self.campaign, strategy, strategyParams } };
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('grossOptimiser: the section 14 trap, walking around', () => {
  test('it believes it can pay more than it can', () => {
    expect(grossAffordableCpcPaise(SELF)).toBeGreaterThan(affordableCpcPaise(SELF, null));
  });

  test('and therefore outbids the disciplined rival on identical economics', () => {
    const greedy = grossOptimiser(SELF, null, VIEW).adGroups[0].keywords[0].bidPaise;
    const sane = disciplined(SELF, null, VIEW).adGroups[0].keywords[0].bidPaise;
    expect(greedy).toBeGreaterThan(sane);
  });

  test('the overpayment is exactly the return rate it forgot', () => {
    // affordable = aov x margin x (1 - returns) x rate. Deleting the retention
    // term is the whole of section 14, and the gap it opens is 1/(1 - r).
    const ratio = grossAffordableCpcPaise(SELF) / affordableCpcPaise(SELF, null);
    expect(ratio).toBeCloseTo(1 / (1 - 0.25), 2);
  });

  test('it is careful about the wrong number, not careless', () => {
    // It still writes negatives. A rival that were both sloppy AND
    // gross-optimising would confound the two lessons.
    const wasteful = reportWith({
      breakdown: { byQuery: { [VIEW.querySet[0].id]: { clicks: 900, conversions: 0 } }, byKeyword: {} },
    });
    expect(grossOptimiser(SELF, wasteful, VIEW).campaign.negatives.length).toBeGreaterThan(0);
  });
});

describe('brandDefender: it has to infer ownership, like a player', () => {
  const decision = brandDefender(SELF, null, VIEW);
  const brandKeywords = decision.adGroups[0].keywords.filter((k) => k.id.startsWith('kw_brand_'));

  test('getPublicView does not tell it who owns a brand query', () => {
    // The information it is NOT given. brandOwner is withheld from everyone
    // (16.1); names are public because Ads Transparency is (R3).
    for (const query of VIEW.querySet) expect(query.brandOwner).toBeUndefined();
    expect(VIEW.advertisers[0].name).toBeTruthy();
  });

  // The roster holds "Vella & Co." and the query it owns reads "vella
  // leggings". Nobody searches a company's legal name with its ampersand
  // attached, so ownership is read from the distinctive token. The first
  // version of both the policy AND this test matched the full string, found
  // eight of the nine, and missed exactly the one name with more than a word
  // in it.
  const token = (name) => String(name).toLowerCase().match(/[a-z0-9]+/)[0];
  const mentions = (text, name) => text.toLowerCase().split(/[^a-z0-9]+/).includes(token(name));

  test('so it reads the query text and finds a name in it', () => {
    expect(brandKeywords.length).toBeGreaterThan(0);
    for (const keyword of brandKeywords) {
      const named = VIEW.advertisers.some((a) => mentions(keyword.text, a.name));
      expect(named, keyword.text).toBe(true);
    }
  });

  test('it pays up for its own name and very little for anyone else', () => {
    const own = brandKeywords.filter((k) => mentions(k.text, SELF.name));
    const poached = brandKeywords.filter((k) => !mentions(k.text, SELF.name));
    expect(own.length).toBeGreaterThan(0);
    expect(poached.length).toBeGreaterThan(0);
    expect(Math.min(...own.map((k) => k.bidPaise)))
      .toBeGreaterThan(Math.max(...poached.map((k) => k.bidPaise)));
  });

  test('a multi-word name is matched by its distinctive token', () => {
    // Pinned, because it is the case that broke and the one a nine-name roster
    // only happens to contain once.
    expect(SELF.name).toBe('Vella & Co.');
    expect(brandKeywords.some((k) => k.text === 'vella leggings')).toBe(true);
  });

  test('brand keywords are exact and untagged, because a name is a string', () => {
    for (const keyword of brandKeywords) {
      expect(keyword.matchType, keyword.text).toBe('exact');
      expect(keyword.tags, keyword.text).toEqual([]);
      expect(keyword.taggedContentHash, keyword.text).toBeNull();
    }
  });

  test('a brand query it cannot attribute is left alone, not guessed at', () => {
    const orphan = {
      ...VIEW,
      querySet: [...VIEW.querySet, { id: 'q_orphan', text: 'unbranded gym leggings', intent: 'brand', volumeShareBp: 10 }],
    };
    const keywords = brandDefender(SELF, null, orphan).adGroups[0].keywords;
    expect(keywords.some((k) => k.id === 'kw_brand_q_orphan')).toBe(false);
  });

  test('it keeps its own territory keywords too', () => {
    expect(decision.adGroups[0].keywords.length)
      .toBeGreaterThan(SELF.adGroups[0].keywords.length);
  });

  test('and does not add the same brand keyword twice', () => {
    const ids = brandKeywords.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    const twice = brandDefender({ ...SELF, adGroups: decision.adGroups }, null, VIEW);
    expect(twice.adGroups[0].keywords).toHaveLength(decision.adGroups[0].keywords.length);
  });
});

describe('a mixed market of all six plays', () => {
  const ids = STATE.advertisers.map((a) => a.id);
  const seat = async (policy) => {
    const controllers = Object.fromEntries(
      ids.map((id) => [id, id === PLAYER_ID ? policy : disciplined]),
    );
    const { reports } = await playGame(STATE, controllers, { mode: 'expected', rounds: 1 });
    return reports[0].byAdvertiser[PLAYER_ID];
  };
  let disciplinedRow;
  let spenderRow;

  test('the same seat, two characters', async () => {
    disciplinedRow = await seat(disciplined);
    spenderRow = await seat(spender);
    expect(disciplinedRow.traffic.eligibleAuctions).toBeGreaterThan(0);
    expect(spenderRow.traffic.eligibleAuctions).toBeGreaterThan(0);
  });

  test('four rounds run with a different policy on each advertiser', async () => {
    const controllers = Object.fromEntries(
      ids.map((id, i) => [id, ALL[i % ALL.length][1]]),
    );
    const { finalState, reports } = await playGame(STATE, controllers, { mode: 'expected', rounds: 4 });
    expect(reports).toHaveLength(4);
    for (const row of Object.values(reports[3].byAdvertiser)) {
      expect(Number.isSafeInteger(row.traffic.costPaise)).toBe(true);
    }
    // The market has to still be alive with six different characters in it.
    const spend = Object.values(reports[3].byAdvertiser)
      .reduce((a, r) => a + r.traffic.costPaise, 0);
    expect(spend).toBeGreaterThan(0);
    expect(finalState.round).toBe(5);
  });

  test('the spender reaches four times as far and shows less often (8.5)', () => {
    // Measured against the same market with a disciplined advertiser in that
    // seat. Broad match multiplies the ELIGIBILITY DENOMINATOR far faster than
    // it multiplies impressions, which is the counter-intuitive half of 8.5.
    //
    // The first version of this test asserted impressions RISE. They fall, and
    // the reason is worth more than the assertion was: reach that large burns
    // the daily budget early, so pacing throttles it (13.4) and 82% of its
    // eligible auctions are lost to budget rather than to rank. It is not
    // outranked. It simply runs out of money, gradually, in the wrong hours.
    //
    // round.test.js already demonstrates the clean form of 8.5 by holding the
    // bid constant and changing only match type. This one is the live-market
    // version, where two mechanisms act at once.
    expect(spenderRow.traffic.eligibleAuctions)
      .toBeGreaterThan(disciplinedRow.traffic.eligibleAuctions * 3);
    expect(spenderRow.share.impressionShare)
      .toBeLessThan(disciplinedRow.share.impressionShare * 0.5);
    expect(spenderRow.share.lostToBudget).toBeGreaterThan(0.5);
    expect(spenderRow.share.lostToRank).toBeLessThan(0.1);
  });
});
