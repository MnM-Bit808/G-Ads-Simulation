/**
 * Round 0 (spec 17). The phase that turns a spec into a game.
 *
 * WHY THIS IS NOT IN engine/
 *
 * Round 0 chooses things. The engine resolves auctions and has no business
 * knowing that brands have names, that ad copy signals a price tier, or that a
 * player exists — R6 says there is one advertiser type and no privileged player
 * path anywhere in it. So placement, identities, the briefing and the player's
 * opening decisions all live out here with `game.js`, in the caller layer.
 *
 * WHY THIS IS NOT IN game.js EITHER
 *
 * Different lifecycles. `game.js` runs the loop, once per round, and imports
 * nothing from `content/`. This runs once, before the loop, and is almost
 * entirely about content: which brands exist, what their ads say, which cells
 * they occupy. Keeping them apart keeps the round loop free of the query set.
 *
 * WHAT ROUND 0 HAS TO GET RIGHT
 *
 * Spec 17's ordering exists to remove a circular dependency: the query set is
 * validated before anyone reads it, the player takes an identity before rivals
 * are placed, and rivals are placed before the briefing that describes the
 * market they now constitute. Nothing here is deferred and nothing is guessed.
 *
 * STEP 12 IS NOT OPTIONAL
 *
 * "Grade + tag player assets -> round 1" is the last line of 17's own diagram,
 * and both halves turned out to matter more than the safe-degradation clauses
 * suggest. An ungraded ad grades 3/3/3, which sits below AD_RANK_FLOOR at any
 * cautious bid, so the player entered every auction and showed in none
 * (DECISIONS A8). An untagged keyword is inert on broad (8.4) while every rival
 * is tagged at placement — broad match working for eight advertisers and not
 * the ninth, in a game about match types.
 *
 * Both now run here, OFFLINE, so round 0 completes with no API key and the
 * suite stays network-free. `agents/grader.js` and `agents/keywordTagger.js`
 * take their transport as an argument; a caller with a key can pass one and get
 * a better grade and better tags for the same interface.
 */

import {
  ADVERTISER_COUNT, MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, SCHEMA_VERSION,
  RIVAL_PLACEMENT_CONSTRAINTS, POSITION_ECONOMICS,
  CAPEX_ALLOCATION_PAISE, CAPEX_TARGETS, CAPEX_TIER_CURVE, CAPEX_DELAY_ROUNDS, RANK_BUDGET_MULTIPLIERS,
  PRICE_TIERS, PURPOSES, TOTAL_ROUNDS, QUERY_SET_RULES,
  CREATIVE_ALLOCATION_PAISE, CREATIVE_DIY_LIVE_ROUND,
  LOCATION_TIERS, LOCATION_VOLUME_BY_PRICE,
} from './engine/constants.js';
import { mulberry32, deriveSeed } from './engine/rng.js';
import { allCells, cellKey, parseCell, businessFor, breakEvenCpcPaise } from './engine/positions.js';
import { assertValidQuerySet, homeCell } from './engine/querySet.js';
import { validateWeeklySplit } from './engine/pacing.js';
import { allocate, mulRate, formatINR } from './engine/money.js';
import { assignIdentities, BRAND_IDENTITIES } from './content/brands.js';
import { LOCATIONS } from './content/locations.js';
import { adCopyFor, RIVAL_GRADE_VARIATION } from './content/adCopy.js';
import { gradeAdOffline } from './agents/grader.js';
import { RIVAL_CAST } from './agents/policies.js';
import {
  isDiy, openingCopyGrades, creativeSpend, tierForPolicy,
} from './content/writers.js';
import { tagKeywordsOffline } from './agents/keywordTagger.js';

const REDO_DEADLINE_ROUND = 3;

// ---------------------------------------------------------------------------
// 17.1  Rival placement
// ---------------------------------------------------------------------------

/**
 * Place the eight rivals into cells, seeded and constrained.
 *
 * CONSTRUCTIVE, NOT REJECTION-SAMPLED. The obvious implementation shuffles,
 * checks `RIVAL_PLACEMENT_CONSTRAINTS`, and retries until it passes — which
 * terminates in practice and has no bound in principle, inside a function the
 * spec requires to be deterministic. This one satisfies the constraints first
 * and fills the remainder afterwards, so it always finishes and always passes.
 *
 * The constraints exist because unconstrained placement occasionally drops all
 * eight rivals into one tier, and a market with nothing above Value makes the
 * player's round 0 choice a no-brainer rather than a decision.
 *
 * With eight rivals over six cells and at most two per cell, at least two cells
 * double up and at most one is left open. Taking an open cell is a legitimate
 * strategy (17.1) and this must be able to produce one.
 *
 * @param {number} rootSeed
 * @param {number} [count] rivals to place
 * @returns {string[]} a cell key per rival, in roster order
 */
export function placeRivals(rootSeed, count = ADVERTISER_COUNT - 1) {
  const { maxPerCell } = RIVAL_PLACEMENT_CONSTRAINTS;
  const rng = mulberry32(deriveSeed(rootSeed, 'rival-placement'));
  const cells = allCells();

  // How many cells to leave open. 17.1 wants at most one: an open cell has to
  // be POSSIBLE for "taking an open cell is a legitimate strategy" to mean
  // anything, and more than one leaves a third of the grid uncontested.
  //
  // Purely random placement does not give that. Eight rivals at two per cell
  // fit into four, so an unguided draw regularly leaves TWO cells empty, and
  // the spec's own arithmetic - "at least two cells double up and at most one
  // stays open" - assumes a spread it never asked for.
  const openCount = rng() < 0.5 ? 1 : 0;
  const order = shuffled(cells, rng);
  const pool = order.slice(0, cells.length - openCount);

  // One each first, so every cell in the pool is genuinely occupied, then the
  // remainder doubles cells up. This also satisfies the tier and purpose
  // constraints by construction: five of six cells always span all three price
  // tiers and both purposes.
  const placed = pool.slice(0, count);
  const used = new Map(pool.map((c) => [c, placed.filter((x) => x === c).length]));

  while (placed.length < count) {
    const room = pool.filter((c) => used.get(c) < maxPerCell);
    const cell = room[Math.floor(rng() * room.length)];
    used.set(cell, used.get(cell) + 1);
    placed.push(cell);
  }

  return placed;
}

/** Fisher-Yates, seeded, leaving the input untouched (R1). */
function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Does a placement satisfy every constraint? Exported so a test can check the
 * rule rather than re-implement it.
 *
 * @param {string[]} placement
 * @returns {{valid: boolean, reason: string|null}}
 */
export function placementIsLegal(placement) {
  const { minPriceTiers, requireBothPurposes, maxPerCell } = RIVAL_PLACEMENT_CONSTRAINTS;
  const tiers = new Set(placement.map((c) => parseCell(c).price));
  if (tiers.size < minPriceTiers) {
    return { valid: false, reason: `spans ${tiers.size} price tiers, needs ${minPriceTiers}` };
  }
  const purposes = new Set(placement.map((c) => parseCell(c).purpose));
  if (requireBothPurposes && purposes.size < PURPOSES.length) {
    return { valid: false, reason: `spans ${purposes.size} purposes, needs both` };
  }
  for (const cell of new Set(placement)) {
    const n = placement.filter((c) => c === cell).length;
    if (n > maxPerCell) return { valid: false, reason: `${n} rivals in ${cell}, max ${maxPerCell}` };
  }
  return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// 17.1 step 4  Rival accounts
// ---------------------------------------------------------------------------

/**
 * Who writes this advertiser's ad, and what that leaves it holding.
 *
 * ONE PATH FOR EVERYBODY (R6). The player and all eight rivals come through
 * here, so a rival cannot get a grade by a route the player has no access to —
 * which matters more than usual, because 17.1 makes the eight ads the only
 * thing the player can observe about a rival at all.
 *
 * Hiring is immediate: the grade is what the tier guarantees, shaped by the
 * advertiser's own lean so two buyers of one tier are still different ads.
 * Writing it yourself is DELAYED, never faded: the copy is graded now, held in
 * `pendingGrade`, and applied whole at `liveAtRound`. Until then the advertiser
 * runs the ungraded default (9.5), which is what makes the delay cost anything.
 *
 * A WRITER WRITES COPY, so a tier only ever sets `expectedCtr` and
 * `adRelevance`. `landingPage` is passed in and never touched here: for a rival
 * it is their authored character, and for the player it is graded from the page
 * their CAPITAL built (I9). Letting a copywriter move it would be the same
 * double-model the landing page builder was written to remove.
 *
 * @param {object} args
 * @param {string} args.tierId
 * @param {number} args.bias -1, 0 or +1; this advertiser's lean
 * @param {number} args.landingPage graded elsewhere, carried through untouched
 * @param {object} args.ad the copy, graded only if nobody was hired
 * @param {object[]} args.keywords what adRelevance is measured against
 * @param {object} [args.writtenGrade] a grade already computed for this ad, so
 *   a caller that needed it anyway does not pay to grade the same copy twice
 * @returns {object} the advertiser's `creative` block plus its opening grade.
 *   The grades carry COMPONENTS ONLY: `gradedAtRound`, `contentHash` and
 *   `source` are 5.2's caching metadata and belong to whoever owns the ad, so
 *   callers merge them. Dropping them would make every ad look unregraded.
 */
function creativeBlock({ tierId, bias = 0, landingPage, ad, keywords, writtenGrade }) {
  const { pricePaise, unspentPaise } = creativeSpend(tierId, CREATIVE_ALLOCATION_PAISE);
  const base = { tier: tierId, spentPaise: pricePaise, unspentPaise };

  // One source for "what grade does this advertiser open on", because round 0's
  // reserve warning needs the same answer and a second copy of it would drift.
  const opening = { ...openingCopyGrades(tierId, bias), landingPage };

  if (!isDiy(tierId)) {
    return {
      ...base,
      liveAtRound: 1,
      pendingGrade: null,
      openingGrade: opening,
    };
  }

  const written = writtenGrade ?? gradeAdOffline(ad, { keywords }, 0);
  return {
    ...base,
    liveAtRound: CREATIVE_DIY_LIVE_ROUND,
    // Graded now, applied later. The grade cannot depend on when it lands, or
    // an advertiser could improve by doing nothing but waiting.
    pendingGrade: {
      expectedCtr: written.expectedCtr, adRelevance: written.adRelevance, landingPage,
    },
    // The ungraded default until it ships (9.5). This is the cost of writing it
    // yourself, and the entire reason hiring anyone is worth paying for.
    openingGrade: opening,
  };
}

/**
 * Build one rival: keywords, ad, grade, capex, weekly split.
 *
 * COLD START, like the player. `observedConvRate` is null and
 * `observedConversions` is zero, because round 1 is genuinely everyone's first
 * round. Seeding rivals with plausible history would make them competent from
 * round 1 and hand them an advantage the player cannot see or attribute — and
 * the cold-start error (12.2) is one of the things the sim exists to teach.
 *
 * CAPEX IS SEEDED, WITH A TILT. DECISIONS D7 argues Value should invest, since
 * it has conversions to spare and the worst returns problem, and Premium often
 * should not, since it is data-starved and needs every round before the round-8
 * snapshot. So Value rivals invest more often than Premium ones — but the draw
 * is random, so some of them get it wrong. A market where every rival invests
 * correctly would demonstrate the lesson rather than leave it discoverable.
 *
 * @param {object} identity from content/brands.js
 * @param {string} cell
 * @param {number} index roster position, for the grade
 * @param {object} querySet
 * @param {() => number} rng seeded
 * @returns {object} an Advertiser
 */
export function buildRival(identity, cell, index, querySet, rng, variant = 0) {
  const position = { ...parseCell(cell), setAtRound: 0, repositionedAtRound: null };
  const capex = rivalCapex(position, rng);
  const business = businessFor(position, capex, 1);
  const policyId = RIVAL_CAST[(index - 1 + RIVAL_CAST.length) % RIVAL_CAST.length];
  const rivalAd = adCopyFor(cell, variant);
  const keywords = rivalKeywords(cell, querySet, business, rng);
  const character = RIVAL_GRADE_VARIATION[index % RIVAL_GRADE_VARIATION.length];
  const creative = creativeBlock({
    tierId: tierForPolicy(policyId),
    // Sign only: whether this rival has always been better at earning the click
    // than at answering the search. The magnitude would re-import the absolute
    // grades the tier is there to replace.
    bias: Math.sign(character.expectedCtr - character.adRelevance),
    landingPage: character.landingPage,
    ad: rivalAd,
    keywords,
  });

  return {
    id: identity.id,
    name: identity.name,
    domain: identity.domain,
    controller: 'policy',
    // Dealt from RIVAL_CAST by `buildRivals`, not left for a caller to
    // remember. It used to be null here, and the one caller that filled it in
    // did so by index without writing it back — so every real game ran with
    // policyId null, and any harness keying off it got a market that never
    // bid back. A field that is live only when the caller remembers is a field
    // that is sometimes silently dead.
    policyId,
    active: true,
    position,
    capex,
    campaign: {
      // Whatever the writer did not cost is advertising money instead. Unlike
      // capital this needs no allocation round: the writer is chosen at round 0,
      // so the money is in the budget from round 1.
      monthlyBudgetPaise: MONTHLY_BUDGET_PAISE + creative.unspentPaise,
      monthSpentPaise: 0,
      weeklySplitPaise: allocate(
        MONTHLY_BUDGET_PAISE + creative.unspentPaise, new Array(ROUNDS_PER_MONTH).fill(1),
      ),
      strategy: 'manual',
      strategyParams: { targetCpaPaise: Math.round(breakEvenCpcPaise(business) * 12), targetRoas: 4.0 },
      daypartAdjustments: [0, 0, 0, 0, 0, 0],
      // Running everywhere, at the same bid everywhere. Neutral rather than
      // absent so the shape is always the one the engine expects, and so the
      // round's flat-market fast path is the default rather than a special case.
      locationAdjustments: [0, 0, 0],
      // I34: what a prepaid order is discounted by, in paise. Zero is "cash is
      // fine", which is where every advertiser starts.
      prepaidDiscountPaise: 0,
      negatives: [],
    },
    adGroups: [{
      id: 'ag_main',
      keywords,
      // Its ad says what its cell says. Position is inferable from copy and
      // from nothing else (17.1), so this mapping is the entire mechanic.
      ad: rivalAd,
      gradedQuality: {
        ...creative.openingGrade,
        gradedAtRound: 0,
        contentHash: `sha1:rival-${identity.id}`,
      },
    }],
    creative,
    bidding: {
      learningRoundsRemaining: 0,
      observedConvRate: null,
      observedConversions: 0,
      observedClicks: 0,
      observedByHour: null,
    },
    pendingConversions: [],
    pendingReturns: [],
    pendingHourly: [],
    qualityHistory: {},
  };
}

/**
 * A rival's opening keywords: its own territory, head terms first.
 *
 * Match types are mixed rather than uniform, because a market where everyone
 * runs exact never crowds an auction and a market where everyone runs broad
 * crowds every one of them. Tags come from the query the keyword was written
 * from, which is what a tagger would produce for it.
 */
function rivalKeywords(cell, querySet, business, rng) {
  const own = querySet.queries.filter((q) => homeCell(q) === cell);
  const heads = own.filter((q) => q.isHeadTerm);
  const body = own.filter((q) => !q.isHeadTerm);
  const chosen = [...heads.slice(0, 4), ...shuffled(body, rng).slice(0, 4)];

  // Comfortably inside its own ceiling, with seeded variation so nine rivals do
  // not tie on ad rank and hand one of them every top slot.
  const ceiling = breakEvenCpcPaise(business);
  const appetite = 0.55 + rng() * 0.25;

  return chosen.map((query, i) => ({
    id: `kw_${i + 1}`,
    text: query.text,
    matchType: i === 0 ? 'exact' : i < 5 ? 'phrase' : 'broad',
    bidPaise: Math.max(100, Math.round(ceiling * appetite)),
    active: true,
    tags: [...query.tags],
    taggedContentHash: `sha1:rival-kw-${i + 1}`,
  }));
}

/**
 * A rival's capital allocation, drawn with a tilt toward what D7 says is right
 * for its tier — and therefore sometimes wrong.
 */
function rivalCapex(position, rng) {
  const committed = Object.fromEntries(CAPEX_TARGETS.map((t) => [t, 0]));
  const pending = [];
  const cap = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].paise;

  // Value has conversions to spare and the worst returns problem, so it should
  // invest. Premium is data-starved and often should not.
  const appetite = { value: 0.75, mid: 0.55, premium: 0.35 }[position.price];
  if (rng() >= appetite) {
    return { committed, pending, remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE };
  }

  // Which target, tilted by what its position actually needs (13.3).
  //
  // TWO NOW, NOT ONE, and R6 is why. A round's allocation is ₹1,20,000 and the
  // ladder tops at ₹80,000 (I29), so an advertiser that commits to one target
  // has ₹40,000 left. Leaving it unspent would hand the player a second lever
  // no rival ever pulls — and the second lever is order confirmation, the only
  // defence against the freight build 2 charges. A market where only the player
  // can defend itself is not the same game.
  const primary = position.price === 'value' ? 'sizeGuide'
    : position.price === 'premium' ? 'photography'
      : 'landingPage';

  // The second choice is where order confirmation gets into the market. Value
  // and mid carry the most cash at the door and the most refusals, so they reach
  // for it oftener; premium has few refusals to prevent and buys reach instead.
  const secondary = position.price === 'premium'
    ? (rng() < 0.35 ? 'orderConfirmation' : 'landingPage')
    : (rng() < 0.6 ? 'orderConfirmation' : 'photography');

  const commit = (target, paise) => {
    committed[target] += paise;
    pending.push({ target, paise, liveAtRound: 1 + CAPEX_DELAY_ROUNDS });
  };

  commit(primary, cap);
  const left = CAPEX_ALLOCATION_PAISE - cap;
  if (left > 0) commit(secondary, left);

  return { committed, pending, remainingUnallocatedPaise: 0 };
}

// ---------------------------------------------------------------------------
// 17.2  The briefing
// ---------------------------------------------------------------------------

/**
 * What a founder could research before spending anything (17.2).
 *
 * Returned as DATA rather than prose. The interface decides how to say it; this
 * decides what is knowable, which is the part that has to be right.
 *
 * The worked anchor is the neutral-query figure from 4.4, and 17.2 is explicit
 * that the sentence after it is not optional: every position's real ceiling is
 * 2.2 to 2.6x the anchor, and a player handed ₹20 with no warning bids ₹20,
 * loses every auction, and concludes the arithmetic they were taught is broken.
 * Direction and rough size, never the multiplier — the affinities stay withheld
 * from everyone (C4) and the precise figure is earned by running the keyword.
 *
 * @param {object} querySet
 * @returns {object} the briefing
 */
export function briefing(querySet) {
  const weekly = querySet.weeklyVolume;
  const tiers = QUERY_SET_RULES.tierVolumeTargets;

  const mid = POSITION_ECONOMICS.mid;
  const anchorPaise = mulRate(
    mid.aovMeanPaise, mid.marginPct * (1 - mid.returnRate) * mid.convRateBase,
  );
  // Built from the same fields as the figure, never typed. It was a literal,
  // and F14 changed mid's return rate under it: the anchor became ₹20.37 while
  // the sentence went on saying ₹26.56 at 76% retention.
  const pct = (x) => `${Number((x * 100).toFixed(1))}%`;
  const arithmetic = `${formatINR(mid.aovMeanPaise)} x ${pct(mid.marginPct)} x `
    + `${pct(1 - mid.returnRate)} x ${pct(mid.convRateBase)} = `
    + `${formatINR(anchorPaise, { decimals: 2 })} on an average search`;

  return {
    weeklySearchesByTier: {
      value: Math.round(weekly * tiers.value),
      mid: Math.round(weekly * tiers.mid),
      premium: Math.round(weekly * tiers.premium),
    },
    economicsByTier: Object.fromEntries(PRICE_TIERS.map((price) => [price, {
      aovMeanPaise: POSITION_ECONOMICS[price].aovMeanPaise,
      marginPct: POSITION_ECONOMICS[price].marginPct,
    }])),

    breakEvenFormula: 'order value x margin x (1 - return rate) x conversion rate',
    workedAnchor: {
      tier: 'mid',
      aovMeanPaise: mid.aovMeanPaise,
      marginPct: mid.marginPct,
      retentionPct: 1 - mid.returnRate,
      convRate: mid.convRateBase,
      resultPaise: anchorPaise,
      arithmetic,
      // 17.2: not optional.
      caveat: 'That is what a search worth nothing in particular is worth to you. '
        + 'The searches you choose to compete for are worth appreciably more — '
        + 'roughly double — which is the entire reason choosing a position matters.',
    },

    // WHERE THE SEARCHES ARE (G4). What a founder in this market would already
    // know, and no more.
    //
    // The volume split is ordinary desk research and it is the half that matters
    // most: the metros are the smallest of the three, which is what makes "just
    // advertise in the metros" a plan that runs out rather than a plan that wins.
    //
    // THE RETURNS LINE IS STATED RATHER THAN WITHHELD, and that was a deliberate
    // call. Cash on delivery outside the metros is not a trade secret - anybody
    // selling apparel in India knows those parcels come back more often - so
    // making the player discover it would be withholding something the character
    // they are playing would have. What is NOT given is the size of the effect
    // per tier, or which position should go where: that is the decision, and it
    // is read from the location report the same way everything else here is.
    locations: LOCATIONS.map((tier) => ({
      id: tier.id,
      label: tier.label,
      examples: [...tier.examples],
      note: tier.note,
      shareOfSearches: Object.fromEntries(PRICE_TIERS.map((price) => [
        price, LOCATION_VOLUME_BY_PRICE[price][LOCATION_TIERS.indexOf(tier.id)],
      ])),
    })),
    returnsVaryByLocation: 'Cash on delivery is ordinary outside the metros, and '
      + 'COD orders come back more often. The same click is worth less the '
      + 'further out it is - not because fewer people buy, but because more of '
      + 'what they buy comes back. How much is in your own location report.',

    rankingRule: {
      metric: 'cumulative gross profit across rounds 1-8, as reported at round 8',
      snapshotRound: 8,
      multipliers: [...RANK_BUDGET_MULTIPLIERS],
      statedAtRound: 1,
    },

    monthlyBudgetPaise: MONTHLY_BUDGET_PAISE,
    capexAllocationPaise: CAPEX_ALLOCATION_PAISE,
    totalRounds: TOTAL_ROUNDS,

    // Directional only. The numbers behind these are withheld (4.2, 4.3, 12.2).
    hints: {
      conversionRate: 'Cheaper products convert more often; a ₹4,800 decision is '
        + 'researched, compared and slept on.',
      // F14. Every return, including parcels refused at the door, which is how
      // the engine counts it. The old line said returns ran higher at the cheap
      // end because people order two sizes; nothing sourced supports that, and
      // what price really changes is the cost of each one.
      returns: 'About two in five orders come back category-wide, counting parcels '
        + 'refused at the door as well as those sent back. Price barely changes how '
        + 'often; it changes how much each one costs you.',
    },
  };
}

/**
 * The eight rival ads, unordered (17.1 step 7).
 *
 * Shuffled, and carrying no cell. Position is inferable from the words and from
 * nothing else; handing over an ordered list would leak the placement that the
 * player is supposed to read.
 *
 * @param {object[]} rivals
 * @param {number} rootSeed
 * @returns {Array<{name: string, domain: string, headlines: string[], descriptions: string[]}>}
 */
/**
 * Build the whole rival roster, assigning each one an ad its cell-mate is not
 * already wearing.
 *
 * ONE FUNCTION BECAUSE THERE MUST BE ONE. `startGame` builds the roster the
 * game is played against, and round 0's screen builds the roster it SHOWS —
 * and for a while they were two loops. The moment the ad variant was added to
 * one, the briefing showed a different ad from the one the player would meet,
 * which is worse than the duplicate copy it was fixing.
 *
 * @param {object[]} rivalIdentities the eight who are not the player
 * @param {string[]} placement cell per rival, from `placeRivals`
 * @param {object} querySet
 * @param {() => number} rng seeded
 * @returns {object[]} Advertisers
 */
export function buildRivals(rivalIdentities, placement, querySet, rng) {
  const seenInCell = {};
  return rivalIdentities.map((brand, i) => {
    const cell = placement[i];
    const variant = seenInCell[cell] ?? 0;
    seenInCell[cell] = variant + 1;
    return buildRival(brand, cell, i + 1, querySet, rng, variant);
  });
}

export function rivalAdsForBriefing(rivals, rootSeed) {
  const rng = mulberry32(deriveSeed(rootSeed, 'briefing-order'));
  return shuffled(rivals, rng).map((r) => ({
    name: r.name,
    domain: r.domain,
    headlines: [...r.adGroups[0].ad.headlines],
    descriptions: [...r.adGroups[0].ad.descriptions],
  }));
}

// ---------------------------------------------------------------------------
// 17  Assembling the game
// ---------------------------------------------------------------------------

/**
 * Round 0, start to finish: a GameState ready for round 1.
 *
 * @param {object} args
 * @param {number} args.rootSeed
 * @param {string} args.playerBrandId one of the nine
 * @param {object} args.player the player's opening decisions
 * @param {object} args.querySet
 * @returns {object} GameState at round 1
 */
export function startGame({ rootSeed, playerBrandId, player, querySet }) {
  // Step 1, and it throws rather than warning. Nothing downstream is
  // trustworthy if the query set is not (7.4).
  assertValidQuerySet(querySet, { advertiserIds: BRAND_IDENTITIES.map((b) => b.id) });

  const { player: identity, rivals: rivalIdentities } = assignIdentities(playerBrandId);
  const placement = placeRivals(rootSeed, rivalIdentities.length);

  const rng = mulberry32(deriveSeed(rootSeed, 'rival-accounts'));
  const rivals = buildRivals(rivalIdentities, placement, querySet, rng);

  const playerAdvertiser = buildPlayer(identity, player);

  return {
    schemaVersion: SCHEMA_VERSION,
    round: 1,
    rootSeed,
    // Index 0 is the player by convention only (R6).
    advertisers: [playerAdvertiser, ...rivals],
    querySet,
    budgetSchedule: {
      monthlyAllocationPaise: [MONTHLY_BUDGET_PAISE, MONTHLY_BUDGET_PAISE, null],
      capexAllocationRounds: [1, 5],
      rankSnapshotRound: 8,
    },
    history: [],
    decisionLog: [],
    marketContext: [],
    // 17.3: one redo, and the state has to remember whether it was used.
    roundZero: { playerBrandId, player, redoUsed: false },
  };
}

/**
 * The player's account from their round 0 choices.
 *
 * Their keywords arrive untagged and their ad ungraded unless the caller has
 * already run a tagger and a grader over them. Both are the specified
 * degradations (8.4, 9.5), not oversights: broad match is inert until something
 * tags the keyword, and an unevaluated ad performs like an unevaluated ad.
 */
function buildPlayer(identity, choices) {
  const { position: raw, capex, keywords, ad, weeklySplitPaise } = choices;
  const position = { ...parseCell(cellKey(raw.price, raw.purpose)), setAtRound: 0, repositionedAtRound: null };

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new RangeError('the player needs at least one keyword to enter an auction');
  }

  const playerAd = ad ?? { headlines: [], descriptions: [], landingPageDescription: '' };

  // Who writes it (I11), BEFORE the budget, because what the writer did not
  // cost is advertising money and the split has to be planned across the month
  // the player will actually have. The default is DIY because writing their own
  // copy is what the player has always done here; the delay is the new cost of
  // doing so, not a new behaviour.
  const gradingContext = {
    keywords,
    rivalNames: BRAND_IDENTITIES.filter((b) => b.id !== identity.id).map((b) => b.name),
  };
  const ownGrade = choices.gradedQuality ?? gradeAdOffline(playerAd, gradingContext, 0);
  const creative = creativeBlock({
    tierId: choices.writerTier ?? 'diy',
    writtenGrade: ownGrade,
    // The player has no history to lean either way, so no bias. A rival's lean
    // is its character; the player's first ad is its first ad.
    bias: 0,
    // Graded from the page their CAPITAL built, never from the writer (I9).
    landingPage: ownGrade.landingPage,
    ad: playerAd,
    keywords,
  });

  // The month the player will ACTUALLY have, which is not MONTHLY_BUDGET_PAISE
  // whenever they decline some capital. 13.3 rolls whatever is uncommitted into
  // the month's advertising budget, so a player who keeps 30,000 has 1,98,000
  // to plan across four weeks and a split that says so is correct.
  //
  // Only the VALIDATION knows about the CAPITAL rollover. `monthlyBudgetPaise`
  // leaves it out and round.js adds it at the capex allocation round, which is
  // also where it rescales the split — adding it here as well would pay the
  // player twice.
  //
  // THE CREATIVE ROLLOVER IS DIFFERENT and is added here for real. It has no
  // allocation round to arrive at: the writer is chosen at round 0, so the
  // money is in the budget from round 1 and nothing downstream adds it again.
  const monthBase = MONTHLY_BUDGET_PAISE + creative.unspentPaise;
  const capexBlock = capex ?? { remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE };
  const monthCeiling = monthBase + (capexBlock.remainingUnallocatedPaise ?? 0);

  const split = weeklySplitPaise
    ?? allocate(monthBase, new Array(ROUNDS_PER_MONTH).fill(1));
  const check = validateWeeklySplit(split, monthCeiling);
  if (!check.valid) throw new RangeError(`weekly split rejected: ${check.reason}`);

  return {
    id: identity.id,
    name: identity.name,
    domain: identity.domain,
    controller: 'player',
    policyId: null,
    active: true,
    position,
    capex: capex ?? {
      committed: Object.fromEntries(CAPEX_TARGETS.map((t) => [t, 0])),
      pending: [],
      remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE,
    },
    campaign: {
      monthlyBudgetPaise: monthBase,
      monthSpentPaise: 0,
      weeklySplitPaise: split,
      strategy: 'manual',
      strategyParams: { targetCpaPaise: 40000, targetRoas: 4.0 },
      daypartAdjustments: [0, 0, 0, 0, 0, 0],
      // Running everywhere, at the same bid everywhere. Neutral rather than
      // absent so the shape is always the one the engine expects, and so the
      // round's flat-market fast path is the default rather than a special case.
      locationAdjustments: [0, 0, 0],
      // I34: what a prepaid order is discounted by, in paise. Zero is "cash is
      // fine", which is where every advertiser starts.
      prepaidDiscountPaise: 0,
      negatives: [],
    },
    adGroups: [{
      id: 'ag_main',
      // Spec 17 step 12 again: TAG the player's assets, not just grade them.
      // Untagged is a safe degradation (8.4) and it is still an asymmetry -
      // every rival is tagged at placement, so broad match works for eight
      // advertisers and not for the ninth, in a game about match types.
      keywords: tagKeywordsOffline(keywords.map((k, i) => ({
        id: k.id ?? `kw_${i + 1}`,
        text: k.text,
        matchType: k.matchType ?? 'phrase',
        bidPaise: k.bidPaise,
        active: k.active ?? true,
        tags: k.tags,
        taggedContentHash: k.taggedContentHash,
      }))),
      ad: playerAd,
      // Spec 17 step 12: grade the player's assets before round 1. Offline
      // unless a grade was supplied, because round 0 has to complete without
      // an API key - and because leaving it null is not a neutral choice.
      // DECISIONS A8: an ungraded ad grades 3/3/3, which sits below
      // AD_RANK_FLOOR at any cautious bid, so the player would enter every
      // auction and show in none.
      // A supplied grade still wins, so a caller that hands one over is not
      // silently overridden by a tier it never chose.
      // The components the tier decided, over the metadata the grader produced.
      // 5.2 caches on contentHash, so a grade that lost it would be regraded
      // every round and the "unchanged ad is never regraded" guarantee would go.
      gradedQuality: choices.gradedQuality ?? { ...ownGrade, ...creative.openingGrade },
    }],
    creative,
    bidding: {
      learningRoundsRemaining: 0,
      observedConvRate: null,
      observedConversions: 0,
      observedClicks: 0,
      observedByHour: null,
    },
    pendingConversions: [],
    pendingReturns: [],
    pendingHourly: [],
    qualityHistory: {},
  };
}

// ---------------------------------------------------------------------------
// 17.3  The one redo
// ---------------------------------------------------------------------------

/**
 * Rewind to round 1 with different opening choices (17.3).
 *
 * Round 0 asks for brand, position, capex, weekly split, keywords and ad copy
 * against deliberately incomplete information, before the player has seen a
 * single auction. Without this, the most consequential decisions in the game
 * are the ones the player was least equipped to make, and the sim punishes them
 * for not knowing things it withheld on purpose.
 *
 * IT IS A LEARNING AFFORDANCE, NOT A GAME MECHANIC. Rivals do not get one, and
 * it is implemented here by rewinding rather than in the engine, so R6 is
 * untouched — nothing in `engine/` learns that a player exists.
 *
 * The market is rebuilt from the SAME rootSeed, so the rivals, their cells and
 * their ads are identical. Only the player's own choices change. Replaying
 * against a different market would answer a different question.
 *
 * @param {object} gameState
 * @param {object} args what to change: playerBrandId and/or player
 * @returns {object} a fresh GameState at round 1
 */
export function redoRoundZero(gameState, { playerBrandId, player } = {}) {
  const previous = gameState.roundZero;
  if (!previous) {
    throw new Error('this game was not started through startGame, so it cannot be rewound');
  }
  if (previous.redoUsed) {
    throw new RangeError('round 0 may be redone once, and it already has been');
  }
  if (gameState.round > REDO_DEADLINE_ROUND) {
    throw new RangeError(
      `round 0 may be redone up to the end of round ${REDO_DEADLINE_ROUND}, and it is now round ${gameState.round}`,
    );
  }

  const fresh = startGame({
    rootSeed: gameState.rootSeed,
    playerBrandId: playerBrandId ?? previous.playerBrandId,
    player: player ?? previous.player,
    querySet: gameState.querySet,
  });
  fresh.roundZero.redoUsed = true;
  return fresh;
}

/** May the player still rewind? For an interface deciding whether to offer it. */
export function canRedoRoundZero(gameState) {
  return Boolean(gameState.roundZero)
    && !gameState.roundZero.redoUsed
    && gameState.round <= REDO_DEADLINE_ROUND;
}

export { REDO_DEADLINE_ROUND };
