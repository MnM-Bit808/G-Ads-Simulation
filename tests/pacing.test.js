import { describe, test, expect } from 'vitest';
import {
  dailyTargetPaise, projectedHourSpendPaise, participationFraction,
  cumulativeReference, remainingReference, dailyCeilingPaise, validateWeeklySplit,
} from '../engine/pacing.js';
import {
  DAILY_BUDGET_OVERSPEND_CAP, PACING_REFERENCE_CURVE, HOUR_PROFILES,
  MONTHLY_BUDGET_PAISE,
} from '../engine/constants.js';

const WEEK = 4200000; // one quarter of a month, in paise

describe('the daily target self-corrects', () => {
  test('day one asks for a seventh of the week', () => {
    expect(dailyTargetPaise(WEEK, 0, 0)).toBe(Math.floor(WEEK / 7));
  });

  test('overspending on Monday lowers Tuesday', () => {
    const monday = dailyTargetPaise(WEEK, 0, 0);
    const hot = dailyTargetPaise(WEEK, Math.round(monday * 1.8), 1);
    expect(hot).toBeLessThan(monday);
  });

  test('underspending on Monday raises Tuesday', () => {
    const monday = dailyTargetPaise(WEEK, 0, 0);
    const cold = dailyTargetPaise(WEEK, Math.round(monday * 0.3), 1);
    expect(cold).toBeGreaterThan(monday);
  });

  test('the last day gets everything that is left', () => {
    expect(dailyTargetPaise(WEEK, WEEK - 500000, 6)).toBe(500000);
  });

  test('a spent-out week targets zero rather than a negative', () => {
    expect(dailyTargetPaise(WEEK, WEEK + 100000, 3)).toBe(0);
  });

  test('the week holds by construction: seven self-corrected days never exceed it', () => {
    // No hard stop anywhere. The arithmetic alone keeps the week intact.
    let spent = 0;
    for (let d = 0; d < 7; d++) {
      spent += dailyTargetPaise(WEEK, spent, d);
    }
    expect(spent).toBeLessThanOrEqual(WEEK);
  });

  test('rejects a day outside the week', () => {
    expect(() => dailyTargetPaise(WEEK, 0, 7)).toThrow();
    expect(() => dailyTargetPaise(WEEK, 0, -1)).toThrow();
  });

  test('returns integer paise (R7)', () => {
    for (let d = 0; d < 7; d++) {
      expect(Number.isSafeInteger(dailyTargetPaise(999983, 137, d))).toBe(true);
    }
  });
});

describe('the reference curve is a belief, not the truth', () => {
  test('it accumulates to exactly 1 by the end of the day', () => {
    expect(cumulativeReference(23)).toBe(1);
  });

  test('it rises monotonically', () => {
    for (let h = 1; h < 24; h++) {
      expect(cumulativeReference(h)).toBeGreaterThanOrEqual(cumulativeReference(h - 1));
    }
  });

  test('it peaks somewhere other than where real demand peaks', () => {
    // This mismatch is the entire mechanism. If the pacer planned against the
    // real curve it would never overshoot and the 2x cap would be decoration.
    const argmax = (a) => a.indexOf(Math.max(...a));
    const refPeak = argmax(PACING_REFERENCE_CURVE);
    expect(refPeak).not.toBe(argmax(HOUR_PROFILES.evening));
    expect(refPeak).not.toBe(argmax(HOUR_PROFILES.business));
  });

  test('the projected hour is the target times the reference share', () => {
    expect(projectedHourSpendPaise(600000, 13))
      .toBe(Math.round(600000 * PACING_REFERENCE_CURVE[13]));
  });
});

describe('participation is fractional, never a skipped auction (H1)', () => {
  const day = 600000;

  test('an advertiser well behind plan enters everything', () => {
    expect(participationFraction({ dayTargetPaise: day, spentTodayPaise: 0, hour: 12 })).toBe(1);
  });

  test('an advertiser out of money enters nothing', () => {
    const spent = dailyCeilingPaise(day);
    expect(participationFraction({ dayTargetPaise: day, spentTodayPaise: spent, hour: 12 })).toBe(0);
  });

  test('and in between it takes a genuine fraction', () => {
    // The whole point: a partly throttled advertiser participates partly.
    // Skipping the auction instead would consume or forfeit a whole slice of
    // an hour's volume in one step.
    const spent = Math.round(day * 0.75);
    const f = participationFraction({ dayTargetPaise: day, spentTodayPaise: spent, hour: 12 });
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    // budget left, over target times the share of the day still ahead
    expect(f).toBeCloseTo((day - spent) / (day * remainingReference(12)), 6);
  });

  test('exactly on plan participates fully; ahead of plan throttles', () => {
    const onPlan = Math.round(day * (1 - remainingReference(14)));
    expect(participationFraction({ dayTargetPaise: day, spentTodayPaise: onPlan, hour: 14 }))
      .toBeCloseTo(1, 2);
    expect(participationFraction({
      dayTargetPaise: day, spentTodayPaise: onPlan + 100000, hour: 14,
    })).toBeLessThan(1);
  });

  test('it never stutters: a whisker ahead of plan does not shut the hour off', () => {
    // An earlier control law compared spend against the plan cumulative to the
    // current hour, which dropped an account a fraction ahead of plan to zero
    // for a whole hour and then back to full. On an evening-heavy account that
    // shut it out of 20:00 entirely - its single best hour - for reasons no
    // player could have diagnosed.
    for (let h = 0; h < 24; h++) {
      const onPlan = Math.round(day * (1 - remainingReference(h)));
      const f = participationFraction({
        dayTargetPaise: day, spentTodayPaise: onPlan + 1000, hour: h,
      });
      expect(f, `hour ${h}`).toBeGreaterThan(0.5);
    }
  });

  test('it falls smoothly as the day fills up, with no cliff', () => {
    const fractions = [];
    for (let spent = 0; spent <= dailyCeilingPaise(day); spent += 20000) {
      fractions.push(participationFraction({ dayTargetPaise: day, spentTodayPaise: spent, hour: 16 }));
    }
    // Monotonically non-increasing, and it passes through the middle rather
    // than jumping from 1 to 0.
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeLessThanOrEqual(fractions[i - 1]);
    }
    expect(fractions.some((f) => f > 0.05 && f < 0.95)).toBe(true);
  });

  test('a zero target participates in nothing', () => {
    expect(participationFraction({ dayTargetPaise: 0, spentTodayPaise: 0, hour: 12 })).toBe(0);
  });

  test('it always returns a number in [0, 1]', () => {
    for (let h = 0; h < 24; h++) {
      for (const spent of [0, 100000, 600000, 1200000, 5000000]) {
        const f = participationFraction({ dayTargetPaise: day, spentTodayPaise: spent, hour: h });
        expect(f, `hour ${h} spent ${spent}`).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the ceilings', () => {
  const day = 600000;

  test('one day may reach the overspend cap and no further', () => {
    expect(dailyCeilingPaise(day)).toBe(day * DAILY_BUDGET_OVERSPEND_CAP);
    expect(participationFraction({
      dayTargetPaise: day, spentTodayPaise: dailyCeilingPaise(day) - 1, hour: 20,
    })).toBeLessThan(0.01);
  });

  test('the month is a hard cap that overrides the daily plan', () => {
    const f = participationFraction({
      dayTargetPaise: day, spentTodayPaise: 0, hour: 12, monthRemainingPaise: 0,
    });
    expect(f).toBe(0);
  });

  test('a nearly exhausted month throttles even a fresh day', () => {
    const projected = projectedHourSpendPaise(day, 12);
    const f = participationFraction({
      dayTargetPaise: day, spentTodayPaise: 0, hour: 12,
      monthRemainingPaise: Math.round(projected * 0.25),
    });
    expect(f).toBeCloseTo(0.25, 1);
  });

  test('the tightest ceiling wins', () => {
    const generous = participationFraction({
      dayTargetPaise: day, spentTodayPaise: 0, hour: 12, monthRemainingPaise: 99999999,
    });
    const tight = participationFraction({
      dayTargetPaise: day, spentTodayPaise: 0, hour: 12, monthRemainingPaise: 1000,
    });
    expect(tight).toBeLessThan(generous);
  });
});

describe('the curve mismatch produces real overspend (W2, D9)', () => {
  /**
   * Walk one day hour by hour. The market can absorb `appetite` times the
   * day's target, distributed like a real hour profile, while the pacer plans
   * against the generic reference curve.
   */
  function simulateDay(profileName, dayTarget, appetite) {
    const profile = HOUR_PROFILES[profileName];
    let spent = 0;
    const byHour = [];
    for (let h = 0; h < 24; h++) {
      const f = participationFraction({ dayTargetPaise: dayTarget, spentTodayPaise: spent, hour: h });
      const potential = dayTarget * appetite * profile[h];
      const actual = Math.round(potential * f);
      spent += actual;
      byHour.push(actual);
    }
    return { spent, byHour };
  }

  test('an evening-heavy account is broke before its best hours arrive', () => {
    // THIS is what the curve mismatch actually costs, and it is a sharper
    // lesson than overspending. The pacer plans against a generic day peaking
    // early afternoon, so it spends freely all morning on mediocre traffic and
    // has nothing left when the account's real demand shows up at 20:00.
    //
    // The player's fix is dayparting - which is precisely the tool the
    // simulation wants them to reach for.
    const day = 600000;
    const { byHour } = simulateDay('evening', day, 2.5);
    const profile = HOUR_PROFILES.evening;

    const peakHours = [19, 20, 21, 22];
    const demandShare = peakHours.reduce((a, h) => a + profile[h], 0);
    const total = byHour.reduce((a, v) => a + v, 0);
    const spendShare = peakHours.reduce((a, h) => a + byHour[h], 0) / total;

    expect(demandShare).toBeGreaterThan(0.2);
    expect(spendShare).toBeLessThan(demandShare / 2);
  });

  test('a business-profile account keeps far more of its own peak', () => {
    // Its demand sits closer to the generic curve, so the same pacer serves it
    // better. An account whose pattern is unusual gets paced worse.
    const day = 600000;
    const keptPeak = (name, hours) => {
      const { byHour } = simulateDay(name, day, 2.5);
      const total = byHour.reduce((a, v) => a + v, 0);
      const spend = hours.reduce((a, h) => a + byHour[h], 0) / total;
      const demand = hours.reduce((a, h) => a + HOUR_PROFILES[name][h], 0);
      return spend / demand;
    };
    expect(keptPeak('business', [9, 10, 11, 12]))
      .toBeGreaterThan(keptPeak('evening', [19, 20, 21, 22]));
  });

  test('the daily ceiling is enforced whenever it would bind', () => {
    const day = 600000;
    for (const appetite of [1.5, 2.5, 5, 10]) {
      const { spent } = simulateDay('evening', day, appetite);
      expect(spent, `appetite ${appetite}`).toBeLessThanOrEqual(dailyCeilingPaise(day) + 1);
    }
  });

  test('honest note: hourly feedback keeps the day close to target', () => {
    // The 2x cap is a safety rail, not an active mechanic. Because the pacer
    // re-reads actual spend every hour, it converges on the target and total
    // overspend stays under a few per cent. DECISIONS D9 records this rather
    // than claiming a 2x day the model does not actually produce.
    const day = 600000;
    for (const name of ['business', 'evening', 'flat']) {
      const { spent } = simulateDay(name, day, 2.5);
      expect(spent / day, name).toBeGreaterThan(0.95);
      expect(spent / day, name).toBeLessThan(1.10);
    }
  });

  test('a thin market underspends rather than overshooting', () => {
    const day = 600000;
    const { spent } = simulateDay('evening', day, 0.4);
    expect(spent).toBeLessThan(day);
  });

  test('spend is spread across the day, not front-loaded into a cliff', () => {
    const day = 600000;
    const { byHour } = simulateDay('evening', day, 2.5);
    const hoursWithSpend = byHour.filter((v) => v > 0).length;
    expect(hoursWithSpend).toBeGreaterThan(10);
  });
});

describe('validateWeeklySplit (spec 13.2)', () => {
  test('accepts a split that fits the month', () => {
    const quarter = MONTHLY_BUDGET_PAISE / 4;
    expect(validateWeeklySplit([quarter, quarter, quarter, quarter], MONTHLY_BUDGET_PAISE).valid)
      .toBe(true);
  });

  test('accepts an uneven split, which is the point of having one', () => {
    const r = validateWeeklySplit([8000000, 4000000, 3000000, 1800000], MONTHLY_BUDGET_PAISE);
    expect(r.valid).toBe(true);
  });

  test('accepts a split that deliberately leaves money unspent', () => {
    expect(validateWeeklySplit([1000000, 1000000, 1000000, 1000000], MONTHLY_BUDGET_PAISE).valid)
      .toBe(true);
  });

  test('rejects a split asking for more than the month holds', () => {
    const r = validateWeeklySplit(
      [MONTHLY_BUDGET_PAISE, MONTHLY_BUDGET_PAISE, 0, 0], MONTHLY_BUDGET_PAISE,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/above the month/);
  });

  test('rejects a negative or fractional week', () => {
    expect(validateWeeklySplit([-1, 0, 0, 0], MONTHLY_BUDGET_PAISE).valid).toBe(false);
    expect(validateWeeklySplit([1.5, 0, 0, 0], MONTHLY_BUDGET_PAISE).valid).toBe(false);
  });

  test('rejects an empty split', () => {
    expect(validateWeeklySplit([], MONTHLY_BUDGET_PAISE).valid).toBe(false);
  });
});

describe('purity (R1)', () => {
  test('participation is a pure function of its arguments', () => {
    const args = { dayTargetPaise: 600000, spentTodayPaise: 250000, hour: 14 };
    expect(participationFraction(args)).toBe(participationFraction(args));
  });

  test('nothing here mutates its inputs', () => {
    const split = [1000000, 1000000, 1000000, 1000000];
    const before = JSON.stringify(split);
    validateWeeklySplit(split, MONTHLY_BUDGET_PAISE);
    expect(JSON.stringify(split)).toBe(before);
  });
});
