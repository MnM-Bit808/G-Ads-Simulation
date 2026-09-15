/**
 * What the Studio's What people typed shows, read without a page
 * (design/what-people-typed/, chosen by the owner 2026-09-15): every search
 * the account bought, most spent first, with what a sale cost there and how
 * many came back, and what a block would catch before it is made.
 *
 * THE FIGURES ARE TODAY'S CARD'S. `ctx.terms` is the search terms report the
 * dashboard adds up over the weeks on screen (`game.view.termsRange`), and a
 * block is staged through the form's own `addNegative`, so the two looks and
 * the tray cannot disagree about what is blocked.
 *
 * WHAT IS MARKED IS COUNTED AGAINST THIS ACCOUNT, NOT A FIXED LINE. Today's
 * card marks a search that took five clicks and sold nothing, and on the
 * game's fractional sales that never fires: a search that ever converts is
 * never exactly zero, so "how to wash gym leggings" at Rs 3,566 for 0.8 of a
 * sale went unmarked. A sale that costs over DEAR_TIMES the account's own
 * average is marked instead, beside today's returns mark.
 */

import { blockedBy, normalise } from '../../engine/matching.js';
import { brandNamedIn } from '../../content/brands.js';
import { previewNegative } from '../decisions.js';

/** A sale here costing over this many times the account's average is marked. */
export const DEAR_TIMES = 2;
/** Returns over this many times the account's rate are marked, as today's card marks them. */
export const WORSE_TIMES = 1.15;

const shown = (terms) => Object.entries(terms ?? {}).filter(([, r]) => r.impressions > 0);

/**
 * This account's own cost per sale and return rate, over the rows on screen,
 * so every mark is made against the same period the table shows.
 *
 * @param {object} terms - `ctx.terms`, by query id
 * @returns {{perSalePaise: number|null, returnRate: number}} `returnRate` 0-1,
 *   0 while nothing in the range has come back
 */
export function averages(terms) {
  const t = shown(terms).reduce((a, [, r]) => ({
    cost: a.cost + r.costPaise, sales: a.sales + (r.conversions ?? 0), back: a.back + (r.returned ?? 0),
  }), { cost: 0, sales: 0, back: 0 });
  return {
    perSalePaise: t.sales > 0 ? t.cost / t.sales : null,
    // `returned` is a SUBSET of conversions, counted again when it comes back
    // (today's card, I32): the rate is returned over conversions, never over both.
    returnRate: t.sales > 0 ? t.back / t.sales : 0,
  };
}

/** One search's figures and its marks, against the account's averages. */
function measured(r, avg) {
  const sales = r.conversions ?? 0;
  const perSalePaise = sales > 0 ? r.costPaise / sales : null;
  const backRate = sales > 0 ? (r.returned ?? 0) / sales : null;
  return {
    spendPaise: r.costPaise,
    clicks: r.clicks,
    sales,
    perSalePaise,
    backRate,
    dear: perSalePaise !== null && avg.perSalePaise !== null && perSalePaise > DEAR_TIMES * avg.perSalePaise,
    worse: backRate !== null && avg.returnRate > 0 && backRate > WORSE_TIMES * avg.returnRate,
  };
}

/**
 * Every search that showed, most spent first.
 *
 * @param {object} terms - `ctx.terms`, by query id
 * @param {object} context
 * @param {Map<string, string>} context.texts - query id to its words
 * @param {Array<{text: string, matchType: string}>} context.negatives - the draft's, staged ones included
 * @param {Array<{id: string, name: string}>} context.advertisers - public (R3)
 * @param {string} context.playerId
 * @returns {{rows: object[], averages: ReturnType<typeof averages>}} each row
 *   also carries `brand` ({own, name} or null), `blockedBy` (the negative that
 *   catches it, or null) and `blocksItself` (an exact block of this very search,
 *   the one its row can undo)
 */
export function termRows(terms, { texts, negatives, advertisers, playerId }) {
  const avg = averages(terms);
  const rows = shown(terms)
    .sort((a, b) => b[1].costPaise - a[1].costPaise)
    .map(([id, r]) => {
      const text = texts.get(id) ?? id;
      const named = brandNamedIn(text, advertisers ?? []);
      const block = blockedBy({ text }, negatives ?? []);
      return {
        id,
        text,
        ...measured(r, avg),
        brand: named ? { own: named.id === playerId, name: named.name } : null,
        blockedBy: block,
        blocksItself: Boolean(block) && block.matchType === 'exact' && normalise(block.text) === normalise(text),
      };
    });
  return { rows, averages: avg };
}

/**
 * What a block would catch, before it is made: the searches bought, with
 * their spend, sales and cost per sale, and the ones never bought, which it
 * closes unseen. By the engine's own matcher (`previewNegative`).
 *
 * @param {{text: string, matchType: string}} negative
 * @param {{queries: object[], terms: object}} context - the public query set and `ctx.terms`
 * @returns {{bought: object[], never: object[], spentPaise: number, sales: number}}
 *   `bought` most spent first, each marked as the list marks it
 */
export function blockPreview(negative, { queries, terms }) {
  const preview = previewNegative(negative, { queries, terms });
  const avg = averages(terms);
  return {
    bought: preview.spent.map((r) => ({ id: r.id, text: r.text, ...measured(terms[r.id], avg) })),
    never: preview.unspent.map((r) => ({ id: r.id, text: r.text })),
    spentPaise: preview.totals.costPaise,
    sales: preview.totals.conversions,
  };
}
