/**
 * Rule-based policies (build order step 13, spec 2 and 5.2).
 *
 * Six of the eight rivals run one of these. They exist before the
 * Claude-backed controllers on purpose: the full test suite must pass with no
 * network access (R2), so the market has to be playable without a model in it.
 *
 * WHAT A POLICY IS
 *
 * A pure function of three views:
 *
 *     policy(selfView, report, publicView) -> decision | null
 *
 * and nothing else. No `GameState`, no other advertiser's record, no engine
 * imports at all — this file imports nothing from `engine/`, which makes the
 * structural guard absolute rather than a denylist somebody has to remember to
 * extend. Anything a policy knows, it was handed.
 *
 * WHAT IT CANNOT KNOW, AND WHY THAT SHAPES EVERY RULE BELOW
 *
 * `getSelfView` gives an advertiser its own catalogue — order value, spread,
 * margin — and withholds `convRateBase` and `returnRate`, because those are the
 * truth (16.2, DECISIONS D2). So **a policy cannot compute its own break-even.**
 * It has to estimate the two missing terms from its own report and be wrong
 * early, exactly as a real advertiser is. Every "assumed" constant in this file
 * exists because of that, and each one is a place where the policy is guessing.
 *
 * That is not a limitation to work around. It is the thing being modelled.
 *
 * WHERE THESE NUMBERS LIVE
 *
 * Hard rule 7 sends every unsourced number to `constants.js`. These are not
 * there, deliberately: `constants.js` is the physics of the market, and these
 * are one competitor's opinions about how to play it. A policy's aggression
 * must be changeable without touching a file the engine reads, or a tuning
 * tweak to a rival would move the market itself. See `DECISIONS.md` C7.
 */

// ---------------------------------------------------------------------------
// What `disciplined` believes, before it has evidence
// ---------------------------------------------------------------------------

/**
 * What a competent operator assumes about returns before it has seen any.
 *
 * The round 0 briefing tells the player "about a quarter of orders
 * category-wide" (17.2) and withholds the rest, so a quarter is what a
 * disciplined rival assumes too. It is wrong in both directions — Value-
 * Lifestyle really returns 36%, Premium-Performance 17% — and it is corrected
 * from the report as soon as returns start resolving.
 */
const ASSUMED_RETURN_RATE = 0.25;

/**
 * The conversion rate to assume before any has been observed.
 *
 * Matches no position exactly, on purpose: a cold start should be wrong for
 * everyone rather than quietly correct for the mid-market.
 */
const ASSUMED_CONV_RATE = 0.03;

/** Bid this share of what it believes it can afford. The margin of safety. */
const TARGET_MARGIN_OF_SAFETY = 0.70;

/** Never move a bid by more than this in one round. Thrash is not strategy. */
const MAX_BID_MOVE = 0.25;

/** Impression share lost to rank above this is worth paying to fix. */
const LOST_TO_RANK_TOLERANCE = 0.30;

/** Realised CPA above this multiple of target means bid down. */
const CPA_OVERSHOOT = 1.15;

/** Clicks on one query with no conversions at all before it gets blocked. */
const NEGATIVE_CLICK_THRESHOLD = 40;

/** Floor and ceiling on any bid this policy will write, in paise. */
const MIN_BID_PAISE = 100;
const MAX_BID_PAISE = 20000;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ---------------------------------------------------------------------------
// disciplined
// ---------------------------------------------------------------------------

/**
 * The competent operator. The policy spec 5.2 names by id.
 *
 * Manual CPC, because manual never predicts conversions and so behaves
 * predictably on a thin account (12.2) — which is the right opening on an
 * account with no history. It bids a margin of safety under what it *believes*
 * it can afford, corrects that belief from its own report each round, and
 * blocks queries the search terms report shows it is wasting money on.
 *
 * It does not touch capex or repositioning. Those are round 0 and round 5
 * decisions, and a rival that quietly optimised them would make the player's
 * own capex choice unreadable against the market.
 *
 * @param {object} self from getSelfView
 * @param {object|null} report own AdvertiserRoundReport, null in round 1
 * @param {object} view from getPublicView
 * @returns {object|null} a decision, or null to change nothing
 */
export function disciplined(self, report, view) {
  const affordable = affordableCpcPaise(self, report);

  // Round 1: no evidence yet, so open at the margin of safety and wait.
  if (!report) {
    return {
      campaign: { strategy: 'manual' },
      adGroups: withBids(self.adGroups, () => Math.round(affordable * TARGET_MARGIN_OF_SAFETY)),
    };
  }

  const move = bidMove(report, affordable);
  const negatives = [
    ...(self.campaign.negatives ?? []),
    ...wastefulQueries(report, view, self.campaign.negatives ?? []),
  ];

  return {
    campaign: { strategy: 'manual', negatives },
    adGroups: withBids(self.adGroups, (keyword) => {
      const target = Math.round(affordable * TARGET_MARGIN_OF_SAFETY);
      const moved = Math.round(keyword.bidPaise * move);
      // Never bid past what it believes it can afford, whatever the move says.
      return clamp(Math.min(moved, target), MIN_BID_PAISE, MAX_BID_PAISE);
    }),
  };
}

/**
 * What this advertiser believes it can pay for a click.
 *
 * It knows its order value and margin. It does NOT know its conversion rate or
 * its return rate, so both are estimated — the conversion rate from observed
 * history, the return rate from whatever has actually come back. Early on both
 * estimates are poor and this figure is badly wrong, which is the point.
 *
 * @param {object} self
 * @param {object|null} report
 * @returns {number} integer paise
 */
export function affordableCpcPaise(self, report) {
  const { aovMeanPaise, marginPct } = self.catalogue;
  const convRate = self.bidding.observedConvRate ?? ASSUMED_CONV_RATE;
  return Math.round(aovMeanPaise * marginPct * (1 - observedReturnRate(report)) * convRate);
}

/**
 * The return rate this advertiser has actually seen.
 *
 * Returns resolve two rounds after a conversion lands, so early reports show
 * conversions with nothing returned yet and this reads 0 — which would make the
 * advertiser believe it can afford more than it can. So the briefing's quarter
 * holds until enough has settled to argue otherwise.
 */
function observedReturnRate(report) {
  if (!report) return ASSUMED_RETURN_RATE;
  const { final, returned } = report.conversions;
  if (!(final > 0) || !(returned > 0)) return ASSUMED_RETURN_RATE;
  return clamp(returned / final, 0, 0.9);
}

/**
 * Which way to move bids, and by how much.
 *
 * Two signals, in order of precedence. Paying too much per conversion is a
 * solvable problem and comes first; missing impressions to rank is only worth
 * fixing once the economics are sound.
 */
function bidMove(report, affordable) {
  const { clicks, costPaise } = report.traffic;
  const conversions = report.conversions.final;

  if (clicks > 0 && conversions > 0) {
    const cpa = costPaise / conversions;
    const target = affordable > 0 ? affordable / (conversions / clicks) : cpa;
    if (cpa > target * CPA_OVERSHOOT) return 1 - MAX_BID_MOVE;
  }

  if (report.share.lostToRank > LOST_TO_RANK_TOLERANCE) return 1 + MAX_BID_MOVE;
  return 1;
}

/**
 * Queries this account is paying for and getting nothing from.
 *
 * `breakdown.byQuery` IS the search terms report (15.2), and since negatives
 * are string-only (8.2) it is the only tool for writing them. So this is the
 * policy doing exactly what a player has to do: read the report, find the
 * searches that took money and returned nothing, and name their literal words.
 *
 * Phrase negatives, not broad: a broad negative needs every token present in
 * any order and over-blocks less predictably than naming the phrase.
 */
function wastefulQueries(report, view, existing) {
  const blocked = new Set(existing.map((n) => n.text));
  const texts = new Map((view.querySet ?? []).map((q) => [q.id, q.text]));
  const out = [];

  for (const [queryId, row] of Object.entries(report.breakdown.byQuery)) {
    if (row.clicks < NEGATIVE_CLICK_THRESHOLD) continue;
    if ((row.conversions ?? 0) > 0) continue;
    const text = texts.get(queryId);
    if (!text || blocked.has(text)) continue;
    blocked.add(text);
    out.push({ text, matchType: 'phrase' });
  }
  return out;
}

function withBids(adGroups, bidFor) {
  return adGroups.map((group) => ({
    ...group,
    keywords: group.keywords.map((keyword) => ({
      ...keyword,
      bidPaise: clamp(bidFor(keyword), MIN_BID_PAISE, MAX_BID_PAISE),
    })),
  }));
}

// ---------------------------------------------------------------------------

/** Every rule-based policy, by the id `advertiser.policyId` carries. */
export const POLICIES = Object.freeze({
  disciplined,
});

/**
 * A controller for `game.js`, from a policy id.
 *
 * @param {string} policyId
 * @returns {Function} (self, report, view) => decision
 */
export function controllerFor(policyId) {
  const policy = POLICIES[policyId];
  if (!policy) throw new RangeError(`unknown policy "${policyId}"`);
  return policy;
}
