/**
 * What a week means, without drawing it.
 *
 * This was the round dashboard: seventeen cards and the reading behind each.
 * The switch-over's part 2 (2026-09-16) deleted the drawing, because the Studio
 * draws every one of those cards itself now (ui/week/, ui/typed/, ui/money/,
 * ui/returns/, ui/rivals/). What is left is the reading the Studio's sections
 * share — chiefly `formContext`, the context every section stages a change
 * into, and `accumulate`, which totals a report over a range of weeks.
 *
 * Three findings from playing the game shaped the screens this once drew, and
 * they still govern what the Studio's sections show:
 *
 *   F12  Impression share is misleading on its own. An advertiser alone in its
 *        cell read 100% share and 0% lost for twelve rounds while rivals took
 *        69% of its profit through PRICE. So share never appears without
 *        position mix and CPC beside it.
 *
 *   W11  A round's numbers move after you have read them — round 1 finally read
 *        +82% conversions and +171% profit against what the player saw at the
 *        time. The AsFirstReported twins were all stored and nothing surfaced
 *        them. Your week plays that revision rather than footnoting it.
 *
 *   15.2 The search terms report is the only tool for writing negatives, so it
 *        is a primary surface rather than a buried table, and a search whose
 *        sales cost over twice the account's average is marked.
 */

import { getPublicView } from '../engine/insights.js';
import { keywordReach } from '../engine/matching.js';
import { briefing } from '../setup.js';
import { effectiveGrades, locationRows, lastMonthBudget } from './decisions.js';
import { tagKeywordOffline } from '../agents/keywordTagger.js';
import {
  ROUNDS_PER_MONTH, DEFAULT_UNGRADED_QUALITY, ATTRIBUTION_LAG_DISTRIBUTION,
} from '../engine/constants.js';

/**
 * A click in round R is final at R+5: three rounds to arrive, two to resolve.
 * Exported for the field guide, which quotes it rather than deriving it again.
 */
export const SETTLES_AFTER_ROUNDS = ATTRIBUTION_LAG_DISTRIBUTION.length + 1;

/**
 * The rounds a return takes to come back after its sale lands: the "two to
 * resolve" in SETTLES_AFTER_ROUNDS. Quoted by Results, where it is why the
 * game's last weeks read high (tests/results.test.js holds it to every price
 * level's return window in the engine).
 */
export const RETURNS_RESOLVE_AFTER_ROUNDS = SETTLES_AFTER_ROUNDS - (ATTRIBUTION_LAG_DISTRIBUTION.length - 1);

/** "55% this week, then 28%, 12%, 5%", read off the constant it describes. */
export const ARRIVAL_SHAPE = ATTRIBUTION_LAG_DISTRIBUTION
  .map((share, i) => `${Math.round(100 * share)}%${i === 0 ? ' this week' : ''}`)
  .join(', then ')
  .replace(/, then (?=[^,]*$)/, ' and then ');

// ---------------------------------------------------------------------------
// Sentences that quote the state
// ---------------------------------------------------------------------------
//
// Each of these used to be a literal or a condition inside a render, and each
// said something the model did not do (reviews/slc-review.md, 9B and 9C). Out
// here they are a function of what they describe, and tested against it.

/**
 * When capital can be committed, in the weeks the player sees.
 *
 * The engine applies an allocation AT a round; the player makes it in the
 * form before that round runs, so round 1's is made at round 0 and round 5's
 * after week 4. The screens never call these "rounds", so neither does this.
 *
 * @param {number[]} allocationRounds - rounds an allocation is applied at
 * @returns {string} e.g. "before week 1 and before week 5"
 */
export function allocationWindowPhrase(allocationRounds) {
  const weeks = (allocationRounds ?? []).map((r) => `before week ${r}`);
  if (weeks.length === 0) return 'only in its allocation weeks';
  if (weeks.length === 1) return weeks[0];
  return `${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
}

/**
 * Is there anything to say about the player's own copy this week?
 *
 * MEASURED, AND THE REASON THIS FUNCTION EXISTS. A self-written ad runs on the
 * ungraded default until `creative.liveAtRound` (9.5, DECISIONS A8/I11), and the
 * round it lands is the largest single movement in a twelve-week game: at the
 * bid round 0 offers, a DIY account went 586 clicks to 2,351, while a hired
 * control over the same two weeks went DOWN. Below the reserve it goes from
 * nothing at all to 1,951. Nothing on this screen said so — the delay was
 * explained once at round 0, five cards deep, before the player had seen a
 * single auction — so a player who changed anything that week would credit their
 * own change with a 4x jump.
 *
 * It reports the STATE and the card writes the sentence, following
 * `termsOutlook` and `negativesOutlook`.
 *
 * Only a game saved before 2026-09-14 can reach 'pending' (I11): since then a
 * self-written ad runs on its words from week 1.
 *
 * @param {{liveAtRound?: number}|null|undefined} creative the player's own block
 * @param {number|null} round the round being reported
 * @returns {null | {state: 'pending'|'landed', liveAtRound: number,
 *   weeksAway: number, ungradedScore: number}} null when there is nothing to say
 */
export function creativeOutlook(creative, round) {
  const liveAtRound = creative?.liveAtRound;
  // A hired ad was live before the first auction (liveAtRound 1), so there is
  // nothing to explain and a "went live this week" on week 1 would be noise on
  // every hired account. A missing block is an older state, not a story.
  if (!Number.isFinite(liveAtRound) || liveAtRound <= 1 || !Number.isFinite(round)) return null;
  if (round > liveAtRound) return null;

  return {
    state: round < liveAtRound ? 'pending' : 'landed',
    liveAtRound,
    weeksAway: liveAtRound - round,
    // From the engine's own default, not a literal: this is the grade the
    // auction actually ran on, and a number typed into a view would drift.
    ungradedScore: DEFAULT_UNGRADED_QUALITY.expectedCtr,
  };
}

/**
 * Add up one breakdown across the rounds in view.
 *
 * Not economics — addition, of figures the engine produced. It reads
 * `state.history` rather than the reports the screen was handed, because
 * history is the copy that gets REVISED (11.4): a round's conversions keep
 * arriving for three more rounds and its returns resolve two after that.
 * Summing the reports as first issued would understate every settled week.
 * Exported for the Studio's own context (ui/shell/context.js).
 *
 * @param {object} game
 * @param {'byQuery'|'byKeyword'} which
 * @param {'week'|'all'} range
 * @returns {Record<string, object>} summed rows, keyed by query or keyword id
 */
export function accumulate(game, which, range) {
  const rounds = range === 'week' ? game.state.history.slice(-1) : game.state.history;

  const out = {};
  for (const stored of rounds) {
    const breakdown = stored.byAdvertiser?.[game.playerId]?.breakdown?.[which];
    for (const [id, r] of Object.entries(breakdown ?? {})) {
      const acc = out[id] ?? (out[id] = {
        impressions: 0, clicks: 0, costPaise: 0, conversions: 0,
        returned: 0, returnedRevenuePaise: 0,
      });
      acc.impressions += r.impressions ?? 0;
      acc.clicks += r.clicks ?? 0;
      acc.costPaise += r.costPaise ?? 0;
      acc.conversions += r.conversions ?? 0;
      // I32: which search sent it back, so a negative can be written on return
      // grounds rather than only on "took clicks and never converted".
      acc.returned += r.returned ?? 0;
      acc.returnedRevenuePaise += r.returnedRevenuePaise ?? 0;
    }
  }
  return out;
}

/**
 * What each week of the CURRENT month has spent so far, by week index.
 *
 * A month is ROUNDS_PER_MONTH rounds, and a round's index within it is
 * `(round - 1) % ROUNDS_PER_MONTH` — the same arithmetic `buildBudgets` uses to
 * pick which week's budget to spend.
 */
function spentByWeekOfMonth(game) {
  const round = game.state.round;
  const monthStart = round - ((round - 1) % ROUNDS_PER_MONTH);
  const out = {};
  for (const stored of game.state.history) {
    if (stored.round < monthStart || stored.round >= monthStart + ROUNDS_PER_MONTH) continue;
    const row = stored.byAdvertiser?.[game.playerId];
    if (row) out[(stored.round - 1) % ROUNDS_PER_MONTH] = row.traffic.costPaise;
  }
  return out;
}

/**
 * What the decision form is handed to draw from: the account's own figures,
 * the public view, and lookups that answer without handing over what they read.
 *
 * The half of the form's context that needs no page, so a test can read what
 * the cards read without drawing them. `renderDashboard` adds the half that
 * does — the guide, the report's range and the redraws.
 *
 * @param {object} game the running game: state, reports, playerId, draft
 * @param {object} [view] the player's public view, when the caller already
 *   has one
 * @returns {object} built afresh each week, when the dashboard is drawn
 */
export function formContext(game, view = getPublicView(game.state, game.playerId)) {
  const row = game.reports[game.reports.length - 1].byAdvertiser[game.playerId];
  return {
    draft: game.draft,
    // The public view, not content/querySet.js: the form may see a search's
    // text, volume and intent and nothing else (16.1), and taking it from here
    // means that is enforced rather than merely intended.
    queries: view.querySet,
    // The form adds keywords from the public view, which has no tags; this is
    // the one thing it may ask of the full set, and the lookup happens in
    // agents/keywordTagger.js rather than here (E9).
    tagKeyword: (keyword) => tagKeywordOffline(keyword, game.state.querySet),
    weeklyVolume: view.weeklyVolume,
    texts: new Map(view.querySet.map((q) => [q.id, q.text])),
    // Rival identity is public (R3), so a search carrying somebody's name can
    // be named as such. `brandOwner` itself is withheld (16.1) and is never
    // read — this is the same inference a player makes from the words.
    advertisers: view.advertisers,
    quality: row.quality,
    // The grader's own 1-10 for this ad, with the landing-page capital folded
    // in. The player's own data, and until now never on screen.
    grades: effectiveGrades(game.draft),
    money: row.money,
    // What a founder could research (17.2), from the same function round 0
    // uses — so the two screens cannot disagree about the grid.
    brief: briefing(game.state.querySet),
    // What each week of this month actually spent, so the split card can show
    // it beside what that week was planned. Addition of report figures.
    spentByWeek: spentByWeekOfMonth(game),
    // The month just played, which the capital card reads its choice against
    // (D12). The player's own report, so nothing R3 withholds.
    lastMonth: lastMonthBudget(game.state.history, game.playerId, game.state.round),
    // How many searches a keyword matches, as a count only: the matching reads
    // the full set's tags, which the view withholds, and hands back a number,
    // as Keyword Planner forecasts a keyword without its workings (E8).
    reach: (keyword) => keywordReach(keyword, game.state.querySet),
    // This account's own places, the rows the places card draws, which the
    // prepaid card weights its refusal rate by. The rows and never the history
    // they are summed from: `state.history` holds all nine advertisers'
    // reports, and the form may only know what a controller could.
    places: () => locationRows(game.draft, game.state.history, game.playerId),
  };
}
