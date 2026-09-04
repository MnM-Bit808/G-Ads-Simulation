import { describe, test, expect } from 'vitest';
import { getSelfView, getPublicView } from '../engine/insights.js';
import { blockedBy, matchesKeyword } from '../engine/matching.js';
import { STRATEGIES, effectiveBidPaise, daypartMultiplier } from '../engine/strategies.js';
import { allCells, parseCell, cellKey, isOneStep } from '../engine/positions.js';
import { validateWeeklySplit } from '../engine/pacing.js';
import {
  LEARNING_ROUNDS, REPOSITION_ROUND, CAPEX_ALLOCATION_PAISE, MONTHLY_BUDGET_PAISE,
  DAYPART_BLOCKS,
} from '../engine/constants.js';
import { submitRound, triggersLearning } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import {
  createDraft, toDecision, changes,
  addNegative, dropNegative, blocksTerm,
  addKeyword, updateKeyword, previewNegative,
  setStrategy, setStrategyParam, willTriggerLearning, STRATEGY_PARAM,
  setCapex, setPosition, monthBudgetAfter,
  setWeekBudget, splitProblem, splitOutlook,
  setDaypart, daypartRows,
} from '../ui/decisions.js';

/**
 * The decision form's model, tested without a DOM.
 *
 * The render function needs a browser and is verified by opening one. What is
 * tested here is the part that can be wrong silently: what the form RETURNS.
 *
 * The trap this file exists to hold shut is written down in HANDOVER. A player
 * decision must be RETURNED from a controller, never written into state —
 * `submitRound` is what applies structural changes, writes the learning period
 * 12.3 asks for, and appends to `decisionLog`. Editing a bid directly on
 * `game.state.advertisers[0]` produces a game that runs, looks right, and
 * silently has three mechanics missing.
 */

const STATE = makeGameState();
const selfView = () => getSelfView(STATE, PLAYER_ID);
const publicQueries = () => getPublicView(STATE, PLAYER_ID).querySet;
const player = () => STATE.advertisers.find((a) => a.id === PLAYER_ID);

describe('the draft is built from a view, and cannot reach state (R3a)', () => {
  test('a draft carries the account as it stands', () => {
    const draft = createDraft(selfView());
    expect(draft.keywords.map((k) => k.text))
      .toEqual(player().adGroups[0].keywords.map((k) => k.text));
    expect(draft.negatives).toEqual(player().campaign.negatives ?? []);
  });

  test('mutating a draft changes nothing in the game state', () => {
    // getSelfView deep-copies on the way out, and that is WHY the form is
    // built from it rather than from the advertiser record. This test is the
    // one that would fail if someone "simplified" createDraft to take the
    // advertiser directly.
    const before = structuredClone(player());
    const draft = createDraft(selfView());

    addNegative(draft, { text: 'free', matchType: 'broad' });
    updateKeyword(draft, draft.keywords[0].id, { bidPaise: 99999, active: false });
    draft.keywords[1].text = 'clobbered';
    addKeyword(draft, { text: 'brand new keyword', matchType: 'broad', bidPaise: 4000 });

    expect(player()).toEqual(before);
  });
});

describe('an untouched form decides nothing', () => {
  test('toDecision returns null, exactly as the round-0-only game did', () => {
    // Before slice three the player's controller was `() => null`. An
    // untouched form must be indistinguishable from that, or opening the form
    // and closing it would submit a decision and log it.
    expect(toDecision(createDraft(selfView()))).toBeNull();
    expect(changes(createDraft(selfView()))).toEqual([]);
  });

  test('and a change that is undone returns to null', () => {
    const draft = createDraft(selfView());
    addNegative(draft, { text: 'free', matchType: 'broad' });
    expect(toDecision(draft)).not.toBeNull();
    changes(draft)[0].undo();
    expect(toDecision(draft)).toBeNull();
  });
});

describe('negatives (8.2)', () => {
  test('staging one produces campaign.negatives and nothing else', () => {
    const draft = createDraft(selfView());
    addNegative(draft, { text: 'gym near me', matchType: 'exact' });
    const decision = toDecision(draft);

    expect(Object.keys(decision)).toEqual(['campaign']);
    expect(Object.keys(decision.campaign)).toEqual(['negatives']);
    expect(decision.campaign.negatives).toEqual([{ text: 'gym near me', matchType: 'exact' }]);
  });

  test('existing negatives survive a new one', () => {
    const state = withNegatives([{ text: 'wholesale', matchType: 'broad' }]);
    const draft = createDraft(getSelfView(state, PLAYER_ID));
    addNegative(draft, { text: 'free', matchType: 'broad' });
    expect(toDecision(draft).campaign.negatives).toEqual([
      { text: 'wholesale', matchType: 'broad' },
      { text: 'free', matchType: 'broad' },
    ]);
  });

  test('removing an existing negative is itself a decision', () => {
    const state = withNegatives([{ text: 'wholesale', matchType: 'broad' }]);
    const draft = createDraft(getSelfView(state, PLAYER_ID));
    dropNegative(draft, 0);
    expect(toDecision(draft).campaign.negatives).toEqual([]);
    expect(changes(draft)).toHaveLength(1);
  });

  test('the same negative is not added twice', () => {
    const draft = createDraft(selfView());
    expect(addNegative(draft, { text: 'free', matchType: 'broad' }).added).toBe(true);
    expect(addNegative(draft, { text: ' FREE ', matchType: 'broad' }).added).toBe(false);
    expect(draft.negatives).toHaveLength(1);
  });

  test('an empty negative is refused', () => {
    const draft = createDraft(selfView());
    expect(addNegative(draft, { text: '   ', matchType: 'broad' }).added).toBe(false);
    expect(addNegative(draft, { text: '!!!', matchType: 'phrase' }).added).toBe(false);
  });

  test('the negatives the form writes are the three string types, never a tag', () => {
    // H3. The form offers exactly what 8.2 defines and no fourth option.
    const draft = createDraft(selfView());
    for (const matchType of ['exact', 'phrase', 'broad']) {
      expect(addNegative(draft, { text: `t ${matchType}`, matchType }).added).toBe(true);
    }
    expect(addNegative(draft, { text: 'semantic', matchType: 'tag' }).added).toBe(false);
  });
});

describe('the preview, because a decision must be previewable before it is committed', () => {
  const spent = { q_x: { impressions: 100, clicks: 10, costPaise: 5000, conversions: 0.4 } };

  test('it names exactly what the engine would block, and never guesses', () => {
    // Not a reimplementation of the matcher — it calls the engine's. This test
    // proves that by agreeing with `blockedBy` over the whole frozen set, for
    // every negative type.
    for (const negative of [
      { text: 'free', matchType: 'broad' },
      { text: 'how to', matchType: 'phrase' },
      { text: 'gym near me', matchType: 'exact' },
      { text: 'cheap', matchType: 'broad' },
    ]) {
      const truth = QUERY_SET.queries
        .filter((q) => blockedBy(q, [negative])).map((q) => q.id).sort();
      const preview = previewNegative(negative, { queries: publicQueries(), terms: {} });
      expect(preview.blocked.map((b) => b.id).sort(), negative.text).toEqual(truth);
    }
  });

  test('it warns with money and conversions, not with a count', () => {
    const negative = { text: 'free', matchType: 'broad' };
    const wrinkle = QUERY_SET.queries.find((q) => q.text === 'wrinkle free travel co ord');
    const terms = {
      [wrinkle.id]: { impressions: 900, clicks: 40, costPaise: 120000, conversions: 1.7 },
    };
    const preview = previewNegative(negative, { queries: publicQueries(), terms });

    expect(preview.spent).toHaveLength(1);
    expect(preview.spent[0].text).toBe('wrinkle free travel co ord');
    expect(preview.totals).toEqual({ clicks: 40, costPaise: 120000, conversions: 1.7 });
    // The whole point: this negative reads as pure waste and takes a
    // converting commercial search with it.
    expect(preview.costsConversions).toBe(true);
  });

  test('searches it would block that you have never bought are shown separately', () => {
    const preview = previewNegative({ text: 'free', matchType: 'broad' },
      { queries: publicQueries(), terms: spent });
    expect(preview.spent).toEqual([]);
    expect(preview.unspent.length).toBeGreaterThan(0);
    expect(preview.blocked).toHaveLength(preview.spent.length + preview.unspent.length);
  });

  test('the report shows a row as dead the moment the negative is staged', () => {
    // The cost of a broad negative belongs in the report it was written from,
    // not in next week's numbers.
    const draft = createDraft(selfView());
    const wrinkle = QUERY_SET.queries.find((q) => q.text === 'wrinkle free travel co ord');
    expect(blocksTerm(draft, wrinkle.text)).toBeNull();
    addNegative(draft, { text: 'free', matchType: 'broad' });
    expect(blocksTerm(draft, wrinkle.text)).toEqual({ text: 'free', matchType: 'broad' });
  });

  test('a negative that blocks nothing says so', () => {
    const preview = previewNegative({ text: 'zzzz nothing', matchType: 'broad' },
      { queries: publicQueries(), terms: {} });
    expect(preview.blocked).toEqual([]);
    expect(preview.costsConversions).toBe(false);
  });
});

describe('keywords (bids, match types, adding and pausing)', () => {
  test('a bid change produces adGroups with the ad and its grade intact', () => {
    const draft = createDraft(selfView());
    const id = draft.keywords[0].id;
    updateKeyword(draft, id, { bidPaise: 4321 });
    const decision = toDecision(draft);

    expect(Object.keys(decision)).toEqual(['adGroups']);
    expect(decision.adGroups[0].ad).toEqual(player().adGroups[0].ad);
    expect(decision.adGroups[0].gradedQuality).toEqual(player().adGroups[0].gradedQuality);
    expect(decision.adGroups[0].keywords.find((k) => k.id === id).bidPaise).toBe(4321);
  });

  test('a bid must be a positive integer number of paise (R7)', () => {
    const draft = createDraft(selfView());
    const id = draft.keywords[0].id;
    const was = draft.keywords[0].bidPaise;
    for (const bad of [0, -100, 1.5, NaN, Infinity, '400']) {
      expect(updateKeyword(draft, id, { bidPaise: bad }).ok, String(bad)).toBe(false);
    }
    expect(draft.keywords[0].bidPaise).toBe(was);
  });

  test('pausing a keyword sets active false rather than dropping the row', () => {
    // The row has to stay: a removed keyword takes its quality history and its
    // reason for existing off the screen, and the player can no longer see
    // what it did before they turned it off.
    const draft = createDraft(selfView());
    const id = draft.keywords[0].id;
    updateKeyword(draft, id, { active: false });
    const keywords = toDecision(draft).adGroups[0].keywords;
    expect(keywords).toHaveLength(player().adGroups[0].keywords.length);
    expect(keywords.find((k) => k.id === id).active).toBe(false);
  });

  test('a new keyword is tagged offline as it is typed (8.4)', () => {
    const draft = createDraft(selfView());
    const { ok, keyword } = addKeyword(draft,
      { text: 'high waisted gym leggings', matchType: 'broad', bidPaise: 4000 });

    expect(ok).toBe(true);
    expect(keyword.tags.length).toBeGreaterThan(0);
    expect(keyword.taggedContentHash).toMatch(/^h53:/);
    // Tagged means broad actually reaches something, which is the whole
    // difference 8.4 describes.
    const reached = QUERY_SET.queries.filter((q) => matchesKeyword(q, keyword));
    expect(reached.length).toBeGreaterThan(0);
  });

  test('a keyword the tagger cannot place is flagged as inert on broad', () => {
    const draft = createDraft(selfView());
    const { keyword, inertOnBroad } = addKeyword(draft,
      { text: 'activewear', matchType: 'broad', bidPaise: 4000 });
    expect(keyword.tags).toEqual([]);
    expect(inertOnBroad).toBe(true);
    expect(QUERY_SET.queries.filter((q) => matchesKeyword(q, keyword))).toEqual([]);
  });

  test('a new keyword cannot collide with an id already in the account', () => {
    // qualityHistory is keyed by keyword id. Reusing one would hand a brand
    // new keyword somebody else's history and its reportedScore with it.
    const draft = createDraft(selfView());
    const existing = new Set(draft.keywords.map((k) => k.id));
    addKeyword(draft, { text: 'seamless leggings set', matchType: 'phrase', bidPaise: 4000 });
    const added = draft.keywords[draft.keywords.length - 1];
    expect(existing.has(added.id)).toBe(false);
    expect(added.id).not.toBe(draft.keywords[0].id);
  });

  test('the same keyword text is not added twice', () => {
    const draft = createDraft(selfView());
    const text = draft.keywords[0].text;
    expect(addKeyword(draft, { text, matchType: 'broad', bidPaise: 4000 }).ok).toBe(false);
  });
});

describe('the learning period (12.3)', () => {
  test('no negative, bid, match type or keyword change triggers one', () => {
    const draft = createDraft(selfView());
    addNegative(draft, { text: 'free', matchType: 'broad' });
    updateKeyword(draft, draft.keywords[0].id, { bidPaise: 4321, matchType: 'broad' });
    updateKeyword(draft, draft.keywords[1].id, { active: false });
    addKeyword(draft, { text: 'ribbed seamless leggings', matchType: 'phrase', bidPaise: 3000 });

    // The engine's own predicate, not a restatement of it.
    expect(triggersLearning(player(), toDecision(draft))).toBe(false);
    expect(willTriggerLearning(draft)).toBe(false);
  });

  test('switching strategy triggers one, and the form knows before it is sent', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'targetCpa');
    expect(willTriggerLearning(draft)).toBe(true);
    expect(triggersLearning(player(), toDecision(draft))).toBe(true);
  });

  test('changing the parameter triggers one too', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'targetCpa');
    const decision = toDecision(draft);
    // From a state where targetCpa is already running, so only the number moves.
    const running = withCampaign(decision.campaign);
    const next = createDraft(getSelfView(running, PLAYER_ID));
    expect(willTriggerLearning(next)).toBe(false);

    setStrategyParam(next, next.strategyParams.targetCpaPaise + 5000);
    expect(willTriggerLearning(next)).toBe(true);
    expect(triggersLearning(running.advertisers[0], toDecision(next))).toBe(true);
  });

  test('the form says so in the change it stages, not only after the fact', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'maxConv');
    const [row] = changes(draft);
    expect(row.kind).toBe('strategy');
    expect(row.detail).toMatch(/learning/i);
    expect(row.detail).toContain(String(LEARNING_ROUNDS));
  });

  test('switching away and back again decides nothing', () => {
    const draft = createDraft(selfView());
    const was = draft.strategy;
    setStrategy(draft, 'targetRoas');
    expect(toDecision(draft)).not.toBeNull();
    setStrategy(draft, was);
    expect(toDecision(draft)).toBeNull();
  });
});

describe('the parameter is locked to the strategy that uses it', () => {
  test('STRATEGY_PARAM agrees with the engine about who needs what', () => {
    // The mapping is knowledge about `rawBid`, restated in the view. So it is
    // checked against the engine rather than trusted: a strategy this table
    // says needs a parameter must FAIL without it, and one it says needs none
    // must run on empty params.
    const args = {
      keyword: { bidPaise: 3000 },
      business: { aovMeanPaise: 240000 },
      bidding: { observedConvRate: 0.02, observedConversions: 50 },
      daypartAdjustments: [0, 0, 0, 0, 0, 0],
      hour: 12,
      rng: null,
    };
    for (const [strategy, key] of Object.entries(STRATEGY_PARAM)) {
      expect(Object.keys(STRATEGIES), strategy).toContain(strategy);
      const run = (strategyParams) => effectiveBidPaise({ ...args, strategy, strategyParams });
      if (key) {
        expect(() => run({}), `${strategy} without ${key}`).toThrow();
        expect(() => run({ [key]: key === 'targetRoas' ? 4 : 40000 }), strategy).not.toThrow();
      } else {
        expect(() => run({}), `${strategy} needs nothing`).not.toThrow();
      }
    }
  });

  test('a strategy with no parameter refuses one', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'maxClicks');
    expect(setStrategyParam(draft, 50000).ok).toBe(false);
  });

  test('a target CPA is whole paise above zero (R7)', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'targetCpa');
    const was = draft.strategyParams.targetCpaPaise;
    for (const bad of [0, -1, 1.5, NaN, Infinity, '40000']) {
      expect(setStrategyParam(draft, bad).ok, String(bad)).toBe(false);
    }
    expect(draft.strategyParams.targetCpaPaise).toBe(was);
    expect(setStrategyParam(draft, 55000).ok).toBe(true);
  });

  test('a target ROAS is a positive ratio, and may be fractional', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'targetRoas');
    for (const bad of [0, -2, NaN, Infinity, '4']) {
      expect(setStrategyParam(draft, bad).ok, String(bad)).toBe(false);
    }
    expect(setStrategyParam(draft, 3.5).ok).toBe(true);
    expect(draft.strategyParams.targetRoas).toBe(3.5);
  });

  test('the unused parameter is carried through untouched', () => {
    // applyDecision merges `campaign` shallowly, so a strategyParams object
    // missing a key REPLACES the stored one and loses it. A later switch to
    // that strategy would then throw inside rawBid.
    const draft = createDraft(selfView());
    const roasWas = draft.strategyParams.targetRoas;
    setStrategy(draft, 'targetCpa');
    setStrategyParam(draft, 61000);

    const params = toDecision(draft).campaign.strategyParams;
    expect(params.targetCpaPaise).toBe(61000);
    expect(params.targetRoas).toBe(roasWas);
  });
});

describe('capital and position, one round each (13.3, 4.5)', () => {
  const atFive = () => makeGameState({ round: REPOSITION_ROUND });
  const draftAt = (state) => createDraft(getSelfView(state, PLAYER_ID),
    { allocationRounds: state.budgetSchedule.capexAllocationRounds });

  test('neither is offered in an ordinary round', () => {
    const draft = draftAt(makeGameState({ round: 3 }));
    expect(draft.capexOpen).toBe(false);
    expect(draft.repositionOpen).toBe(false);
    expect(toDecision(draft)).toBeNull();
  });

  test('the first allocation round is not offered either, because round 0 spent it', () => {
    // setup.js already wrote remainingUnallocatedPaise from the round 0
    // choices. Asking again in round 1 would hand the player the rollover on
    // top of an investment they have already made.
    const state = makeGameState({ round: 1 });
    expect(state.budgetSchedule.capexAllocationRounds[0]).toBe(1);
    expect(draftAt(state).capexOpen).toBe(false);
  });

  test('an untouched round 5 still claims the allocation, as an explicit zero', () => {
    // Omitting `capex` does not mean "decline". It means the allocation is
    // never claimed and ₹1,00,000 disappears: no investment AND no rollover.
    const decision = toDecision(draftAt(atFive()));
    expect(decision.capex).toEqual({ sizeGuide: 0, photography: 0, landingPage: 0 });
  });

  test('and it is listed as a decision, because it is one', () => {
    const rows = changes(draftAt(atFive()));
    const capital = rows.find((r) => r.kind === 'capital');
    expect(capital).toBeDefined();
    expect(capital.undo).toBeNull();       // the default is the decision
    expect(capital.detail).toMatch(/advertising budget/);
  });

  test('an allocation may not exceed what is available', () => {
    const draft = draftAt(atFive());
    expect(setCapex(draft, 'photography', CAPEX_ALLOCATION_PAISE).ok).toBe(true);
    expect(setCapex(draft, 'sizeGuide', 1).ok).toBe(false);
    expect(setCapex(draft, 'photography', CAPEX_ALLOCATION_PAISE + 1).ok).toBe(false);
    expect(setCapex(draft, 'billboards', 100).ok).toBe(false);
    expect(draft.capex.photography).toBe(CAPEX_ALLOCATION_PAISE);
  });

  test('capital cannot be committed when the window is shut', () => {
    const draft = draftAt(makeGameState({ round: 3 }));
    expect(setCapex(draft, 'photography', 100).ok).toBe(false);
  });

  test('the grid allows one step and refuses two', () => {
    const draft = draftAt(atFive());
    const from = draft.base.position;
    for (const cell of allCells()) {
      const to = parseCell(cell);
      const same = to.price === from.price && to.purpose === from.purpose;
      // The engine's own rule, not a restatement of it.
      expect(setPosition(draft, cell).ok, cell).toBe(same || isOneStep(from, to));
      setPosition(draft, cellKey(from.price, from.purpose));
    }
  });

  test('repositioning triggers a learning period, and the form knows first', () => {
    const draft = draftAt(atFive());
    const from = draft.base.position;
    const step = allCells().map(parseCell).find((c) => isOneStep(from, c));
    setPosition(draft, cellKey(step.price, step.purpose));

    expect(willTriggerLearning(draft)).toBe(true);
    const row = changes(draft).find((r) => r.kind === 'position');
    expect(row.detail).toMatch(/learning/i);
    expect(row.detail).toMatch(/Quality Score/i);
  });

  test('moving back to where you started decides nothing', () => {
    const draft = draftAt(atFive());
    const from = draft.base.position;
    const step = allCells().map(parseCell).find((c) => isOneStep(from, c));
    setPosition(draft, cellKey(step.price, step.purpose));
    expect(toDecision(draft).position).toBeDefined();
    setPosition(draft, cellKey(from.price, from.purpose));
    expect(toDecision(draft).position).toBeUndefined();
  });

  test('repositioning is refused outside the window', () => {
    const draft = draftAt(makeGameState({ round: 3 }));
    expect(setPosition(draft, 'value|lifestyle').ok).toBe(false);
  });
});

describe('the month the two of them leave you', () => {
  const atFive = () => makeGameState({ round: REPOSITION_ROUND });
  const draftAt = (state) => createDraft(getSelfView(state, PLAYER_ID),
    { allocationRounds: state.budgetSchedule.capexAllocationRounds });

  /**
   * `monthBudgetAfter` mirrors `applyBudgetAdjustments`, which is a drift risk.
   * So it is checked against what the round actually reports, for every
   * combination of the two decisions that interact.
   */
  const cases = [
    ['nothing committed, staying put', (d) => d],
    ['everything committed', (d) => { setCapex(d, 'photography', CAPEX_ALLOCATION_PAISE); return d; }],
    ['half committed', (d) => { setCapex(d, 'sizeGuide', CAPEX_ALLOCATION_PAISE / 2); return d; }],
    ['moving, nothing committed', (d) => { setPosition(d, oneStepFrom(d)); return d; }],
    ['moving AND committing everything', (d) => {
      setCapex(d, 'landingPage', CAPEX_ALLOCATION_PAISE);
      setPosition(d, oneStepFrom(d));
      return d;
    }],
  ];

  for (const [name, arrange] of cases) {
    test(`agrees with the round: ${name}`, () => {
      const state = atFive();
      const draft = arrange(draftAt(state));
      const predicted = monthBudgetAfter(draft);

      const out = submitRound(state, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' });
      expect(out.report.byAdvertiser[PLAYER_ID].budget.monthlyBudgetPaise).toBe(predicted);
    });
  }

  function oneStepFrom(draft) {
    const from = draft.base.position;
    const to = allCells().map(parseCell).find((c) => isOneStep(from, c));
    return cellKey(to.price, to.purpose);
  }
});

describe('the weekly split (13.4)', () => {
  const draftAt = (state) => createDraft(getSelfView(state, PLAYER_ID),
    { allocationRounds: state.budgetSchedule.capexAllocationRounds });

  test('the draft knows which week the next round is', () => {
    // buildBudgets reads split[(round - 1) % ROUNDS_PER_MONTH], so week 1 of a
    // month is index 0 and the form has to point at the right box.
    expect(draftAt(makeGameState({ round: 1 })).weekIndex).toBe(0);
    expect(draftAt(makeGameState({ round: 3 })).weekIndex).toBe(2);
    expect(draftAt(makeGameState({ round: 5 })).weekIndex).toBe(0);
    expect(draftAt(makeGameState({ round: 8 })).weekIndex).toBe(3);
  });

  test('changing a week produces campaign.weeklySplitPaise and nothing else', () => {
    const draft = draftAt(makeGameState({ round: 2 }));
    expect(setWeekBudget(draft, 3, 5000000).ok).toBe(true);
    const decision = toDecision(draft);
    expect(Object.keys(decision)).toEqual(['campaign']);
    expect(Object.keys(decision.campaign)).toEqual(['weeklySplitPaise']);
    expect(decision.campaign.weeklySplitPaise[3]).toBe(5000000);
  });

  test('a week that has already run cannot be re-planned', () => {
    // Editing it changes nothing in the engine - buildBudgets only ever reads
    // the current index - so offering it would be a control that does nothing.
    const draft = draftAt(makeGameState({ round: 3 }));
    const was = draft.weeklySplitPaise[0];
    expect(setWeekBudget(draft, 0, 1).ok).toBe(false);
    expect(setWeekBudget(draft, 1, 1).ok).toBe(false);
    expect(draft.weeklySplitPaise[0]).toBe(was);
    expect(setWeekBudget(draft, 2, 1).ok).toBe(true);
  });

  test('a week is whole paise, and zero is allowed because going dark is a play', () => {
    const draft = draftAt(makeGameState({ round: 1 }));
    for (const bad of [-1, 1.5, NaN, Infinity, '400']) {
      expect(setWeekBudget(draft, 2, bad).ok, String(bad)).toBe(false);
    }
    expect(setWeekBudget(draft, 2, 0).ok).toBe(true);
  });

  test('a split over the month is allowed, and warned about in rupees', () => {
    // 13.2 makes the month a hard cap and says outright that burning the pot
    // early is a player-caused, visible, forecastable cliff. So the form warns
    // rather than refuses. R7 puts formatting at the display layer: the
    // validator's own message quotes raw paise because it is written for a
    // thrown error, and piping it to screen showed "totals 35100000 paise".
    const draft = draftAt(makeGameState({ round: 1 }));
    setWeekBudget(draft, 3, MONTHLY_BUDGET_PAISE);
    expect(toDecision(draft)).not.toBeNull();
    expect(splitProblem(draft)).toMatch(/₹/);
    expect(splitProblem(draft)).not.toMatch(/paise/);
  });

  test('at the top of a month it agrees with the engine, which is where the engine has an opinion', () => {
    // splitProblem compares the plan for the weeks STILL TO RUN against what is
    // left of the month. At week 1 nothing has run, so it collapses to exactly
    // the rule validateWeeklySplit enforces at round 0 — and must agree with it.
    const draft = draftAt(makeGameState({ round: 1 }));
    const agrees = () => expect(splitProblem(draft) === null)
      .toBe(validateWeeklySplit(draft.weeklySplitPaise, draft.monthlyBudgetPaise).valid);

    agrees();
    setWeekBudget(draft, 3, MONTHLY_BUDGET_PAISE);
    agrees();
    setWeekBudget(draft, 3, 0);
    agrees();
  });

  test('and mid-month it forgives weeks that came in under their plan', () => {
    // The case that was crying wolf on screen: two weeks planned at their share
    // and spent a fraction of it leave MORE in the pot, not less, so the whole
    // split exceeding the whole month says nothing the player can act on.
    let state = makeGameState({ round: 1 });
    state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    state = submitRound(state, {}, { mode: 'expected' }).nextGameState;

    const draft = draftAt(state);
    expect(draft.weekIndex).toBe(2);
    expect(draft.monthSpentPaise).toBeGreaterThan(0);
    // Plan every remaining rupee and not one more.
    setWeekBudget(draft, 2, splitOutlook(draft).remainingPaise - draft.weeklySplitPaise[3]);
    expect(validateWeeklySplit(draft.weeklySplitPaise, draft.monthlyBudgetPaise).valid).toBe(false);
    expect(splitProblem(draft)).toBeNull();
  });

  test('changing the budget does not trigger a learning period (12.3)', () => {
    const state = makeGameState({ round: 2 });
    const draft = draftAt(state);
    setWeekBudget(draft, 2, 4000000);
    expect(willTriggerLearning(draft)).toBe(false);
    expect(triggersLearning(state.advertisers[0], toDecision(draft))).toBe(false);
  });

  test('the round spends what the week was set to', () => {
    const state = makeGameState({ round: 2 });
    const draft = draftAt(state);
    setWeekBudget(draft, 1, 2500000);
    const out = submitRound(state, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' });
    expect(out.report.byAdvertiser[PLAYER_ID].budget.weeklySplitPaise[1]).toBe(2500000);
  });

  test('and the month boundary flattens it again, which the form must say', () => {
    // advanceCampaign RESETS weeklySplitPaise to an even split whenever a month
    // turns over, because the month's total may have changed. A player's shape
    // does not survive it. This is the trap item 6 exists to make visible.
    let state = makeGameState({ round: 3 });
    const draft = draftAt(state);
    setWeekBudget(draft, 3, 100000);
    state = submitRound(state, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' }).nextGameState;
    expect(state.advertisers[0].campaign.weeklySplitPaise[3]).toBe(100000);

    state = submitRound(state, {}, { mode: 'expected' }).nextGameState;   // round 4 -> 5
    const fresh = state.advertisers[0].campaign.weeklySplitPaise;
    expect(state.round).toBe(5);
    expect(new Set(fresh).size).toBeLessThanOrEqual(2);   // even, give or take the remainder
    expect(fresh[3]).not.toBe(100000);
  });
});

describe('dayparting (13.4, H4)', () => {
  const hourly = (per) => Array.from({ length: 24 }, (_, hour) => per(hour));
  const withHours = (observedByHour) => ({
    ...STATE,
    advertisers: STATE.advertisers.map((a) => (a.id === PLAYER_ID
      ? { ...a, bidding: { ...a.bidding, observedByHour } }
      : a)),
  });
  const draftOf = (state) => createDraft(getSelfView(state, PLAYER_ID));

  test('the blocks are the engine\'s, and they carry the player\'s own hours', () => {
    // observedByHour is cumulative clicks and LANDED conversions per hour of
    // day — the advertiser's own measurement, in getSelfView, and the only
    // honest basis for a dayparting decision. HOUR_PROFILES and
    // HOURLY_INTENT_CURVE are the model and are never shown.
    const draft = draftOf(withHours(hourly((h) => ({ clicks: 100, conversions: h < 12 ? 2 : 8 }))));
    const rows = daypartRows(draft);

    expect(rows).toHaveLength(DAYPART_BLOCKS.length);
    expect(rows.map((r) => r.label)).toEqual(DAYPART_BLOCKS.map((b) => b.label));
    const afternoon = rows.find((r) => r.label === 'Afternoon');
    expect(afternoon.clicks).toBe(500);          // 12..17
    expect(afternoon.conversions).toBe(40);
    expect(afternoon.rate).toBeCloseTo(0.08, 9);
    expect(rows.find((r) => r.label === 'Late night').rate).toBeCloseTo(0.02, 9);
  });

  test('a block with too few clicks to judge says so', () => {
    const thin = draftOf(withHours(hourly(() => ({ clicks: 1, conversions: 0 }))));
    expect(daypartRows(thin).every((r) => r.thin)).toBe(true);

    const thick = draftOf(withHours(hourly(() => ({ clicks: 500, conversions: 20 }))));
    expect(daypartRows(thick).some((r) => r.thin)).toBe(false);
  });

  test('an account that has run nothing yet has no hours to show', () => {
    const draft = draftOf(withHours(null));
    expect(daypartRows(draft).every((r) => r.clicks === 0 && r.rate === null)).toBe(true);
  });

  test('every row reports the multiplier the ENGINE will apply', () => {
    // Not a restatement of `1 + percent / 100`. The engine's own
    // daypartMultiplier decides what a bid gets multiplied by, including its
    // floor at zero, and the row has to agree with it for every hour of the
    // block or the card is describing a different game.
    const draft = draftOf(STATE);
    [-100, -30, 0, 45, 250].forEach((percent, i) => setDaypart(draft, i, percent));

    for (const row of daypartRows(draft)) {
      for (let hour = row.start; hour < row.end; hour++) {
        expect(row.multiplier, `${row.label} h${hour}`)
          .toBeCloseTo(daypartMultiplier(draft.daypartAdjustments, hour), 12);
      }
    }
  });

  test('an adjustment is a whole percentage inside the range the engine can use', () => {
    const draft = draftOf(STATE);
    for (const bad of [-101, 1.5, NaN, Infinity, '50', 1000]) {
      expect(setDaypart(draft, 0, bad).ok, String(bad)).toBe(false);
    }
    expect(setDaypart(draft, 9, 10).ok).toBe(false);      // no such block
    expect(setDaypart(draft, 0, -100).ok).toBe(true);
    expect(draft.daypartAdjustments[0]).toBe(-100);
  });

  test('changing one produces campaign.daypartAdjustments and nothing else', () => {
    const draft = draftOf(STATE);
    setDaypart(draft, 3, 40);
    const decision = toDecision(draft);
    expect(Object.keys(decision)).toEqual(['campaign']);
    expect(Object.keys(decision.campaign)).toEqual(['daypartAdjustments']);
    expect(decision.campaign.daypartAdjustments[3]).toBe(40);
  });

  test('and it does not trigger a learning period (12.3)', () => {
    const draft = draftOf(STATE);
    setDaypart(draft, 3, 40);
    expect(willTriggerLearning(draft)).toBe(false);
    expect(triggersLearning(player(), toDecision(draft))).toBe(false);
  });

  test('turning every block down to the floor all but stops the account', () => {
    // -100% takes the multiplier to zero, and effectiveBidPaise then clamps to
    // MIN_BID_PAISE rather than to nothing — so it is not an off switch, it is
    // a bid of ₹1. That lands below the ad rank floor, which is why it behaves
    // like one. The card says "the minimum", not "off".
    const draft = draftOf(STATE);
    for (let i = 0; i < DAYPART_BLOCKS.length; i++) setDaypart(draft, i, -100);

    const before = submitRound(STATE, {}, { mode: 'expected' });
    const after = submitRound(STATE, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' });
    const impressions = (r) => r.report.byAdvertiser[PLAYER_ID].traffic.impressions;

    expect(impressions(before)).toBeGreaterThan(0);
    expect(impressions(after)).toBeLessThan(impressions(before) * 0.01);
  });

  test('and raising a block raises what it spends there', () => {
    const draft = draftOf(STATE);
    const evening = DAYPART_BLOCKS.findIndex((b) => b.label === 'Evening');
    setDaypart(draft, evening, 100);

    const before = submitRound(STATE, {}, { mode: 'expected' });
    const after = submitRound(STATE, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' });
    const cost = (r) => r.report.byAdvertiser[PLAYER_ID].traffic.costPaise;
    expect(cost(after)).toBeGreaterThan(cost(before));
  });
});

describe('the round actually receives it', () => {
  test('a staged negative removes that search from next week entirely', () => {
    const before = submitRound(STATE, {}, { mode: 'expected', seed: 7 });

    // Whatever this account actually buys most of, rather than a query chosen
    // by hand — the fixture's keyword coverage is not this test's business.
    const [targetId] = Object.entries(before.report.byAdvertiser[PLAYER_ID].breakdown.byQuery)
      .sort((a, b) => b[1].impressions - a[1].impressions)[0];
    const target = QUERY_SET.queries.find((q) => q.id === targetId);

    const draft = createDraft(selfView());
    addNegative(draft, { text: target.text, matchType: 'exact' });
    const after = submitRound(STATE, { [PLAYER_ID]: toDecision(draft) },
      { mode: 'expected', seed: 7 });

    const rowBefore = before.report.byAdvertiser[PLAYER_ID].breakdown.byQuery[target.id];
    const rowAfter = after.report.byAdvertiser[PLAYER_ID].breakdown.byQuery[target.id];

    // 8.5: a blocked query is not eligible, so it leaves the denominator too.
    expect(rowBefore?.impressions ?? 0).toBeGreaterThan(0);
    expect(rowAfter?.impressions ?? 0).toBe(0);
    expect(after.report.byAdvertiser[PLAYER_ID].traffic.eligibleAuctions)
      .toBeLessThan(before.report.byAdvertiser[PLAYER_ID].traffic.eligibleAuctions);
  });

  test('a strategy change arrives as a real learning period', () => {
    const draft = createDraft(selfView());
    setStrategy(draft, 'targetCpa');
    setStrategyParam(draft, 50000);

    const out = submitRound(STATE, { [PLAYER_ID]: toDecision(draft) }, { mode: 'expected' });
    const after = out.nextGameState.advertisers.find((a) => a.id === PLAYER_ID);

    expect(after.campaign.strategy).toBe('targetCpa');
    expect(after.campaign.strategyParams.targetCpaPaise).toBe(50000);
    // Written by submitRound, then decremented once by the round it started in.
    expect(after.bidding.learningRoundsRemaining).toBe(LEARNING_ROUNDS - 1);
  });

  test('and a round that changes nothing starts no learning period', () => {
    const out = submitRound(STATE, { [PLAYER_ID]: toDecision(createDraft(selfView())) },
      { mode: 'expected' });
    const after = out.nextGameState.advertisers.find((a) => a.id === PLAYER_ID);
    expect(after.bidding.learningRoundsRemaining).toBe(0);
  });

  test('and the decision is logged, which is what makes 12.4 replayable', () => {
    const draft = createDraft(selfView());
    addNegative(draft, { text: 'free', matchType: 'broad' });
    const out = submitRound(STATE, { [PLAYER_ID]: toDecision(draft) },
      { mode: 'expected', sources: { [PLAYER_ID]: 'player' } });

    const logged = out.nextGameState.decisionLog.filter((e) => e.advertiserId === PLAYER_ID);
    expect(logged).toHaveLength(1);
    expect(logged[0].decision.campaign.negatives).toEqual([{ text: 'free', matchType: 'broad' }]);
  });
});

// ---------------------------------------------------------------------------

function withCampaign(patch) {
  return {
    ...STATE,
    advertisers: STATE.advertisers.map((a) => (a.id === PLAYER_ID
      ? { ...a, campaign: { ...a.campaign, ...patch } }
      : a)),
  };
}

const withNegatives = (negatives) => withCampaign({ negatives });
