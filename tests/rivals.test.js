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
// The public view's shape exactly, and a test below holds it to that.
const ADVERTISERS = [
  { id: ME, name: 'Vella & Co.', domain: 'vellaandco.in', prepaidDiscountPaise: 0, ads: [{ headlines: ['Mine'], descriptions: ['Mine.'] }] },
  { id: 'kestrel', name: 'Kestrel', domain: 'kestrel.in', prepaidDiscountPaise: 0, ads: [{ headlines: ['Athleisure For All Day'], descriptions: ['Everyday athleisure.'] }] },
  { id: 'marlow', name: 'Marlow', domain: 'marlowlabel.in', prepaidDiscountPaise: 0, ads: [{ headlines: ['Leggings Built To Train In'], descriptions: ['Gym wear.'] }] },
  { id: 'auren', name: 'Auren', domain: 'auren.in', prepaidDiscountPaise: 0, ads: [{ headlines: ['Bamboo Silk'], descriptions: ['Loungewear.'] }] },
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
  const PUBLIC_KEYS = ['ads', 'domain', 'id', 'name', 'prepaidDiscountPaise'];
  const publicAdvertiser = (campaign) => getPublicView({
    advertisers: [{
      id: 'kestrel', name: 'Kestrel', domain: 'kestrel.in', campaign,
      adGroups: [{ ad: { headlines: ['Athleisure For All Day'], descriptions: ['Everyday athleisure.'] } }],
    }],
    querySet: { queries: [], weeklyVolume: 430000 },
  }, ME).advertisers[0];

  test('a rival in the public view carries these keys and no others', () => {
    expect(Object.keys(publicAdvertiser({ prepaidDiscountPaise: 5000 })).sort()).toEqual(PUBLIC_KEYS);
  });

  test('a campaign never comes through whole, whatever else is on it', () => {
    // The mistake this guards: a card read `who.campaign.prepaidDiscountPaise`
    // and `?? 0` turned the missing shape into a confident "no offer", in
    // every game, with a green suite — because its fixture was hand-built.
    const a = publicAdvertiser({ prepaidDiscountPaise: 5000, bidPaise: 1200, monthlyBudgetPaise: 90000 });
    expect(a.campaign).toBeUndefined();
    expect(JSON.stringify(a)).not.toContain('bidPaise');
  });

  test('and this file\'s own fixture is that same shape, so its tests mean something', () => {
    for (const a of ADVERTISERS) {
      expect(Object.keys(a).sort()).toEqual(PUBLIC_KEYS);
    }
  });
});

/**
 * A DISCOUNTING RIVAL SAYS SO, AND THE PLAYER CAN READ IT (I45, 2026-09-25).
 *
 * Rivals have offered prepaid discounts since the C9 fix — two of eight at ₹50
 * from week 3, the same in every seed tried — and until I45 nothing could tell
 * the player, because the public view withheld the offer. So the one lever
 * left open after round 5 was contested INVISIBLY: you could not tell whether
 * your ₹50 matched the field or was being paid alone, which teaches worse than
 * no contest at all, because your own restraint looks like skill.
 *
 * The fixtures here come OUT OF `getPublicView`, never hand-built, which is
 * the whole lesson of the version of this that drew nothing.
 */
describe('a rival\'s public offer', () => {
  const cardFor = (offerPaise) => {
    const advertisers = getPublicView({
      advertisers: ADVERTISERS.map((a) => ({
        id: a.id, name: a.name, domain: a.domain,
        campaign: a.id === 'kestrel' ? { prepaidDiscountPaise: offerPaise, bidPaise: 1200 } : {},
        adGroups: a.ads.map((ad) => ({ ad })),
      })),
      querySet: { queries: [], weeklyVolume: 430000 },
    }, ME).advertisers;
    return rivalCards([week({ kestrel: r(0.5), marlow: r(0.3) })], ME, advertisers)
      .met.find((c) => c.id === 'kestrel');
  };

  test('a rival offering nothing carries no offer', () => {
    expect(cardFor(0).offerPaise).toBe(0);
  });

  test('a rival offering one carries it, in paise, through the real view', () => {
    expect(cardFor(5000).offerPaise).toBe(5000);
  });

  test('and the card still reaches for no bid, budget or cost while it does', () => {
    const seen = JSON.stringify(cardFor(5000));
    for (const forbidden of ['bidPaise', 'budgetPaise', 'costPaise', 'dailyBudget']) {
      expect(seen.includes(forbidden), `the card carries ${forbidden}`).toBe(false);
    }
    for (const name of FORBIDDEN_IN_PUBLIC_VIEW) {
      expect(seen.includes(name), `the card carries ${name}`).toBe(false);
    }
  });
});
