import { describe, test, expect } from 'vitest';
import { getSelfView, getPublicView } from '../engine/insights.js';
import { blockedBy, matchesKeyword } from '../engine/matching.js';
import { submitRound, triggersLearning } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import {
  createDraft, toDecision, changes,
  addNegative, dropNegative, blocksTerm,
  addKeyword, updateKeyword, previewNegative,
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

describe('what the form must NOT do to the learning period (12.3)', () => {
  test('no negative, bid, match type or keyword change triggers one', () => {
    const draft = createDraft(selfView());
    addNegative(draft, { text: 'free', matchType: 'broad' });
    updateKeyword(draft, draft.keywords[0].id, { bidPaise: 4321, matchType: 'broad' });
    updateKeyword(draft, draft.keywords[1].id, { active: false });
    addKeyword(draft, { text: 'ribbed seamless leggings', matchType: 'phrase', bidPaise: 3000 });

    // The engine's own predicate, not a restatement of it.
    expect(triggersLearning(player(), toDecision(draft))).toBe(false);
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

function withNegatives(negatives) {
  return {
    ...STATE,
    advertisers: STATE.advertisers.map((a) => (a.id === PLAYER_ID
      ? { ...a, campaign: { ...a.campaign, negatives } }
      : a)),
  };
}
