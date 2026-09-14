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
import { BRAND_IDENTITIES, assignIdentities } from '../../content/brands.js';
import { cellKey, parseCell, landingPageBonus } from '../../engine/positions.js';
import { keywordReach } from '../../engine/matching.js';
import { writerCopyFor, WRITER_COPY_VARIANTS } from '../../content/writerCopy.js';
import { explainGrade, validateAdCopy } from '../../agents/grader.js';
import { heuristicTags, tagKeywordOffline } from '../../agents/keywordTagger.js';
import {
  MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH,
  CREATIVE_ALLOCATION_PAISE, PRICE_TIERS, PURPOSES,
  CAPEX_DELAY_ROUNDS, MIN_BID_PAISE, WRITER_TIERS,
} from '../../engine/constants.js';
import {
  writerTier, isDiy, hiredCopyGrades, openingCopyGrades,
} from '../../content/writers.js';
import { qualitySignalBase } from '../../engine/quality.js';
import { minimumBidToShowPaise } from '../../engine/auction.js';
import { composeDescription, PAGE_FEATURES } from '../landing-page.js';

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
 * It never overwrites what the PLAYER wrote. `draft.adIsSeeded` records whose
 * words are in the boxes, so switching tier rewrites a delivered ad but leaves a
 * hand-written one alone. Without it, typing three headlines and then changing
 * your mind about the writer would silently discard them.
 *
 * It CLEARS on the way to DIY, which is the whole reason the flag exists. The
 * words belong to the writer who was paid for them, and carrying an agency's
 * copy into DIY takes something the player did not buy — measured, retainer
 * copy grades `adRelevance` 1 against the keywords, so keeping it would punish
 * them for holding on to the best writing in the game.
 *
 * The variant follows `rootSeed`, which `app.js` increments for a new market,
 * so restarting shows a different ad rather than the same one three times.
 */
export function syncWriterCopy(draft, rootSeed) {
  if (isDiy(draft.writerTier)) {
    if (draft.adIsSeeded) {
      draft.ad.headlines = ['', '', ''];
      draft.ad.descriptions = ['', ''];
      draft.adIsSeeded = false;
    }
    return;
  }
  if (!draft.adIsSeeded && anyCopyWritten(draft.ad)) return;

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
 * was not calling it.
 *
 * MEASURED, which is why the card says anything at all. A self-written ad opens
 * on the ungraded 3/3 default (I11) and needs ₹16.24 on this query set, where a
 * hired 6/6 needs ₹6.87. Round 0 offers ₹30 — 1.85x headroom against a hired
 * account's 4.37x — and accepts anything from ₹1. Played: ₹17 takes 396 clicks
 * in week 1, ₹16 takes 244, ₹14 takes ZERO, for two full weeks.
 *
 * THE GRADE IS THE OPENING ONE, NOT THE WRITTEN ONE, and that distinction is the
 * whole warning. A player writing their own ad watches it grade 8/10 on the card
 * below and opens the account at 3/10; pricing the floor against the 8 would
 * reassure exactly the player who is about to disappear. It comes from
 * `openingCopyGrades` so this screen and `creativeBlock` cannot disagree.
 *
 * No landing-page bonus is added, and that is not an omission: round 0's capital
 * goes live at round 4 (`liveAtRound`), so `landingPageBonus` is zero for the
 * first three rounds and the copy lands before the capital does. Capital cannot
 * lower this floor.
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
    ...openingCopyGrades(draft.writerTier),
    // The player's own page, graded from what the capital built (I9). A writer
    // never touches it, so it is not part of what the delay withholds.
    landingPage: written.landingPage,
  };

  const rows = (draft.keywords ?? []).map((keyword) => {
    // The keyword's own literal search, which is the most favourable query it
    // could meet. Failing there means failing everywhere, at any hour, against
    // anyone — the same test `setup.test.js` runs over every rival.
    const query = querySet.queries.find((q) => q.text === keyword.text)
      ?? { text: keyword.text, intent: 'commercial', tags: heuristicTags(keyword.text) };
    const needPaise = minimumBidToShowPaise(qualitySignalBase(grade, query, keyword).base);
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
 * never confirmed by the game (section 4, step 2).
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
 * run it: the page the capital describes, graded (I9), which counts from week
 * 1; plus the page's own capital as points once the site goes live
 * (`landingPageBonus`, 13.3), capped at 10 as `round.js` caps it.
 *
 * The engine's own functions, so if the open question on the description's
 * timing (the spec's section 12) changes the rule, this follows.
 *
 * @returns {{fromWeek1: number, fromWeek4: number, liveAt: number}}
 */
export function landingGrade(draft) {
  const graded = gradeAsSubmitted(draft).applied.landingPage;
  const block = capitalOf(draft);
  return {
    fromWeek1: Math.min(10, graded + landingPageBonus(block, 1)),
    fromWeek4: Math.min(10, graded + landingPageBonus(block, CAPITAL_LIVE_AT)),
    liveAt: CAPITAL_LIVE_AT,
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
      stats: null,
      quality: { value: null, ratings: [] },
      active: null,
      needPaise: reserve.rows[i].clears ? null : reserve.rows[i].needPaise,
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
 * money step once seen and adding up; the others when their choice is complete.
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
    ad: validateAdCopy(submittedAd(draft)).valid,
    money: visited.has('money') && money,
  };
}

/**
 * What Go sends: exactly the shape the classic page's Go sends, so the account
 * opens the same way from either look. Guesses are not part of it.
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
