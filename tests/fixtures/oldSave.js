/**
 * A game as it was saved before the writer rule changed (DECISIONS I11,
 * 2026-09-14). A save stores the state before week 1, so a self-written ad
 * saved then still waits for week 3 in it, and `game.js` must still land it
 * there on replay. New games never look like this.
 */
import { DEFAULT_UNGRADED_QUALITY } from '../../engine/constants.js';

/** The week a self-written ad went live under the old rule. */
export const OLD_SAVE_LIVE_ROUND = 3;

/**
 * @param {object} state - a new game whose player writes its own ad
 * @returns {object} the same game, shaped as a save from before the change
 */
export function asOldSave(state) {
  const [player, ...rivals] = state.advertisers;
  const [group, ...groups] = player.adGroups;
  const written = group.gradedQuality;
  return {
    ...state,
    advertisers: [{
      ...player,
      creative: {
        ...player.creative,
        liveAtRound: OLD_SAVE_LIVE_ROUND,
        pendingGrade: {
          expectedCtr: written.expectedCtr, adRelevance: written.adRelevance, landingPage: written.landingPage,
        },
      },
      adGroups: [{
        ...group,
        gradedQuality: {
          ...written,
          expectedCtr: DEFAULT_UNGRADED_QUALITY.expectedCtr,
          adRelevance: DEFAULT_UNGRADED_QUALITY.adRelevance,
        },
      }, ...groups],
    }, ...rivals],
  };
}
