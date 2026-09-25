/**
 * Round 0's rules (plans/2026-09-14-round-zero-redesign.md, section 8): what
 * the month holds, what a bid must clear, how the ad grades, and what Go
 * sends. Pure: nothing here touches the page, so the classic round 0 and the
 * Studio's five steps read the same answers, and a test can read them too.
 *
 * MOVED FROM ui/round-zero.js, NOT REWRITTEN. Each function kept the comment
 * that explains why it is the way it is; ui/round-zero.js re-exports the ones
 * its tests import.
 */

import { placeRivals, buildRivals } from '../../setup.js';
import { BRAND_IDENTITIES, assignIdentities, brandById, brandNamedIn } from '../../content/brands.js';
import { cellKey, parseCell, landingPageBonus } from '../../engine/positions.js';
import { keywordReach } from '../../engine/matching.js';
import { writerCopyFor, WRITER_COPY_VARIANTS } from '../../content/writerCopy.js';
import { explainGrade, validateAdCopy } from '../../agents/grader.js';
import { tagKeywordOffline } from '../../agents/keywordTagger.js';
import {
  MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH,
  CREATIVE_ALLOCATION_PAISE, PRICE_TIERS, PURPOSES,
  CAPEX_DELAY_ROUNDS, MIN_BID_PAISE, WRITER_TIERS,
} from '../../engine/constants.js';
import {
  writerTier, isDiy, hiredCopyGrades, openingCopyGrades,
} from '../../content/writers.js';
import {
  composeDescription, PAGE_FEATURES, pageAsItStands, pagePoints, COMPOSE_ORDER,
} from '../../content/landingPage.js';
import { lowestBidToShowPaise, wholeRupeeBid } from '../reserve.js';

/**
 * The landing page description is DERIVED, never typed (DECISIONS I9).
 *
 * It used to be a text box whose own hint said "it exists to be graded", and
 * the grader read it for two regexes — so writing the words "size guide" earned
 * the grade that BUYING one costs capital for. Composing it from the capital
 * instead means a claim without a purchase behind it cannot be made.
 */
export function syncPage(draft) {
  draft.ad.landingPageDescription = composeDescription(draft.capex);
}

/** Has anybody put words in the two boxes that block the Go button? */
const anyCopyWritten = (ad) => [...(ad.headlines ?? []), ...(ad.descriptions ?? [])]
  .some((line) => String(line).trim() !== '');

/**
 * Fill the ad boxes from the writer the player hired, or empty them (I25).
 *
 * A player paid 50,000 for the retainer and could not start the game, because
 * the Go button asks `validateAdCopy` and the description boxes were empty.
 * They had hired a copywriter and were still required to write the copy.
 *
 * THREE RULES, AND EACH ONE IS A WAY THIS COULD GO WRONG.
 *
 * A hired writer's ad is ALWAYS the writer's copy, and the player's own words
 * are set aside in `draft.ownAd`, never lost. `draft.adIsSeeded` records whose
 * words are in the boxes. This used to leave hand-written words in place under
 * a hired writer, which suited the classic page, whose boxes show for every
 * writer; the Studio shows them only for Write it yourself, so those words sat
 * in the account unseen, and if they broke Google's limits Go stayed blocked
 * with nothing on screen to fix. The owner changed it (2026-09-14, I25).
 *
 * On the way to DIY the writer's copy goes, and the player's own words come
 * back, or empty boxes if there are none. The words belong to the writer who
 * was paid for them, and carrying an agency's copy into DIY takes something the
 * player did not buy — measured, retainer copy grades `adRelevance` 1 against
 * the keywords, so keeping it would punish them for holding on to the best
 * writing in the game.
 *
 * The variant follows `rootSeed`, which `app.js` increments for a new market,
 * so restarting shows a different ad rather than the same one three times.
 */
export function syncWriterCopy(draft, rootSeed) {
  if (isDiy(draft.writerTier)) {
    if (draft.adIsSeeded) {
      const own = draft.ownAd ?? { headlines: ['', '', ''], descriptions: ['', ''] };
      draft.ad.headlines = [...own.headlines];
      draft.ad.descriptions = [...own.descriptions];
      draft.adIsSeeded = false;
    }
    return;
  }
  // The player's own words, as they last left them, blanks included.
  if (!draft.adIsSeeded) {
    draft.ownAd = anyCopyWritten(draft.ad)
      ? { headlines: [...draft.ad.headlines], descriptions: [...draft.ad.descriptions] }
      : null;
  }

  const brand = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
  const copy = writerCopyFor(
    draft.cell, draft.writerTier, brand.name, rootSeed % WRITER_COPY_VARIANTS,
  );
  draft.ad.headlines = copy.headlines;
  draft.ad.descriptions = copy.descriptions;
  draft.adIsSeeded = true;
}

/** Capital committed so far, across the targets. */
export function committed(draft) {
  return Object.values(draft.capex).reduce((a, b) => a + b, 0);
}

/**
 * Keyword Planner: text, weekly volume, intent. Nothing else exists here.
 * What a query does after the click is earned by running it (16.1, C4).
 */
export function researchList(querySet) {
  return querySet.queries.map((query) => ({
    id: query.id,
    text: query.text,
    intent: query.intent,
    weekly: Math.round((querySet.weeklyVolume * query.volumeShareBp) / 10000),
  })).sort((a, b) => b.weekly - a.weekly);
}

/**
 * The search a brand's name brings with it, counted as the planner counts it:
 * the one thing choosing among the nine decides. Ownership is read from the
 * words, the way a player would, because `brandOwner` is withheld from every
 * viewer (16.1).
 *
 * @param {string} brandId
 * @param {object} querySet
 * @returns {{id: string, text: string, intent: string, weekly: number}|null}
 */
export function ownSearch(brandId, querySet) {
  const me = brandById(brandId);
  return researchList(querySet).find((q) => q.intent === 'brand' && brandNamedIn(q.text, [me])) ?? null;
}

/**
 * The price x purpose grid, as rows and columns rather than a flat list.
 *
 * `.cell-grid` was already a three-column CSS grid, and `allCells()` returns the
 * six cells price-major — so flowing them 3-across put **mid|lifestyle directly
 * under value|performance**. It rendered as a 3x2 matrix whose position carried
 * no meaning, on the one screen whose job is to teach the model the whole game
 * rests on (4.1). Nothing caught it because nothing described the layout as data.
 *
 * Built from the engine's own `PRICE_TIERS` and `PURPOSES` rather than a list
 * typed here, so a change to either vocabulary moves the grid with it.
 *
 * @returns {{prices: string[], rows: Array<{purpose: string,
 *   cells: Array<{key: string, price: string, purpose: string}>}>}}
 */
export function positionMatrix() {
  return {
    prices: [...PRICE_TIERS],
    rows: PURPOSES.map((purpose) => ({
      purpose,
      cells: PRICE_TIERS.map((price) => ({ key: cellKey(price, purpose), price, purpose })),
    })),
  };
}

/**
 * Each week's share of what is PLANNED, for the shape of the split.
 *
 * Of the plan rather than of the month, so the bar draws the shape the player
 * made even while it does not add up to the month yet — the summary line beside
 * it is what says whether anything is unallocated.
 *
 * @param {number[]} split paise per week
 * @returns {number[]} fractions summing to 1, or zeros when nothing is planned
 */
export function splitShares(split = []) {
  const planned = split.reduce((a, b) => a + b, 0);
  if (planned <= 0) return split.map(() => 0);
  return split.map((amount) => amount / planned);
}

/**
 * The ad exactly as the Go button will submit it.
 *
 * ONE OBJECT, because grading a different one is what produced this bug. Round 0
 * used to grade `draft.ad` — which holds `['', '']` in the description slots
 * until submit strips them — and submit sent the stripped version. A player who
 * left the descriptions blank was shown 8 · 8 · 8 and given 8 · 8 · 4: the
 * stripped ad has no descriptions, so `validateAdCopy` fails it and
 * `OVERLONG_CEILING` caps every component at 4, and a hired tier then overwrote
 * the two copy components and hid it. The landing page was the only place the
 * damage showed, on a page the player had spent ₹80,000 on.
 *
 * @param {object} draft
 * @returns {{headlines: string[], descriptions: string[], landingPageDescription: string}}
 */
export function submittedAd(draft) {
  return {
    headlines: (draft.ad?.headlines ?? []).filter(Boolean),
    descriptions: (draft.ad?.descriptions ?? []).filter(Boolean),
    // Composed from the capital by `syncPage`, never typed (I9).
    landingPageDescription: draft.ad?.landingPageDescription ?? '',
  };
}

/**
 * The grading context the ACCOUNT will be graded in.
 *
 * `rivalNames` is the half round 0 used to leave out, so the trademark penalty
 * (8.7, −4 on `adRelevance`) was invisible on the one screen that shows a grade:
 * the card warned in words and left the number alone, which reads as cosmetic
 * when it is worth four points. `setup.js` passes exactly this.
 */
export function gradingContext(draft) {
  return {
    keywords: draft.keywords,
    rivalNames: BRAND_IDENTITIES
      .filter((b) => b.id !== draft.playerBrandId)
      .map((b) => b.name),
  };
}

/**
 * How the ad round 0 is about to submit will actually grade.
 *
 * `written` is what the player earned; `applied` is what will run, which differs
 * when a writer was hired. Every screen in round 0 that shows a grade reads this
 * one function, so they cannot disagree with each other or with the account.
 *
 * @param {object} draft
 * @returns {{ad: object, written: object, applied: object, checks: object[], notes: string[]}}
 */
export function gradeAsSubmitted(draft) {
  const ad = submittedAd(draft);
  const { grade, checks, notes } = explainGrade(ad, gradingContext(draft));
  const hired = !isDiy(draft.writerTier);
  return {
    ad,
    written: grade,
    // What will ACTUALLY apply. A hired tier sets the two copy components and
    // nothing else — the landing page is graded from the page the capital built.
    applied: hired ? { ...grade, ...hiredCopyGrades(draft.writerTier) } : grade,
    checks,
    notes,
  };
}

/**
 * Can each keyword's bid actually clear the reserve, at the grade the FIRST
 * auction will run at?
 *
 * `AD_RANK_FLOOR` is a reserve rather than an eligibility gate (B5). An
 * advertiser under it enters every auction and shows in none, and the report
 * calls that "lost to rank 100%" — which reads as being OUTBID and sends a
 * player to raise keyword bids, when the bid was never the binding thing.
 * `minimumBidToShowPaise` exists for exactly this warning and says so; round 0
 * was not calling it. It now asks `lowestBidToShowPaise` (ui/reserve.js), which
 * prices the floor at the hour the signal is strongest: priced without the
 * hour, a bid it called unable to show at all still cleared the reserve at 7pm.
 *
 * THE GRADE IS THE ONE THE FIRST AUCTION RUNS AT: a hire's level, or since
 * 2026-09-14 (I11) the words as written. A weak ad of your own raises this
 * floor; a better one lowers it, and so does raising the bid. It comes from
 * `openingCopyGrades` so this screen and `creativeBlock` cannot disagree.
 *
 * No landing-page bonus is added, and that is not an omission: round 0's capital
 * goes live at round 4 (`liveAtRound`), so `landingPageBonus` is zero for the
 * first three rounds and the copy lands before the capital does. Capital cannot
 * lower this floor. Nor, since 2026-09-17, can the page it builds: the first
 * auction runs on the page as it stands in week 1 (`pageAsItStands`), which is
 * the plain page whatever round 0 committed.
 *
 * @param {object} draft round 0's own draft
 * @param {object} querySet
 * @returns {{grade: object, rows: Array<{text: string, bidPaise: number,
 *   needPaise: number, clears: boolean}>, under: Array<object>,
 *   worstShortfall: {text: string, needPaise: number, bidPaise: number}|null}}
 */
export function openingReserve(draft, querySet) {
  const written = gradeAsSubmitted(draft).written;
  const grade = {
    ...openingCopyGrades(draft.writerTier, 0, written),
    // The player's own page as it stands in the first week (I9; the owner,
    // 2026-09-17): nothing round 0 commits is live yet.
    landingPage: pageAsItStands(capitalOf(draft), 1).landingPage,
  };

  const rows = (draft.keywords ?? []).map((keyword) => {
    // The keyword's own literal search, which is the most favourable query it
    // could meet, at its best hour. Failing there means failing everywhere, at
    // any hour, against anyone. Round 0 has no bid adjustments yet. Priced with
    // the tags startGame will give it (E9): a keyword whose tags match its search
    // runs a fit of up to 1.15, and priced untagged the floor sat that much high.
    const tagged = { ...keyword, tags: tagKeywordOffline(keyword, querySet).tags };
    const needPaise = lowestBidToShowPaise({ grade, keyword: tagged, querySet });
    return {
      text: keyword.text,
      bidPaise: keyword.bidPaise,
      needPaise,
      clears: keyword.bidPaise >= needPaise,
    };
  });

  const under = rows.filter((r) => !r.clears);
  return {
    grade,
    rows,
    under,
    // The largest gap, because that is the number that makes the point.
    worstShortfall: under.length === 0
      ? null
      : under.reduce((a, b) => (b.needPaise - b.bidPaise > a.needPaise - a.bidPaise ? b : a)),
  };
}

/**
 * The month this form is dividing into four weeks.
 *
 * THREE TERMS, AND THE MIDDLE ONE WAS MISSING. The base month, plus whatever the
 * writer did not cost, plus whatever capital is left uncommitted — 13.3 rolls both
 * remainders into advertising money.
 *
 * `rerender` puts the writer card before this one deliberately, and its comment
 * says why: *"whatever the writer did not cost rolls into the month this
 * divides"*. The ordering existed for a dependency this function did not honour,
 * so the writer card promised a ₹50,000 rollover and the card below it divided a
 * month without it. Correct only for a retainer, where the rollover is zero,
 * which is why it read as a plausible number.
 *
 * It is the month AFTER the rollovers arrive, not the ₹1,68,000 the account holds
 * at this instant, because these four boxes are spent in rounds 1 to 4 and the
 * capital lands at round 1. `tests/roundZero.test.js` pins it against the month
 * the account reports once the week has run.
 *
 * @param {object} draft
 * @returns {number} integer paise
 */
export function monthlyBudget(draft) {
  const writerLeft = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;
  return MONTHLY_BUDGET_PAISE + writerLeft + (CAPEX_ALLOCATION_PAISE - committed(draft));
}

/** A month split evenly across its weeks; the first week takes the odd paise. */
export function evenSplit(total) {
  const each = Math.floor(total / ROUNDS_PER_MONTH);
  const split = new Array(ROUNDS_PER_MONTH).fill(each);
  split[0] += total - each * ROUNDS_PER_MONTH;
  return split;
}

/**
 * The eight rival ads, as the market will run them (17.1).
 *
 * THE SAME BUILDER startGame USES, with the same seed, so what is read in round
 * 0 is what will be played against, including which of a cell's two ads each
 * rival wears. Sorted by name, and carrying no cell: position is in the words.
 *
 * @param {number} rootSeed
 * @param {string} playerBrandId
 * @param {object} querySet
 * @returns {Array<{name: string, domain: string, ad: object}>}
 */
export function rivalAds(rootSeed, playerBrandId, querySet) {
  const { rivals: identities } = assignIdentities(playerBrandId);
  const placement = placeRivals(rootSeed, identities.length);
  return buildRivals(identities, placement, querySet, () => 0.5)
    .map((rival) => ({ name: rival.name, domain: rival.domain, ad: rival.adGroups[0].ad }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

// ---------------------------------------------------------------------------
// The Studio's five steps (plans/2026-09-14-round-zero-redesign.md, section 4)
// ---------------------------------------------------------------------------

/** The order step 5 draws the targets in: the page first, as round 0 always has. */
export const CAPEX_ORDER = Object.freeze(['landingPage', 'sizeGuide', 'photography', 'orderConfirmation']);

/** Round 0's starting bid for a keyword, as the classic planner's. */
export const SETUP_BID_PAISE = 3000;

/** The round capital committed in round 0 goes live at. */
const CAPITAL_LIVE_AT = 1 + CAPEX_DELAY_ROUNDS;

const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The draft the five steps fill in.
 *
 * THE FREELANCER, NOT WRITING IT YOURSELF, is the writer a player arrives on,
 * so somebody who does not want to write never meets five empty boxes (the
 * spec's section 4, step 4). `syncWriterCopy` puts the freelancer's copy in.
 *
 * `guesses` are the player's notes on where each rival sits: never sent, and
 * never confirmed by the game (section 4, step 2). `ownAd` holds the player's
 * own words while a hired writer's copy is in the ad (`syncWriterCopy`).
 *
 * @param {{playerBrandId: string, rootSeed: number}} args
 * @returns {object}
 */
export function createSetupDraft({ playerBrandId, rootSeed }) {
  const draft = {
    playerBrandId,
    cell: 'mid|performance',
    capex: Object.fromEntries(CAPEX_ORDER.map((key) => [key, 0])),
    keywords: [],
    ad: { headlines: ['', '', ''], descriptions: ['', ''], landingPageDescription: '' },
    writerTier: 'freelancer',
    adIsSeeded: false,
    ownAd: null,
    split: null,
    guesses: {},
  };
  syncPage(draft);
  syncWriterCopy(draft, rootSeed);
  return draft;
}

/** Choose a square. The writer's copy is written for the square, so it follows. */
export function setCell(draft, cell, rootSeed) {
  draft.cell = cell;
  syncWriterCopy(draft, rootSeed);
}

/**
 * Choose the brand, one of the nine (I35, reopened by the owner 2026-09-15).
 * The brand left becomes a rival, and a hired writer's copy, which carries the
 * name, is written again.
 *
 * THE NOTES FOLLOW THE ADS, NOT THE NAMES. Rivals are dealt around the player
 * in the brands' fixed order (`assignIdentities`), so another brand moves up to
 * seven names onto different ads, while the eight ads and their squares stay
 * the same. A note is the player's reading of an ad, so it goes wherever that
 * ad went. Matching by name would leave notes on ads the player never read.
 *
 * @param {object} draft
 * @param {string} brandId - refused, with the draft untouched, unless one of the nine
 * @param {number} rootSeed
 * @param {object} querySet
 */
export function setBrand(draft, brandId, rootSeed, querySet) {
  brandById(brandId);
  const adText = (ad) => JSON.stringify([ad.headlines, ad.descriptions]);
  const wasOn = new Map(rivalAds(rootSeed, draft.playerBrandId, querySet).map((r) => [r.name, adText(r.ad)]));
  const nowOn = new Map(rivalAds(rootSeed, brandId, querySet).map((r) => [adText(r.ad), r.name]));
  const guesses = {};
  for (const [name, cell] of Object.entries(draft.guesses ?? {})) {
    const wearer = nowOn.get(wasOn.get(name));
    if (wearer) guesses[wearer] = cell;
  }
  draft.guesses = guesses;
  draft.playerBrandId = brandId;
  syncWriterCopy(draft, rootSeed);
}

/**
 * Choose who writes the ad. The month changes with the fee, so an edited
 * weekly split no longer adds up and goes back to even.
 */
export function setWriter(draft, tierId, rootSeed) {
  writerTier(tierId);
  draft.writerTier = tierId;
  syncWriterCopy(draft, rootSeed);
  draft.split = null;
}

/** A keystroke in one of the ad's boxes: the words are now the player's (I25). */
export function writeAd(draft, part, index, text) {
  draft.ad[part][index] = text;
  draft.adIsSeeded = false;
}

/** @returns {Array<{id: string, label: string, pricePaise: number, grade: number|null, on: boolean}>} */
export function writerOptions(draft) {
  return WRITER_TIERS.map((tier) => ({
    id: tier.id, label: tier.label, pricePaise: tier.pricePaise, grade: tier.grade,
    on: tier.id === draft.writerTier,
  }));
}

/**
 * The two grades the ad sets, as the auction will use them from week 1.
 *
 * @returns {{expectedCtr: number, adRelevance: number, byWriter: boolean,
 *   checks: object[], notes: string[]}}
 */
export function adGrades(draft) {
  const { applied, checks, notes } = gradeAsSubmitted(draft);
  return {
    expectedCtr: applied.expectedCtr,
    adRelevance: applied.adRelevance,
    byWriter: !isDiy(draft.writerTier),
    checks,
    notes,
  };
}

/** The capital as Go will send it: the block `startGame` reads (C8). */
export function capitalOf(draft) {
  return {
    committed: { ...draft.capex },
    pending: CAPEX_ORDER
      .filter((target) => draft.capex[target] > 0)
      .map((target) => ({ target, paise: draft.capex[target], liveAtRound: CAPITAL_LIVE_AT })),
    remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE - committed(draft),
  };
}

/**
 * A target's rungs, each marked chosen and affordable. A rung is affordable
 * when what is committed to this target plus what is left would buy it:
 * photography's top rung never is in round 0.
 */
export function capexRungs(draft, key) {
  const left = CAPEX_ALLOCATION_PAISE - committed(draft);
  return PAGE_FEATURES[key].map((rung) => ({
    paise: rung.paise,
    label: rung.label,
    on: draft.capex[key] === rung.paise,
    affordable: rung.paise <= draft.capex[key] + left,
  }));
}

/** Choose a rung. The page's description follows it (I9); the month re-splits. */
export function setCapex(draft, key, paise) {
  const rung = capexRungs(draft, key).find((r) => r.paise === paise);
  if (!rung) return { ok: false, reason: 'no such rung' };
  if (!rung.affordable) return { ok: false, reason: 'more than the capital left' };
  draft.capex[key] = paise;
  syncPage(draft);
  draft.split = null;
  return { ok: true };
}

/**
 * The landing page grade, the third part of Quality Score, as the engine will
 * run it: the page as it stands that week, graded (I9), plus the page's own
 * capital as points once the site goes live (`landingPageBonus`, 13.3), capped
 * at 10 as `round.js` caps it.
 *
 * THE TIMING QUESTION IS SETTLED (the owner, 2026-09-17: grade the page as it
 * stands). The page the capital describes used to count from week 1, three weeks
 * before the work existed. Week 1 now runs on the plain page and week 4 on the
 * page the capital builds, read from `pageAsItStands`, the function game.js lands
 * before each week's auctions, so this screen and the auction cannot disagree.
 *
 * AND IT SAYS WHICH PURCHASE EARNED IT (the owner, 2026-09-18). The size guide
 * card said it moves parcels sent back while this bar rose beside it, and nothing
 * said which purchase had moved it. `parts` is each purchase's own points from
 * `pagePoints` — the function Your ad's breakdown reads, so the two screens cannot
 * disagree — with the page's site work among the page's own. `total` is the plain
 * sum, which may pass ten; `fromWeek4` is what the auction runs on, capped.
 *
 * @returns {{fromWeek1: number, fromWeek4: number, liveAt: number, start: number,
 *   parts: Array<{target: string, points: number}>, total: number, capped: boolean}}
 */
export function landingGrade(draft) {
  const block = capitalOf(draft);
  const at = (round) => Math.min(10, pageAsItStands(block, round).landingPage + landingPageBonus(block, round));
  const points = pagePoints(block, CAPITAL_LIVE_AT);
  // Every rule a new game grades by is earned by one ladder's sentences (I38), so
  // a line names its earner; the page keeps any that no purchase earns alone.
  const earnedBy = (target) => points.lines
    .filter((line) => (line.by.length === 1 ? line.by[0] === target : target === 'landingPage'))
    .reduce((sum, line) => sum + line.points, 0);
  return {
    fromWeek1: at(1),
    fromWeek4: at(CAPITAL_LIVE_AT),
    liveAt: CAPITAL_LIVE_AT,
    start: points.start,
    parts: COMPOSE_ORDER.map((target) => ({ target, points: earnedBy(target) }))
      .filter((part) => part.points !== 0),
    total: points.total,
    capped: points.total > points.grade,
  };
}

/** Where the month comes from, for step 5's bar. A part worth nothing is left out. */
export function monthParts(draft) {
  return [
    { key: 'base', paise: MONTHLY_BUDGET_PAISE },
    { key: 'writer', paise: CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise },
    { key: 'kept', paise: CAPEX_ALLOCATION_PAISE - committed(draft) },
  ].filter((part) => part.paise > 0);
}

/** The four weeks: even, unless the player has changed one. */
export function weeklySplit(draft) {
  return draft.split ?? evenSplit(monthlyBudget(draft));
}

/** Change one week of the split; the rest keep what they had. */
export function setWeek(draft, index, paise) {
  const split = [...weeklySplit(draft)];
  split[index] = Math.max(0, Math.round(paise));
  draft.split = split;
}

/**
 * Add a keyword, once however it is typed.
 *
 * @returns {{ok: boolean, reason?: 'empty'|'held'}}
 */
export function addSetupKeyword(draft, text, { matchType = 'phrase', bidPaise = SETUP_BID_PAISE } = {}) {
  const clean = normal(text);
  if (!clean) return { ok: false, reason: 'empty' };
  if (draft.keywords.some((k) => normal(k.text) === clean)) return { ok: false, reason: 'held' };
  draft.keywords.push({ text: clean, matchType, bidPaise: Math.max(MIN_BID_PAISE, Math.round(bidPaise)) });
  return { ok: true };
}

/** Change a keyword's match type or bid; a bid never goes under the minimum. */
export function updateSetupKeyword(draft, text, change) {
  const keyword = draft.keywords.find((k) => k.text === text);
  if (!keyword) return { ok: false };
  if (change.matchType) keyword.matchType = change.matchType;
  if (change.bidPaise !== undefined) keyword.bidPaise = Math.max(MIN_BID_PAISE, Math.round(change.bidPaise));
  return { ok: true };
}

/** Take a keyword out. */
export function removeSetupKeyword(draft, text) {
  const i = draft.keywords.findIndex((k) => k.text === text);
  if (i >= 0) draft.keywords.splice(i, 1);
  return { ok: i >= 0 };
}

/**
 * Each keyword as the kit's card draws it (ui/kit/card.js), before any week
 * has run: no score, no figures, no "was". The tags are the ones the account
 * will be given (E9), shown on broad only (E8). `needPaise` is set only when
 * the bid cannot clear the reserve at the grade the account opens on.
 */
export function setupKeywordCards(draft, querySet) {
  const reserve = openingReserve(draft, querySet);
  return draft.keywords.map((keyword, i) => {
    const tags = tagKeywordOffline({ text: keyword.text }, querySet).tags;
    const broad = keyword.matchType === 'broad';
    return {
      id: keyword.text,
      text: keyword.text,
      matchType: keyword.matchType,
      bidPaise: keyword.bidPaise,
      reach: keywordReach({ text: keyword.text, matchType: keyword.matchType, tags }, querySet),
      tags: broad ? tags : null,
      noTagsOnBroad: broad && tags.length === 0,
      wasBidPaise: null,
      wasMatchType: null,
      isNew: true,
      // Nothing to have changed from before the first week: no red outline.
      changed: false,
      stats: null,
      quality: { value: null, ratings: [] },
      active: null,
      needPaise: reserve.rows[i].clears ? null : wholeRupeeBid(reserve.rows[i].needPaise),
      // THE SAME NUMBER, KEPT WHETHER THE BID CLEARS IT OR NOT (2026-09-25).
      // `needPaise` is the warning's trigger and is null once the bid is high
      // enough; the slider draws the reserve on its track, so it needs the
      // figure always. Round 0 is where it matters most — it is where a
      // beginner sets a first bid, which is why the reserve warning exists.
      floorPaise: wholeRupeeBid(reserve.rows[i].needPaise),
    };
  });
}

/** Note a rival in a square; the same square again takes the note back. */
export function setGuess(draft, rivalName, cell) {
  if (draft.guesses[rivalName] === cell) delete draft.guesses[rivalName];
  else draft.guesses[rivalName] = cell;
}

/** The rivals the player has noted in a square, by name. */
export function guessedIn(draft, cell) {
  return Object.keys(draft.guesses).filter((name) => draft.guesses[name] === cell).sort();
}

/**
 * WHAT STEP 2 SHOWS AT ONCE. One ad, opened by the player; the rest wait.
 *
 * Until 2026-09-24 the step drew all eight rival ads in full, simultaneously —
 * 612 words measured on the live site, against 119 on 2026-09-14, roughly 500
 * of them the ads. It asked a beginner on the second of five screens to read
 * eight competitors' copy, infer each one's price tier and purpose, place all
 * eight on a grid they met one screen ago, and then choose their own cell. The
 * task is the lesson (spec 4); eight at once is what a beginner cannot do.
 *
 * The bound this function exists to hold is **one ad on screen at a time**, and
 * it is here rather than in `./position.js` because a rule in a drawing module
 * cannot be tested — the same reason the reserve warning lives here.
 *
 * A PLACED RIVAL STAYS OPENABLE. Its chip on the grid is the way back in: a
 * player who placed Nira early and then reads a dearer ad has to be able to
 * check the first against the second. So `placed` and `open` can name the same
 * rival, and only `unread` is exclusive.
 *
 * @param {{name: string}[]} ads - `rivalAds()` output, the eight
 * @param {{guesses: Record<string, string>}} draft - round 0's draft
 * @param {string|null} openName - the rival the player has open, if any
 * @returns {{open: object|null, unread: object[], placed: object[]}}
 */
export function adStage(ads, draft, openName) {
  // A stale name fails soft: the open one is UI state and survives a redraw,
  // and changing brand swaps the whole cast.
  const open = ads.find((rival) => rival.name === openName) ?? null;
  const placed = ads.filter((rival) => rival.name in draft.guesses);
  const unread = ads.filter(
    (rival) => rival.name !== open?.name && !(rival.name in draft.guesses),
  );
  return { open, unread, placed };
}

/**
 * The player's notes, by rival, for the reveal after the last week.
 *
 * KEPT, NOT SENT (the owner, 2026-09-15). They never reach the account Go
 * opens (`startChoices`), but they travel with the save, so the reveal can
 * score what the player read from the ads before the first auction rather
 * than asking again once twelve weeks of auctions have told them more.
 *
 * By id, because the game's records name rivals by id, and only for the
 * rivals of the game Go opened: a note on the player's own name, or on a
 * name the game does not have, is dropped.
 *
 * @param {Record<string, string>} guesses - the draft's, rival name to square key
 * @param {object[]} advertisers - the started game's
 * @param {string} playerId
 * @returns {Record<string, string>} rival id to square key
 */
export function notesFor(guesses, advertisers, playerId) {
  const ids = new Map(advertisers.filter((a) => a.id !== playerId).map((a) => [a.name, a.id]));
  const notes = {};
  for (const [name, cell] of Object.entries(guesses ?? {})) {
    if (ids.has(name)) notes[ids.get(name)] = cell;
  }
  return notes;
}

/**
 * What Go waits for. `need` names what is missing, for the tray's words.
 *
 * @returns {Array<{key: string, done: boolean, need: string|null}>}
 */
export function checklist(draft) {
  const planned = weeklySplit(draft).reduce((a, b) => a + b, 0);
  return [
    { key: 'square', done: true, need: 'square' },
    { key: 'keywords', done: draft.keywords.length > 0, need: 'keyword' },
    { key: 'ad', done: validateAdCopy(submittedAd(draft)).valid, need: 'ad' },
    { key: 'money', done: planned <= monthlyBudget(draft), need: 'split' },
  ].map((item) => ({ ...item, need: item.done ? null : item.need }));
}

/** Whether Go may be pressed. */
export const canGo = (draft) => checklist(draft).every((item) => item.done);

/**
 * The ticks in the steps list. The two reading steps are done once seen; the
 * ad and money steps once seen and settled; keywords when one has been added,
 * which cannot happen without opening the step anyway.
 *
 * EVERY TICK MEANS "YOU HAVE BEEN HERE" (2026-09-20). `ad` used to ask only
 * whether the copy was valid, and a writer is hired by default, so step 4 was
 * ticked on the very first screen of round 0 — before the player had been
 * anywhere. It is the step that spends ₹10,000 of the ₹50,000 creative budget
 * without being asked, with "Write it yourself · free" beside it, so a tick
 * there sent people past the one choice that was quietly charging them. Found
 * by playing it; `tests/roundZeroRules.test.js` now holds the rule over every
 * step, so a later step with a sensible default cannot repeat it.
 *
 * @param {object} draft
 * @param {Set<string>} visited - step keys the player has opened
 */
export function stepsDone(draft, visited) {
  const money = checklist(draft).find((c) => c.key === 'money').done;
  return {
    market: visited.has('market'),
    position: visited.has('position'),
    keywords: draft.keywords.length > 0,
    ad: visited.has('ad') && validateAdCopy(submittedAd(draft)).valid,
    money: visited.has('money') && money,
  };
}

/**
 * What Go sends: exactly the shape the classic page's Go sends, so the account
 * opens the same way from either look. Guesses are not part of it: they go
 * beside it, to the save (`notesFor`).
 *
 * @returns {{playerBrandId: string, player: object}}
 */
export function startChoices(draft) {
  return {
    playerBrandId: draft.playerBrandId,
    player: {
      position: parseCell(draft.cell),
      capex: capitalOf(draft),
      keywords: draft.keywords.map((k) => ({ ...k })),
      ad: submittedAd(draft),
      weeklySplitPaise: [...weeklySplit(draft)],
      writerTier: draft.writerTier,
    },
  };
}
