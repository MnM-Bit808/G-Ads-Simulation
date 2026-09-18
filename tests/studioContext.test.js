/**
 * The Studio's own context (the switch-over, part 1). The shell took it from
 * renderDashboard, drawn hidden on every week, so the Studio built the whole
 * classic page to read twenty fields. This test holds that the new one gives
 * the same fields, without a page (vitest runs here with no document).
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { studioContext, PLANNER_START } from '../ui/shell/context.js';
import { formContext, accumulate } from '../ui/dashboard.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { getSelfView } from '../engine/insights.js';
import { createDraft } from '../ui/decisions.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';

let game;
beforeAll(() => {
  const own = QUERY_SET.queries.filter((q) => q.intent === 'commercial').slice(0, 4);
  let state = startGame({
    rootSeed: 7,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: { price: 'mid', purpose: 'performance' },
      keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 2400 })),
    },
  });
  const playerId = state.advertisers[0].id;
  const reports = [];
  for (let week = 0; week < 3; week++) {
    const out = submitRound(state, {}, { mode: 'expected' });
    reports.push(out.report);
    state = out.nextGameState;
  }
  game = { state, reports, playerId, draft: createDraft(getSelfView(state, playerId)), view: { termsRange: 'all' } };
});

describe('the Studio builds its context without the classic page', () => {
  test('it carries every field formContext gives', () => {
    const ctx = studioContext(game);
    for (const key of Object.keys(formContext(game))) expect(ctx, key).toHaveProperty(key);
  });

  test('its breakdowns are the report range the player is reading', () => {
    const ctx = studioContext(game);
    expect(ctx.terms).toEqual(accumulate(game, 'byQuery', 'all'));
    expect(ctx.byKeyword).toEqual(accumulate(game, 'byKeyword', 'all'));
    game.view.termsRange = 'week';
    ctx.refresh();
    expect(ctx.terms).toEqual(accumulate(game, 'byQuery', 'week'));
    game.view.termsRange = 'all';
  });

  test('a staged change tells the shell once', () => {
    let told = 0;
    const ctx = studioContext(game, { onChange: () => { told += 1; } });
    ctx.refresh();
    expect(told).toBe(1);
  });

  test('the keyword planner opens as the classic card opened it', () => {
    expect(studioContext(game).planner).toEqual(PLANNER_START);
    expect(PLANNER_START).toEqual({ matchType: 'phrase', bidPaise: 3000, term: '', open: false });
  });
});
