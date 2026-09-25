/**
 * What the Studio's Rivals shows, read without a page (ui/rivals/read.js;
 * design/market/, chosen by the owner 2026-09-15): each rival you meet, and
 * the market's public figures. Only what a player may see (R3).
 */

import { describe, test, expect } from 'vitest';
import { FORBIDDEN_IN_PUBLIC_VIEW } from '../engine/insights.js';
import { rivalCards, marketFigures } from '../ui/rivals/read.js';

const ME = 'me';
// One entry per played week, as game.insights holds them: every advertiser's row.
const week = (rivals) => ({ [ME]: { self: { impressionShare: 0.5, lostToRank: 0, lostToBudget: 0.5 }, rivals } });
const r = (overlapRate, positionAboveRate = 0, outrankingShare = 0) => ({ overlapRate, positionAboveRate, outrankingShare });
const ADVERTISERS = [
  { id: ME, name: 'Vella & Co.', domain: 'vellaandco.in', ads: [{ headlines: ['Mine'], descriptions: ['Mine.'] }] },
  { id: 'kestrel', name: 'Kestrel', domain: 'kestrel.in', ads: [{ headlines: ['Athleisure For All Day'], descriptions: ['Everyday athleisure.'] }] },
  { id: 'marlow', name: 'Marlow', domain: 'marlowlabel.in', ads: [{ headlines: ['Leggings Built To Train In'], descriptions: ['Gym wear.'] }] },
  { id: 'auren', name: 'Auren', domain: 'auren.in', ads: [{ headlines: ['Bamboo Silk'], descriptions: ['Loungewear.'] }] },
];

describe('each rival you meet, as a card', () => {
  const insights = [
    week({ kestrel: r(0.86), marlow: r(0.4498), auren: r(0) }),
    week({ kestrel: r(0.96, 0.70, 0.30), marlow: r(0.402, 0, 1), auren: r(0) }),
  ];

  test('sorted by how often you meet them, and one you never meet kept apart', () => {
    const { met, never } = rivalCards(insights, ME, ADVERTISERS);
    expect(met.map((c) => c.name)).toEqual(['Kestrel', 'Marlow']);
    expect(never.map((c) => c.name)).toEqual(['Auren']);
  });

  test('this week\'s three figures, every week of how often you met, and their ad', () => {
    const [kestrel] = rivalCards(insights, ME, ADVERTISERS).met;
    expect(kestrel).toMatchObject({ domain: 'kestrel.in', overlap: 0.96, above: 0.70, beat: 0.30 });
    expect(kestrel.weeks).toEqual([0.86, 0.96]);
    expect(kestrel.ad.headlines).toEqual(['Athleisure For All Day']);
    expect(rivalCards(insights, ME, ADVERTISERS).met.some((c) => c.id === ME)).toBe(false);
  });

  test('a move is marked when the printed figure moved five points, as the sentence counts it', () => {
    const { met } = rivalCards(insights, ME, ADVERTISERS);
    // 0.4498 to 0.402 prints 45% to 40%; 0.86 to 0.96 is ten points.
    expect(met.find((c) => c.name === 'Marlow')).toMatchObject({ moved: true, was: 0.4498 });
    expect(met.find((c) => c.name === 'Kestrel').moved).toBe(true);
    expect(rivalCards([insights[1]], ME, ADVERTISERS).met.every((c) => c.moved === false)).toBe(true);
  });

  test('nothing withheld reaches a card, whatever it is handed', () => {
    const poison = Object.fromEntries(FORBIDDEN_IN_PUBLIC_VIEW.map((f) => [f, 999999]));
    const poisoned = [week({ kestrel: { ...r(0.5, 0.5, 0.5), ...poison } })];
    const handed = ADVERTISERS.map((a) => ({ ...a, ...poison }));
    const seen = JSON.stringify(rivalCards(poisoned, ME, handed));
    expect(seen).not.toContain('999999');
  });

  test('before a week is played there is nobody to show', () => {
    expect(rivalCards([], ME, ADVERTISERS)).toEqual({ met: [], never: [] });
  });
});

describe('the market\'s public figures', () => {
  const contexts = [
    { totalMarketSpendPaise: 41840400, medianCpcPaise: 1148, activeAdvertisers: 9 },
    { totalMarketSpendPaise: 30214000, medianCpcPaise: 1146, activeAdvertisers: 9 },
  ];

  test('this week beside last week, and the searches, which do not change', () => {
    expect(marketFigures(contexts, 430000)).toEqual({
      spendPaise: 30214000, lastSpendPaise: 41840400,
      medianCpcPaise: 1146, lastMedianCpcPaise: 1148,
      advertisers: 9, lastAdvertisers: 9,
      weeklySearches: 430000,
    });
  });

  test('the first week has no last week', () => {
    expect(marketFigures(contexts.slice(0, 1), 430000)).toMatchObject({ lastSpendPaise: null, lastMedianCpcPaise: null, lastAdvertisers: null });
    expect(marketFigures([], 430000)).toBeNull();
  });
});

/**
 * A DISCOUNTING RIVAL SAYS SO, AND THE PLAYER CAN READ IT (2026-09-25).
 *
 * Rivals have offered prepaid discounts since the C9 fix — measured at 2 of 8
 * from week 2, the same in every seed tried — and nothing ever told the player.
 * So the one lever open after round 5 was contested INVISIBLY: you could not
 * tell whether ₹50 matched the field or was being paid alone, which teaches
 * worse than no contest at all, because your own restraint looks like skill.
 *
 * It rides in the AD rather than in a panel of its own. A prepaid discount is
 * not a bid — it is a thing a shop advertises — so a player finds it the way
 * they find everything else about a rival, by reading. R3 is untouched: no
 * controller sees this, and nothing here reaches a bid, a budget, or anything
 * 16.1 withholds.
 */
describe('a rival\'s public offer', () => {
  const withOffer = (paise) => ADVERTISERS.map((a) => (
    a.id === 'kestrel' ? { ...a, campaign: { prepaidDiscountPaise: paise } } : a));
  const cardFor = (advertisers) => rivalCards(
    [week({ kestrel: r(0.5), marlow: r(0.3) })], ME, advertisers,
  ).met.find((c) => c.id === 'kestrel');

  test('a rival offering nothing carries no offer', () => {
    expect(cardFor(ADVERTISERS).offerPaise).toBe(0);
  });

  test('a rival offering one carries it, in paise', () => {
    expect(cardFor(withOffer(5000)).offerPaise).toBe(5000);
  });

  test('and it never reaches for a bid, a budget or a cost while it is there', () => {
    // The whole card, not just the new field: R3's rule is that no advertiser
    // reads another's bid, budget or costs, and this reads a rival's campaign.
    const card = cardFor(withOffer(5000));
    const seen = JSON.stringify(card);
    for (const forbidden of ['bidPaise', 'budgetPaise', 'costPaise', 'dailyBudget']) {
      expect(seen.includes(forbidden), `the card carries ${forbidden}`).toBe(false);
    }
    for (const name of FORBIDDEN_IN_PUBLIC_VIEW) {
      expect(seen.includes(name), `the card carries ${name}`).toBe(false);
    }
  });

  test('an advertiser with no campaign at all does not throw', () => {
    // Round 1 draws cards before anyone has decided anything.
    expect(cardFor(ADVERTISERS.map(({ campaign, ...rest }) => rest)).offerPaise).toBe(0);
  });
});
