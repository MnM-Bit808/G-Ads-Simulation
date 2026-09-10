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
 *
 * Multiplied by `ASSUMED_TERRITORY_UPLIFT`, because the briefing says so. 17.2
 * hands the player a worked anchor on an average search and then tells them
 * plainly that the searches they choose to compete for are worth appreciably
 * more — roughly double. A policy has read the same briefing.
 *
 * Without the uplift a cold account believes it can afford about a third of its
 * real ceiling, bids accordingly, wins nothing, and therefore gathers no data
 * to correct itself with. It is not a slow start, it is a closed loop: the
 * estimate can only improve on traffic the estimate is preventing.
 */
const ASSUMED_CONV_RATE = 0.03;
const ASSUMED_TERRITORY_UPLIFT = 2.0;

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

// --- what the other five believe --------------------------------------------

/**
 * `spender` bids ABOVE what it can afford.
 *
 * **THIS IS NOT THE MULTIPLE THE ACCOUNT BIDS.** `spender` runs Maximise
 * Clicks, and `rawBid` multiplies the keyword bid by `MAX_CLICKS_AGGRESSION`
 * (1.6) again, so the effective bid is 1.10 x 1.6 = **1.76x break-even** —
 * against `disciplined`'s 0.70x, a ratio of 2.5x that shows up almost exactly
 * in the realised price (cpc 24.94 against 9.69 over 12 markets).
 *
 * So the brake is the STRATEGY, not pacing as this comment used to claim.
 * Ablated, dropping the bid to 0.70x and switching off Maximise Clicks are
 * worth +131% and +138% — nearly the same number, because they are the same
 * lever reached through two files.
 *
 * Whether 1.76x is the intended aggression is an open question in
 * `HANDOVER.md`; the value is left alone here and only the claim is corrected.
 */
const SPENDER_AGGRESSION = 1.10;

/** `cautious` bids about a third of its ceiling, and creeps only under duress. */
const CAUTIOUS_MARGIN_OF_SAFETY = 0.35;
const CAUTIOUS_RANK_PANIC = 0.50;
const CAUTIOUS_CREEP = 0.10;
const CAUTIOUS_CEILING = 0.50;

/**
 * `automator` cycles in this order, one step per disappointing round.
 *
 * Manual and Maximise Clicks sit at the front deliberately: neither predicts
 * conversions, so neither can be hurt by a learning period (12.2). The account
 * is at its most stable exactly before it starts reaching for automation.
 */
const AUTOMATION_CYCLE = Object.freeze(['manual', 'maxClicks', 'targetCpa', 'targetRoas', 'maxConv']);
const AUTOMATOR_ROAS_TARGET = 4.0;
const AUTOMATOR_COLD_CPA_MULTIPLE = 30;

/** `brandDefender` pays up for its own name and very little for anyone else's. */
const BRAND_DEFENCE_MULTIPLE = 1.20;
const BRAND_POACH_MULTIPLE = 0.25;

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
/**
 * What a competent rival offers to keep a parcel out of cash (I34).
 *
 * R6 IS WHY THIS EXISTS. A prepaid discount is the only lever on refusals that
 * is open after round 5, and a market where only the player pulls it is not the
 * market the player thinks they are in — their own restraint would look like
 * skill and their rivals' refusals would be a handicap nobody chose.
 *
 * It reads its OWN report, like every other decision here: the discount is worth
 * offering when refusals are actually costing something, and a rival with few
 * of them should keep the margin. The threshold is its own refusal rate rather
 * than a constant, so a premium advertiser in the metros arrives at "no" and a
 * value one in the towns arrives at "yes" without either being told.
 *
 * One rung, not a search. A policy that hill-climbed the curve every week would
 * out-optimise a player who gets one look at it, and 5.2 wants a competent
 * operator rather than a solver.
 */
function prepaidNudge(self, report) {
  const rows = Object.values(report?.breakdown?.byLocation ?? {});
  const conversions = rows.reduce((a, r) => a + (r.conversions ?? 0), 0);
  const refused = rows.reduce((a, r) => a + (r.refused ?? 0), 0);
  if (conversions < 5) return null;

  const rate = refused / conversions;
  const held = self.campaign?.prepaidDiscountPaise ?? 0;
  // The rung the sources call the one that does most of the work, and a bigger
  // one only where refusals are genuinely heavy.
  const want = rate > 0.12 ? 5000 : rate > 0.06 ? 3000 : 0;
  return want === held ? null : want;
}

// ---------------------------------------------------------------------------
// Where to bid (DECISIONS G4)
// ---------------------------------------------------------------------------

/**
 * How hard a rival leans on what its location report says.
 *
 * A percentage per step of relative value: a tier worth twice the account's
 * average earns +LOCATION_LEAN, one worth nothing earns -LOCATION_LEAN. Modest,
 * because a rival that swung to -100% on a thin week would take itself out of a
 * third of the market on noise.
 */
const LOCATION_LEAN = 200;

/** `spender` leans hardest, on the same evidence. Impatience, not insight. */
const SPENDER_LOCATION_LEAN = 320;

/** `cautious` leans least, and is never well placed as a result. */
const CAUTIOUS_LOCATION_LEAN = 100;

/** Ignore a tier until it has enough clicks to be saying anything. */
const LOCATION_MIN_CLICKS = 40;

/**
 * Where this advertiser should bid more, and where less.
 *
 * IT LEARNS THIS, IT IS NOT TOLD IT. `policies.js` imports nothing from
 * `engine/` - that is what makes its guard absolute - so a policy cannot read
 * the table that says where its buyers are. It has only its own report, which
 * is exactly what the player has. Anything a policy knows, it was handed.
 *
 * WHAT IT READS IS NET OF RETURNS, and that is the whole reason this is worth
 * doing. Gross revenue per click is highest wherever baskets are biggest, so a
 * policy reading gross would pile into the metros and stay there. Returns
 * resolve late - a return window on top of an attribution lag - so a rival
 * leans toward the metros first and then discovers, several rounds in, what the
 * towns actually cost it. That lag IS the lesson, and a rival experiences it on
 * the same terms the player does.
 *
 * Tiers with too little traffic to mean anything are left alone rather than
 * guessed at, which keeps a rival from abandoning a location on one thin week.
 *
 * @param {object} self own view
 * @param {object|null} report own report, or null in round 1
 * @param {number} lean how hard this character leans, as a percentage
 * @returns {number[]|null} adjustments, or null to leave them alone
 */
export function locationTilt(self, report, lean = LOCATION_LEAN, { net = true } = {}) {
  const current = self.campaign?.locationAdjustments;
  if (!Array.isArray(current)) return null;

  const rows = report?.breakdown?.byLocation;
  if (!rows) return null;

  // Net of returns, per click. The two things location changes are the basket
  // and the return rate, so this is the only figure that sees both.
  const value = current.map((_, tier) => {
    const row = rows[tier];
    if (!row || row.clicks < LOCATION_MIN_CLICKS) return null;
    // `net: false` is not a bug, it is a character. `grossOptimiser` manages to
    // gross profit and therefore reads gross revenue here too - so it sees the
    // metros' bigger baskets, leans into them, and never learns what the towns
    // cost it, because the returns it is ignoring are the entire difference.
    // That is section 14's missing multiplication, applied to geography.
    const returned = net ? (row.returnedRevenuePaise ?? 0) : 0;
    return (row.grossRevenuePaise - returned) / row.clicks;
  });

  const known = value.filter((v) => v !== null && Number.isFinite(v));
  if (known.length < 2) return null;
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  if (!(mean > 0)) return null;

  return value.map((v, tier) => {
    if (v === null || !Number.isFinite(v)) return current[tier] ?? 0;
    // Relative to this account's own average, so a premium advertiser and a
    // value one are each judging against their own economics rather than
    // against a number neither of them can see.
    const relative = v / mean - 1;
    const move = Math.round(relative * lean);
    // Bounded by this character's own lean, so a timid rival cannot be swung
    // hard by one violent week.
    return clamp(move, -lean, lean);
  });
}

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

  // Where, as well as how much. A disciplined advertiser reads its own location
  // report the way it reads its search terms report - and it is reading net of
  // returns, so it leans toward the metros first and corrects once the towns
  // start sending things back.
  const locationAdjustments = locationTilt(self, report);

  const prepaid = prepaidNudge(self, report);

  return {
    campaign: {
      strategy: 'manual',
      negatives,
      ...(locationAdjustments ? { locationAdjustments } : {}),
      ...(prepaid === null ? {} : { prepaidDiscountPaise: prepaid }),
    },
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
  return Math.round(
    aovMeanPaise * marginPct * (1 - observedReturnRate(report)) * assumedConvRate(self),
  );
}

/**
 * Its own observed rate once it has one, and the briefing's guess until then.
 *
 * The uplift applies ONLY to the guess. An observed rate is measured on the
 * advertiser's own traffic and already carries whatever its territory converts
 * at; multiplying that again would be counting the same effect twice.
 */
function assumedConvRate(self) {
  const observed = self.bidding.observedConvRate;
  return observed ?? (ASSUMED_CONV_RATE * ASSUMED_TERRITORY_UPLIFT);
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

// ---------------------------------------------------------------------------
// spender
// ---------------------------------------------------------------------------

/**
 * Volume at any cost. The rival who has not read their search terms report.
 *
 * Everything on broad, nothing blocked, Maximise Clicks, and a bid above what
 * it can afford. It is not stupid — it is optimising the thing it is
 * measuring, which is traffic. Every mechanism it trips is one the design
 * wants visible:
 *
 *   - **broad match spills into other territory** (8.1), so it turns up in
 *     everybody's auctions and makes them more expensive
 *   - **and into irrelevant queries**, which convert at exactly zero (12.1).
 *     7.4 guarantees at least 5% of volume is worthless precisely so that this
 *     can happen to somebody
 *   - **impression share falls while impressions rise** (8.5), which is the
 *     single most counter-intuitive number in the report
 *   - **pacing throttles it** rather than cutting it off (13.4), so it runs
 *     out of money gradually and in the wrong hours
 *
 * **WHERE ITS LOSSES ACTUALLY COME FROM, measured by ablation over 12 markets
 * rather than assumed from this list.** Two levers carry all of it and they act
 * through different channels:
 *
 *   - **the price it pays.** 1.76x break-even once Maximise Clicks has
 *     multiplied again (see `SPENDER_AGGRESSION`). Worth +131% to fix.
 *   - **the clicks it buys.** Broad with no negatives halves what a click is
 *     worth — conversion rate 2.95% against 4.00%, gross per click 15.70
 *     against 33.83. Worth +147%.
 *
 * The two are sub-additive: together +256%, against the +471% they would give
 * if independent, because both change which auctions it wins and at what price.
 * **The location lean is innocent** at -2%, inside noise, despite being the
 * hardest in the cast — so a session looking for why this rival loses should
 * not start there.
 *
 * Its keywords only broaden if they carry tags. An untagged keyword matches
 * nothing on broad (8.4), so broadening one would silently remove it from the
 * auction — which would make this rival quieter, not louder.
 */
export function spender(self, report) {
  const affordable = affordableCpcPaise(self, report);
  // Leans harder than anyone on the same reading everybody else gets. It is not
  // better informed, it is less patient.
  const locationAdjustments = locationTilt(self, report, SPENDER_LOCATION_LEAN);

  return {
    // Negatives stay empty, every round. That is the whole character.
    campaign: {
      strategy: 'maxClicks',
      negatives: [],
      ...(locationAdjustments ? { locationAdjustments } : {}),
    },
    adGroups: self.adGroups.map((group) => ({
      ...group,
      keywords: group.keywords.map((keyword) => ({
        ...keyword,
        matchType: (keyword.tags?.length ?? 0) > 0 ? 'broad' : keyword.matchType,
        bidPaise: clamp(
          Math.round(affordable * SPENDER_AGGRESSION), MIN_BID_PAISE, MAX_BID_PAISE,
        ),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// cautious
// ---------------------------------------------------------------------------

/**
 * The rival who is frightened of overspending, and pays for it.
 *
 * Bids about a third of what it can afford, and raises only when it is losing
 * most of the market to rank. It is the mirror of `spender`: both manage to a
 * single number, and neither number is profit.
 *
 * What it demonstrates is that **being cheap is a decision with a cost**. It
 * shows a healthy CPA and a healthy ROAS all game, on a fraction of the volume
 * it could have had, and its `lostToRank` sits high enough to read straight off
 * the report (8.5). A player who copies its bidding will feel efficient and
 * finish poor.
 *
 * It is also the account where attribution lag hurts least, because it barely
 * spends — which is a genuinely misleading lesson, and is meant to be.
 */
export function cautious(self, report) {
  const affordable = affordableCpcPaise(self, report);
  const target = Math.round(affordable * CAUTIOUS_MARGIN_OF_SAFETY);

  if (!report) {
    return {
      campaign: { strategy: 'manual' },
      adGroups: withBids(self.adGroups, () => target),
    };
  }

  // Half the lean of anybody else. Being frightened of a wrong move is this
  // account's whole character, and it costs it here the same way it costs it on
  // price: it is never badly placed and never well placed either.
  const locationAdjustments = locationTilt(self, report, CAUTIOUS_LOCATION_LEAN);

  // It will creep upward, but only on overwhelming evidence, and never past
  // half of what it can afford.
  const desperate = report.share.lostToRank > CAUTIOUS_RANK_PANIC;
  const ceiling = Math.round(affordable * CAUTIOUS_CEILING);
  return {
    campaign: {
      strategy: 'manual',
      ...(locationAdjustments ? { locationAdjustments } : {}),
    },
    adGroups: withBids(self.adGroups, (keyword) => (desperate
      ? Math.min(Math.round(keyword.bidPaise * (1 + CAUTIOUS_CREEP)), ceiling)
      : target)),
  };
}

// ---------------------------------------------------------------------------
// automator
// ---------------------------------------------------------------------------

/**
 * The rival who reaches for a different bid strategy every time results dip.
 *
 * The most valuable of the six, because the mistake it makes is the one a real
 * advertiser makes most often and can least see.
 *
 * Every switch costs `LEARNING_ROUNDS` of multiplied prediction error (12.3),
 * and `game.js` writes that period because a pure engine cannot detect a
 * changed setting. So the account never gets far enough into any one strategy
 * to find out whether it worked. Worse, it judges each strategy on a report
 * that is 55% settled — a click shows all of its cost against about half its
 * revenue (11.4) — so it is reacting to numbers that have not finished moving.
 *
 * Stack that with F7 and it compounds. Premium generates a fraction of Value's
 * conversions, so its estimates stay noisy far longer and every learning period
 * costs it more. A premium `automator` is the worst account on the board, and
 * the reason is invisible from inside it.
 *
 * It sends `strategyParams` only when the strategy actually changes.
 * Re-sending them every round would trigger a learning period every round
 * (12.3), which is a caricature rather than a lesson.
 */
export function automator(self, report) {
  const affordable = affordableCpcPaise(self, report);

  if (!report) {
    return {
      campaign: { strategy: 'maxClicks' },
      adGroups: withBids(self.adGroups, () => Math.round(affordable * TARGET_MARGIN_OF_SAFETY)),
    };
  }

  const current = self.campaign.strategy;
  if (report.money.netRoas >= AUTOMATOR_ROAS_TARGET) {
    return { campaign: { strategy: current } };
  }

  const next = AUTOMATION_CYCLE[
    (AUTOMATION_CYCLE.indexOf(current) + 1) % AUTOMATION_CYCLE.length
  ];
  return {
    campaign: { strategy: next, strategyParams: paramsFor(next, self, affordable, report) },
  };
}

/** What each strategy has to be told. A missing or zero value throws (12.2). */
function paramsFor(strategy, self, affordable, report) {
  const params = { ...(self.campaign.strategyParams ?? {}) };
  if (strategy === 'targetCpa') {
    // Its own realised CPA — measured on a half-settled report, and therefore
    // too high. It will chase this number downward all game.
    const conversions = report.conversions.final;
    params.targetCpaPaise = conversions > 0
      ? Math.max(MIN_BID_PAISE, Math.round(report.traffic.costPaise / conversions))
      : Math.max(MIN_BID_PAISE, Math.round(affordable * AUTOMATOR_COLD_CPA_MULTIPLE));
  }
  if (strategy === 'targetRoas') {
    params.targetRoas = AUTOMATOR_ROAS_TARGET;
  }
  return params;
}

// ---------------------------------------------------------------------------
// grossOptimiser
// ---------------------------------------------------------------------------

/**
 * The section 14 trap, running as a competitor.
 *
 * It works out what it can pay for a click and forgets to subtract returns.
 * That is not a strawman: section 14 says outright that bid strategies optimise
 * to gross unless configured otherwise, because that is what a default Google
 * Ads conversion setup does. An order counts the moment it is placed.
 *
 * So it overpays by exactly the return rate, and **how badly depends on which
 * cell it landed in** — 20.5% at Premium-Performance, 56.3% at Value-Lifestyle
 * (DECISIONS F8). It is not equally wrong for everyone, and nobody can tell
 * which from the outside.
 *
 * It looks healthy on every number it watches. Gross ROAS is fine, gross CPA is
 * fine, volume is good. `netProfitPaise` is where it dies, and net profit is
 * revised into the report two rounds after the conversion lands (11.4), long
 * after the decision that caused it.
 *
 * It writes negatives, because it is not careless — it is careful about the
 * wrong number. A rival that were both sloppy AND gross-optimising would
 * confound the two lessons.
 */
export function grossOptimiser(self, report, view) {
  const affordable = grossAffordableCpcPaise(self);
  const target = Math.round(affordable * TARGET_MARGIN_OF_SAFETY);

  const negatives = report
    ? [
      ...(self.campaign.negatives ?? []),
      ...wastefulQueries(report, view, self.campaign.negatives ?? []),
    ]
    : (self.campaign.negatives ?? []);

  // Reads GROSS revenue per click, like everything else it manages to. So it
  // sees the metros' bigger baskets, leans into them, and never discovers what
  // the towns cost it - because the returns it is ignoring are the whole
  // difference. Section 14's missing multiplication, applied to geography.
  const locationAdjustments = locationTilt(self, report, LOCATION_LEAN, { net: false });

  const prepaid = prepaidNudge(self, report);

  return {
    campaign: {
      strategy: 'manual',
      negatives,
      ...(locationAdjustments ? { locationAdjustments } : {}),
      ...(prepaid === null ? {} : { prepaidDiscountPaise: prepaid }),
    },
    adGroups: withBids(self.adGroups, () => target),
  };
}

/**
 * What this advertiser believes it can pay, having never netted out returns.
 *
 * Identical to `affordableCpcPaise` with the retention term deleted. That one
 * missing multiplication is the whole of section 14.
 *
 * @param {object} self
 * @returns {number} integer paise
 */
export function grossAffordableCpcPaise(self) {
  const { aovMeanPaise, marginPct } = self.catalogue;
  return Math.round(aovMeanPaise * marginPct * assumedConvRate(self));
}

// ---------------------------------------------------------------------------
// brandDefender
// ---------------------------------------------------------------------------

/**
 * The rival who bids on names — its own, and everybody else's.
 *
 * WHAT IT CAN AND CANNOT SEE, WHICH IS THE INTERESTING PART
 *
 * `getPublicView` exposes each query's `intent`, so this policy can tell which
 * searches are brand searches. It does NOT expose `brandOwner`; that is
 * withheld from everyone (16.1). But it DOES expose every advertiser's name,
 * because the Ads Transparency Center makes identity public (R3).
 *
 * So ownership has to be **inferred**, by reading the query text and looking
 * for a name inside it. That is exactly the inference 17.1 asks a player to
 * make, from exactly the same information. A query it cannot attribute is left
 * alone rather than guessed at.
 *
 * WHAT IT DEMONSTRATES
 *
 * Bidding on a competitor's trademark is permitted and converts terribly:
 * `BRAND_POACHER_MULTIPLIER` is 0.25 against 2.5 for the owner, a tenfold gap
 * (12.1). So poaching is a real option that is usually a bad one, while
 * defending your own name is cheap and almost always right.
 *
 * It also produces the misreading section 16 warns about in as many words. A
 * player watching Auction Insights sees this rival overlapping them constantly
 * on a single query and concludes it is a major competitor. Overlap rate is not
 * market share and is not spend.
 *
 * Its brand keywords are exact and carry no tags. An untagged keyword works
 * normally on exact and phrase and is inert on broad (8.4), which is right: a
 * name is a string, and nothing about it should be matched loosely.
 *
 * IT MATCHES ON THE DISTINCTIVE TOKEN, NOT THE REGISTERED NAME, and that
 * distinction is not pedantry. The roster holds "Vella & Co."; the brand query
 * it owns reads "vella leggings". Nobody searches a company's legal name with
 * its ampersand attached. Matching the full string found ownership for eight of
 * the nine and silently missed the one whose name has more than a word in it —
 * the kind of gap that hides until the roster changes.
 */
export function brandDefender(self, report, view) {
  const affordable = affordableCpcPaise(self, report);
  const names = (view.advertisers ?? [])
    .map((a) => ({ id: a.id, token: brandToken(a.name) }))
    .filter((n) => n.token);

  const [first, ...rest] = self.adGroups;
  const already = new Set(first.keywords.map((k) => k.text.toLowerCase()));
  const added = [];

  for (const query of view.querySet ?? []) {
    if (query.intent !== 'brand') continue;
    const text = query.text.toLowerCase();
    if (already.has(text)) continue;

    const owner = names.find((n) => mentions(text, n.token));
    if (!owner) continue;

    const mine = owner.id === self.id;
    already.add(text);
    added.push({
      id: `kw_brand_${query.id}`,
      text: query.text,
      matchType: 'exact',
      bidPaise: clamp(
        Math.round(affordable * (mine ? BRAND_DEFENCE_MULTIPLE : BRAND_POACH_MULTIPLE)),
        MIN_BID_PAISE, MAX_BID_PAISE,
      ),
      active: true,
      tags: [],
      taggedContentHash: null,
    });
  }

  return {
    campaign: { strategy: 'manual' },
    adGroups: [
      {
        ...first,
        keywords: [
          ...first.keywords.map((keyword) => ({
            ...keyword,
            bidPaise: clamp(
              Math.round(affordable * TARGET_MARGIN_OF_SAFETY), MIN_BID_PAISE, MAX_BID_PAISE,
            ),
          })),
          ...added,
        ],
      },
      ...rest,
    ],
  };
}

/**
 * The word a brand is actually searched by.
 *
 * The first alphanumeric run of the name, lowercased. "Vella & Co." becomes
 * "vella", which is what its brand query contains.
 *
 * @param {string} name
 * @returns {string|null}
 */
function brandToken(name) {
  const match = String(name ?? '').toLowerCase().match(/[a-z0-9]+/);
  return match ? match[0] : null;
}

/** Whole-word only, so a short name cannot match inside a longer word. */
function mentions(text, token) {
  return new RegExp(`\\b${token}\\b`).test(text);
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

/**
 * The order rivals are dealt policies in, so every character is in the market.
 *
 * `disciplined` is the competent baseline; the other five are each wrong about
 * one thing in a legible way, which is what makes the market worth reading.
 *
 * This lived in `ui/app.js` as a private array, which is why
 * `advertiser.policyId` stayed null in every real game: the view assigned a
 * policy by index and never wrote the id back. `setup.js` deals from this list
 * now, so a rival's policy is part of its state rather than a fact only one
 * caller knows. Order preserved exactly, so the market a seed produces is
 * unchanged.
 */
export const RIVAL_CAST = Object.freeze([
  'spender', 'cautious', 'automator', 'grossOptimiser', 'brandDefender', 'disciplined',
]);

/** Every rule-based policy, by the id `advertiser.policyId` carries. */
export const POLICIES = Object.freeze({
  disciplined,
  spender,
  cautious,
  automator,
  grossOptimiser,
  brandDefender,
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
