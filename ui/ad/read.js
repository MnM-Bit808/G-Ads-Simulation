/**
 * What the weekly Your ad shows (the owner's call, 2026-09-15), read without a
 * page: the ad as searchers see it, who wrote it, the grades the auctions use,
 * and the landing page.
 *
 * READ-ONLY. The ad is written once, in round 0, and nothing rewrites it (I9);
 * rewriting waits for the message project. Every figure is the player's own:
 * the draft, which is built from `getSelfView`, and the creative block, which
 * that view does not carry and the caller reads from state (I16).
 *
 * A GRADE IS THE ONE THE AUCTIONS WILL RUN ON in the week about to be played,
 * and one still to change says when: landing page capital being built (13.3),
 * or, in a save from before 2026-09-14, a self-written ad not yet live (I11).
 * Both are worked out by `effectiveGrades`, the function the reserve and the
 * keyword card read, so the three cannot disagree.
 */

import { TOTAL_ROUNDS } from '../../engine/constants.js';
import { writerTier, isDiy } from '../../content/writers.js';
import { effectiveGrades } from '../decisions.js';
import { pageShape } from '../landing-page.js';

const PARTS = ['expectedCtr', 'adRelevance', 'landingPage'];

/**
 * The grade each part runs at in `round`. A save's self-written ad that is due
 * lands as its week runs (`landCreative` in game.js), so from that week on it
 * counts although the state has not applied it yet.
 */
function gradesAt(draft, creative, round) {
  const lands = Boolean(creative?.pendingGrade) && round >= creative.liveAtRound;
  return effectiveGrades({
    ...draft,
    round,
    gradedQuality: lands ? { ...draft.gradedQuality, ...creative.pendingGrade } : draft.gradedQuality,
  });
}

/** The first week a part's grade changes, and to what, or null. */
function firstChange(draft, creative, key, from, round) {
  for (let week = round + 1; week <= TOTAL_ROUNDS; week++) {
    const value = gradesAt(draft, creative, week)[key];
    // Only capital moves the landing page; only a self-written ad still to
    // land moves the other two.
    if (value !== from) return { value, week, why: key === 'landingPage' ? 'page' : 'copy' };
  }
  return null;
}

/**
 * The page's parts, from the capital committed to it. A part whose rung is
 * still being built carries the rung it has now (`from`, null if none) and the
 * week the rest goes live.
 */
function pageStrips(block, round) {
  const committed = block.committed ?? {};
  const notYet = (target) => (block.pending ?? []).filter((p) => p.target === target && p.liveAtRound > round);
  const live = Object.fromEntries(Object.entries(committed)
    .map(([target, paise]) => [target, paise - notYet(target).reduce((sum, p) => sum + p.paise, 0)]));
  const liveLabel = new Map(pageShape(live).strips.map((s) => [s.target, s.label]));
  return pageShape(committed).strips.map((strip) => {
    const now = liveLabel.get(strip.target) ?? null;
    if (now === strip.label) return { target: strip.target, from: null, label: strip.label, week: null };
    return { target: strip.target, from: now, label: strip.label, week: Math.max(...notYet(strip.target).map((p) => p.liveAtRound)) };
  });
}

/**
 * @param {object} args
 * @param {object} args.draft - the weekly draft (ui/decisions.js, createDraft)
 * @param {object|undefined} args.creative - the player's creative block, from
 *   state (I16); missing in a save older than I11, which is read as the
 *   player's own words
 * @param {string} args.name - the player's brand, from the self view
 * @param {string} args.domain
 * @returns {{name: string, domain: string, headlines: string[], descriptions: string[],
 *   writer: {id: string, label: string, pricePaise: number, hired: boolean}, week: number,
 *   grades: Array<{key: string, value: number, later: {value: number, week: number, why: string}|null}>,
 *   page: {description: string, strips: object[]}}}
 */
export function adModel({ draft, creative, name, domain }) {
  const ad = draft.adGroups[0]?.ad ?? { headlines: [], descriptions: [], landingPageDescription: '' };
  // After the last week the draft looks at a week that never runs.
  const week = Math.min(draft.round, TOTAL_ROUNDS);
  const tierId = creative?.tier ?? 'diy';
  const tier = writerTier(tierId);
  const now = draft.gradedQuality ? gradesAt(draft, creative, week) : null;
  return {
    name,
    domain,
    headlines: [...ad.headlines],
    descriptions: [...ad.descriptions],
    writer: { id: tierId, label: tier.label, pricePaise: tier.pricePaise, hired: !isDiy(tierId) },
    week,
    grades: now ? PARTS.map((key) => ({ key, value: now[key], later: firstChange(draft, creative, key, now[key], week) })) : [],
    page: { description: ad.landingPageDescription ?? '', strips: pageStrips(draft.capexBlock ?? {}, week) },
  };
}
