/**
 * Auction Insights, and the wall around everything else (spec 16).
 *
 * Computable only because the auction resolver keeps its losers (L3). An
 * auction that returned just the winners could tell you who beat you but never
 * how often you and a rival were in the same room.
 *
 * THE MOST MISREAD NUMBER ON THE PLATFORM
 *
 * Overlap rate is not market share and is not a measure of spend. It says how
 * often a rival appeared in the auctions you appeared in, and nothing else. A
 * competitor with 90% overlap may be spending a hundredth of what you spend.
 * The interface must say so.
 *
 * WHAT LEAVES THIS MODULE
 *
 * `getPublicView` is the only route to another advertiser's data, and R3a
 * makes it the only thing a controller ever sees besides its own report.
 * Every field it returns is one a real advertiser could obtain: identity and
 * creative from the Ads Transparency Centre, query text and volume from
 * Keyword Planner, the six metrics from Auction Insights.
 *
 * Everything else is withheld — including a query's affinities and conversion
 * multipliers, which are withheld from EVERYONE, even the advertiser whose
 * position they happen to favour (DECISIONS C4). Knowing that 50,000 people
 * search "cheap gym leggings" is research. Knowing what those people do after
 * clicking is earned by running the keyword.
 */

const RATES = ['impressionShare', 'overlapRate', 'positionAboveRate', 'outrankingShare'];

/**
 * The six Search metrics, for one viewer against every rival.
 *
 * @param {object} pairwise from round.js: aShown, bothShown, bAbove, aShownBnot, ids
 * @param {object} byAdvertiser raw per-advertiser accumulators
 * @param {string} viewerId
 * @returns {object} the viewer's own row
 */
export function insightsFor(pairwise, byAdvertiser, viewerId) {
  const { ids } = pairwise;
  const a = ids.indexOf(viewerId);
  if (a === -1) throw new RangeError(`unknown advertiser "${viewerId}"`);

  const mine = byAdvertiser[viewerId];
  const rivals = {};

  for (let b = 0; b < ids.length; b++) {
    if (b === a) continue;
    const both = pairwise.bothShown[a][b];
    const above = pairwise.bAbove[a][b];
    const aloneShown = pairwise.aShownBnot[a][b];
    const theirs = byAdvertiser[ids[b]];

    rivals[ids[b]] = {
      // How often a rival showed in the auctions I showed in. NOT market
      // share, NOT spend.
      overlapRate: pairwise.aShown[a] > 0 ? both / pairwise.aShown[a] : 0,
      // Of the auctions we both appeared in, how often they were above me.
      positionAboveRate: both > 0 ? above / both : 0,
      // How often I beat them, counting auctions they never reached.
      outrankingShare: (both + aloneShown) > 0
        ? ((both - above) + aloneShown) / (both + aloneShown)
        : 0,
      // Per-advertiser, not pairwise: their own rates, shown in their row.
      impressionShare: rate(theirs.impressions, theirs.eligibleAuctions),
      topOfPageRate: rate(theirs.topImpressions, theirs.eligibleAuctions),
      absTopOfPageRate: rate(theirs.absTopImpressions, theirs.eligibleAuctions),
    };
  }

  return {
    self: {
      impressionShare: rate(mine.impressions, mine.eligibleAuctions),
      topOfPageRate: rate(mine.topImpressions, mine.eligibleAuctions),
      absTopOfPageRate: rate(mine.absTopImpressions, mine.eligibleAuctions),
      lostToRank: rate(mine.lostToRank, mine.eligibleAuctions),
      lostToBudget: rate(mine.lostToBudget, mine.eligibleAuctions),
    },
    rivals,
  };
}

/** Every advertiser's row, keyed by id. */
export function buildInsights(pairwise, byAdvertiser) {
  return Object.fromEntries(
    pairwise.ids.map((id) => [id, insightsFor(pairwise, byAdvertiser, id)]),
  );
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Everything one advertiser may see about the world (spec 16.1, R3, R3a).
 *
 * A controller receives this and its own report. Never `GameState` — you
 * cannot prove a controller ignored a field it was handed, so the only real
 * enforcement is never handing it over.
 *
 * @param {object} gameState
 * @param {string} viewerId
 * @param {object} [context] this round's pairwise matrix and accumulators
 * @returns {object}
 */
export function getPublicView(gameState, viewerId, context = null) {
  const view = {
    advertisers: gameState.advertisers
      .filter((a) => a.active !== false)
      .map((a) => ({
        id: a.id,
        name: a.name,
        domain: a.domain,
        // Creative only. Ads Transparency makes this public; the landing page
        // description is the advertiser's own working note and is not.
        ads: a.adGroups.map((g) => ({
          headlines: [...g.ad.headlines],
          descriptions: [...g.ad.descriptions],
        })),
      })),

    // Keyword Planner: what people search and how often. Nothing about what
    // they do next.
    querySet: gameState.querySet.queries.map((q) => ({
      id: q.id,
      text: q.text,
      volumeShareBp: q.volumeShareBp,
      intent: q.intent,
    })),

    weeklyVolume: gameState.querySet.weeklyVolume,
    insights: null,
    marketContext: null,
  };

  if (context) {
    view.insights = insightsFor(context.pairwise, context.byAdvertiser, viewerId);
    view.marketContext = { ...context.marketContext };
  }

  return view;
}

/**
 * Field names that must never appear anywhere in a public view.
 *
 * The reported quality score is deliberately absent from this list, and its
 * absence is not an oversight. Naming it here would trip the structural test
 * in quality.test.js, which fails if any engine module outside quality.js so
 * much as writes the identifier — a stricter guard than a denylist entry, and
 * one this module has no business weakening. Scores never pass through here
 * anyway: the caller attaches each advertiser's own to its own report row.
 */
export const FORBIDDEN_IN_PUBLIC_VIEW = Object.freeze([
  'priceAffinity', 'purposeAffinity', 'convMultiplier', 'valueMultiplier',
  'returnRateMultiplier', 'tags', 'isHeadTerm', 'brandOwner', 'hourProfile',
  'bidPaise', 'monthlyBudgetPaise', 'monthSpentPaise', 'weeklySplitPaise',
  'costPaise', 'gradedQuality', 'qualityHistory',
  'pendingConversions', 'pendingReturns', 'business', 'position', 'capex',
  'landingPageDescription', 'strategy', 'strategyParams', 'negatives',
  'bidding', 'observedConvRate',
]);

export { RATES };
