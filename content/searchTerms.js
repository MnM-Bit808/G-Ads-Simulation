/**
 * What counts as a search worth blocking, for everyone who has to decide it.
 *
 * ONE RULE, TWO READERS. The player's Negatives card and search terms table mark
 * a search with it (`ui/decisions.js`), and a rival's policy blocks by it
 * (`agents/policies.js`). It lived in `ui/` while only the screens asked the
 * question; `agents/` may not reach into `ui/`, and a second copy in the policies
 * would be two models of one concept — the defect I9 was written about. So it
 * sits here, beside the other content rules the engine does not own.
 *
 * WHY IT IS NOT "CLICKS AND NO SALE". The game is played in expected mode, where
 * a search's sales are its clicks times a conversion rate: a fraction, never
 * exactly zero unless nobody searching it ever buys. A rule asking for zero
 * marks the zero-intent searches and nothing else, which is how "how to wash gym
 * leggings" at ₹4,458 a sale went unmarked against an account's ₹488 (I8's
 * addendum), and how a rival wrote no negatives at all in a whole game.
 *
 * NO PHYSICS HERE. Nothing in `engine/` reads this: it is a judgement about a
 * report, the same judgement a player makes by eye.
 */

/** A search whose sales cost over this many times the account's average is marked. */
export const DEAR_TIMES = 2;

/**
 * What a sale has cost this account on average, over the search terms given.
 *
 * Taken over exactly the rows given — every week, this week, or one rival's own
 * history — so a search is judged against the account in the same state of
 * settling. A week's sales are still arriving, but they arrive for every search
 * alike.
 *
 * @param {object|object[]} terms search terms rows, keyed by query id, or an array of them
 * @returns {number|null} paise per sale, fractional; null while nothing has sold,
 *   when there is nothing to compare a search against
 */
export function averagePerSalePaise(terms) {
  let costPaise = 0;
  let sales = 0;
  for (const r of Array.isArray(terms) ? terms : Object.values(terms ?? {})) {
    if (!(r.impressions > 0)) continue;
    costPaise += r.costPaise;
    sales += r.conversions ?? 0;
  }
  return sales > 0 ? costPaise / sales : null;
}

/**
 * Whether a search costs too much for what it sold.
 *
 * Marked when each sale cost over DEAR_TIMES the account's average, once the
 * search has spent at least one average sale: short of that it has not had the
 * money to sell, whatever it shows. A search that sold nothing is marked on the
 * same terms, since no sale is dearer than any price.
 *
 * @param {{costPaise: number, conversions: number}} row
 * @param {number|null} averagePaise from `averagePerSalePaise`
 * @returns {boolean}
 */
export function isDear(row, averagePaise) {
  if (averagePaise == null) return false;
  const sales = row.conversions ?? 0;
  return row.costPaise >= averagePaise && row.costPaise > DEAR_TIMES * averagePaise * sales;
}

/**
 * One account's search terms summed over the weeks given: what every week's
 * `breakdown.byQuery` adds up to, by query id.
 *
 * The weeks are reports as revised, so a sale that landed three weeks after its
 * click is counted in the week whose click earned it, which is the week the
 * search is judged on.
 *
 * @param {Array<{breakdown?: {byQuery?: object}}>} weeks a controller's own history
 * @returns {Object<string, {clicks: number, impressions: number, costPaise: number, conversions: number}>}
 */
export function queryTotals(weeks) {
  /** @type {Record<string, {clicks: number, impressions: number, costPaise: number, conversions: number}>} */
  const totals = {};
  for (const week of weeks ?? []) {
    for (const [queryId, row] of Object.entries(week?.breakdown?.byQuery ?? {})) {
      const held = totals[queryId] ?? { clicks: 0, impressions: 0, costPaise: 0, conversions: 0 };
      totals[queryId] = {
        clicks: held.clicks + (row.clicks ?? 0),
        impressions: held.impressions + (row.impressions ?? 0),
        costPaise: held.costPaise + (row.costPaise ?? 0),
        conversions: held.conversions + (row.conversions ?? 0),
      };
    }
  }
  return totals;
}
