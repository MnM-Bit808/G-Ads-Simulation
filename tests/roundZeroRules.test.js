/**
 * Round 0's rules, read without a page (plans/2026-09-14-round-zero-redesign.md,
 * section 8). The classic page and the Studio steps must read the SAME
 * functions, or a figure on one could disagree with the account.
 */
import { describe, test, expect } from 'vitest';
import * as classic from '../ui/round-zero.js';
import * as rules from '../ui/roundzero/rules.js';
import { assignIdentities } from '../content/brands.js';
import { QUERY_SET } from '../content/querySet.js';

describe('one set of rules for both looks', () => {
  test.each(['openingReserve', 'submittedAd', 'gradeAsSubmitted', 'monthlyBudget',
    'positionMatrix', 'splitShares'])('%s is the same function on both pages', (name) => {
    expect(classic[name]).toBe(rules[name]);
  });
});

describe('the rival ads round 0 shows', () => {
  const brand = 'nira';
  const ads = rules.rivalAds(20260902, brand, QUERY_SET);

  test('eight of them, none the player\'s own, in name order', () => {
    expect(ads).toHaveLength(8);
    expect(ads.map((a) => a.name)).toEqual([...ads.map((a) => a.name)].sort());
    const { player } = assignIdentities(brand);
    expect(ads.map((a) => a.name)).not.toContain(player.name);
  });

  test('each carries the ad the market will run, and no square', () => {
    for (const a of ads) {
      expect(a.ad.headlines.length).toBeGreaterThan(0);
      expect(Object.keys(a).sort()).toEqual(['ad', 'domain', 'name']);
    }
  });
});

describe('the research list', () => {
  test('every search, biggest first, with nothing Keyword Planner would not show', () => {
    const list = rules.researchList(QUERY_SET);
    expect(list).toHaveLength(QUERY_SET.queries.length);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].weekly).toBeGreaterThanOrEqual(list[i].weekly);
    expect(Object.keys(list[0]).sort()).toEqual(['id', 'intent', 'text', 'weekly']);
  });
});
