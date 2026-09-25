/**
 * What the Studio's Rivals shows, read without a page (ui/rivals/read.js;
 * design/market/, chosen by the owner 2026-09-15): each rival you meet, and
 * the market's public figures. Only what a player may see (R3).
 */

import { describe, test, expect } from 'vitest';
import { FORBIDDEN_IN_PUBLIC_VIEW, getPublicView } from '../engine/insights.js';
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
 * THE CARD IS HANDED THE PUBLIC VIEW, AND THAT IS ALL IT HAS (2026-09-25).
 *
 * `ui/dashboard.js` sets `advertisers: view.advertisers`, so a rival reaches
 * this module as `{id, name, domain, ads}` and nothing else. Anything a card
 * wants about a rival that is not one of those four does not exist to read.
 *
 * Written after a card read `who.campaign.prepaidDiscountPaise` to show a
 * rival's prepaid offer, passed a test that spread a `campaign` onto this
 * file's fixture, and drew nothing in a real game because the public view has
 * no `campaign` on it. The fixture above is the public view's shape on
 * purpose; this locks that to the engine so it cannot drift, and so the next
 * field a card wants fails here rather than silently reading `undefined`.
 */
describe('the shape a card is really handed', () => {
  const publicAdvertiser = () => getPublicView({
    advertisers: [{
      id: 'kestrel', name: 'Kestrel', domain: 'kestrel.in',
      campaign: { prepaidDiscountPaise: 5000, bidPaise: 1200 },
      adGroups: [{ ad: { headlines: ['Athleisure For All Day'], descriptions: ['Everyday athleisure.'] } }],
    }],
    querySet: { queries: [], weeklyVolume: 430000 },
  }, ME).advertisers[0];

  test('a rival in the public view carries four keys, and a campaign is not one', () => {
    expect(Object.keys(publicAdvertiser()).sort()).toEqual(['ads', 'domain', 'id', 'name']);
  });

  test('so a card reading a rival\'s campaign reads nothing at all', () => {
    // The exact mistake this guards: the engine holds the offer, the view does
    // not carry it, and `?? 0` turns the gap into a confident "no offer".
    expect(publicAdvertiser().campaign?.prepaidDiscountPaise ?? 0).toBe(0);
  });

  test('and this file\'s own fixture is that same shape, so its tests mean something', () => {
    for (const a of ADVERTISERS) {
      expect(Object.keys(a).sort()).toEqual(['ads', 'domain', 'id', 'name']);
    }
  });
});
