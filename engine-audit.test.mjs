import {
  mulberry32, qualityScore, resolveAuction, runDay, solveScale,
  drawField, effectiveBid, AD_RANK_FLOOR, MAX_SLOTS,
} from "./engine.mjs";

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log("  PASS  " + name); pass++; }
  catch (e) { console.log("  FAIL  " + name + "\n        " + e.message); fail++; }
};
const ok = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) < tol, `${m}: ${a} vs ${b}`);

const COMPS = [
  { name: "Northgate", bid: 62, qs: 6, volatility: 0.2, active: true },
  { name: "Vella", bid: 38, qs: 9, volatility: 0.15, active: true },
  { name: "BudgetBox", bid: 14, qs: 4, volatility: 0.35, active: true },
  { name: "Marlow", bid: 45, qs: 7, volatility: 0.55, active: true },
];
const S = {
  bid: 45, budget: 6000, strategy: "manual", targetCpa: 400, targetRoas: 5,
  expCtr: 7, adRel: 7, lpe: 6, extensions: true, convRate: 4.5,
  aov: 2400, margin: 45, dailyVolume: 9000, daypart: [0,0,0,0,0,0], seed: 42,
};

console.log("\n--- AUCTION ---");

t("second price: pay to beat the advertiser below", () => {
  const field = [{ name: "A", adRank: 40, qs: 5, bid: 8 }];
  const r = resolveAuction(80, 8, 10, field);
  ok(r.position === 1, "should be position 1, got " + r.position);
  near(r.cpc, 40 / 8 + 0.01, 1e-9, "cpc");
});

t("cpc never exceeds bid (fuzz 5000)", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const bid = 1 + rand() * 200, qs = 1 + Math.floor(rand() * 10);
    const field = drawField(COMPS, rand);
    const r = resolveAuction(bid * qs, qs, bid, field);
    if (r.position > 0) ok(r.cpc <= bid + 1e-9, `cpc ${r.cpc} > bid ${bid}`);
  }
});

t("last shown advertiser prices against the floor", () => {
  const r = resolveAuction(10, 5, 100, []);
  near(r.cpc, AD_RANK_FLOOR / 5 + 0.01, 1e-9, "floor price");
});

t("below the floor: no impression", () => {
  const r = resolveAuction(AD_RANK_FLOOR - 0.01, 5, 100, []);
  ok(r.position === 0, "should not show");
  ok(r.cpc === 0, "should cost nothing");
});

t("BUG CHECK: ladder returned when below floor", () => {
  const field = [{ name: "A", adRank: 40, qs: 5, bid: 8 }];
  const r = resolveAuction(3, 5, 100, field);
  ok(r.ladder !== null, "ladder is null when below floor - UI cannot render the field");
});

t("BUG CHECK: below-floor competitors visible in ladder", () => {
  const field = [
    { name: "Strong", adRank: 90, qs: 9, bid: 10 },
    { name: "TooWeak", adRank: 2, qs: 2, bid: 1 },
  ];
  const r = resolveAuction(50, 5, 10, field);
  const names = (r.ladder || []).map(x => x.name);
  ok(names.includes("TooWeak"),
     "below-floor rival dropped from ladder, so UI cannot show 'not shown' rows");
});

t("monotonic: at a fixed ad rank, higher quality never raises cpc", () => {
  const field = [{ name: "A", adRank: 40, qs: 5, bid: 8 }];
  let prev = Infinity;
  for (let qs = 1; qs <= 10; qs++) {
    const r = resolveAuction(200, qs, 500, field);
    if (r.position > 0) { ok(r.cpc <= prev + 1e-9, `cpc rose at qs ${qs}`); prev = r.cpc; }
  }
});

t("monotonic: raising bid never worsens position", () => {
  const rand = mulberry32(3);
  const field = drawField(COMPS, rand);
  let prev = 99;
  for (let bid = 5; bid <= 200; bid += 5) {
    const r = resolveAuction(bid * 7, 7, bid, field);
    const p = r.position === 0 ? 99 : r.position;
    ok(p <= prev, `position worsened from ${prev} to ${p} at bid ${bid}`);
    prev = p;
  }
});

console.log("\n--- DAY ---");

t("determinism: same seed, same result", () => {
  const a = runDay(S, COMPS), b = runDay(S, COMPS);
  ok(a.cost === b.cost && a.clicks === b.clicks, "not deterministic");
});

t("impression share components sum to 1", () => {
  const r = runDay(S, COMPS);
  near(r.is + r.isLostRank + r.isLostBudget, 1, 1e-6, "IS decomposition");
});

t("BUG CHECK: spend never exceeds budget", () => {
  const r = runDay({ ...S, budget: 2000 }, COMPS);
  ok(r.cost <= 2000, `spend ${r.cost.toFixed(2)} exceeded budget 2000`);
});

t("quality lowers cpc AT A FIXED POSITION (the true claim)", () => {
  const field = [{ name: "A", adRank: 40, qs: 5, bid: 8 }];
  const a = resolveAuction(200, 4, 500, field);
  const b = resolveAuction(200, 9, 500, field);
  ok(a.position === b.position, "positions differ, not a fair comparison");
  ok(b.cpc < a.cpc, `qs9 cpc ${b.cpc} not below qs4 cpc ${a.cpc}`);
});

t("quality also lifts position, which costs more (the caveat)", () => {
  const lo = runDay({ ...S, expCtr: 3, adRel: 3, lpe: 3 }, COMPS);
  const hi = runDay({ ...S, expCtr: 10, adRel: 10, lpe: 10 }, COMPS);
  ok(hi.absTopIs > lo.absTopIs, "higher quality did not win better positions");
  ok(hi.clicks > lo.clicks, "higher quality did not win more clicks");
});

t("BUG CHECK: removing a competitor lowers avg CPC", () => {
  const withAll = runDay(S, COMPS);
  const fewer = runDay(S, COMPS.map((c, i) => i === 0 ? { ...c, active: false } : c));
  ok(fewer.avgCpc < withAll.avgCpc,
     `avgCpc ${fewer.avgCpc.toFixed(3)} not below ${withAll.avgCpc.toFixed(3)}`);
});

t("dayparting: negative adjustment reduces spend in that block", () => {
  const base = runDay(S, COMPS);
  const cut = runDay({ ...S, daypart: [-90, 0, 0, 0, 0, 0] }, COMPS);
  const baseNight = base.hours.slice(0, 6).reduce((a, h) => a + h.cost, 0);
  const cutNight = cut.hours.slice(0, 6).reduce((a, h) => a + h.cost, 0);
  ok(cutNight < baseNight, "night spend did not fall");
});

console.log("\n--- STRATEGIES ---");

t("maxClicks spends close to the budget", () => {
  const s = { ...S, strategy: "maxClicks" };
  const scale = solveScale(s, COMPS);
  const r = runDay(s, COMPS, scale);
  ok(r.cost > s.budget * 0.85, `only spent ${r.cost.toFixed(0)} of ${s.budget}`);
  ok(r.cost <= s.budget * 1.02, `overspent: ${r.cost.toFixed(0)}`);
});

t("targetCpa bids higher in high-intent hours", () => {
  const s = { ...S, strategy: "targetCpa" };
  ok(effectiveBid(s, 20, 1) > effectiveBid(s, 3, 1), "no intent shaping");
});

t("BUG CHECK: targetRoas guards against zero target", () => {
  const s = { ...S, strategy: "targetRoas", targetRoas: 0 };
  const b = effectiveBid(s, 12, 1);
  ok(Number.isFinite(b), "non-finite bid at targetRoas 0");
});

t("BUG CHECK: maxConv actually differs from maxClicks", () => {
  const a = effectiveBid({ ...S, strategy: "maxClicks" }, 20, 1);
  const b = effectiveBid({ ...S, strategy: "maxConv" }, 20, 1);
  ok(a !== b, "maxConv is identical to maxClicks at hour 20");
});

t("solveScale reaches an unspendable budget by saturating the market", () => {
  const s = { ...S, strategy: "maxClicks", budget: 500000 };
  const r = runDay(s, COMPS, solveScale(s, COMPS));
  ok(r.is > 0.99, `impression share only ${(r.is*100).toFixed(1)}% - solver gave up early`);
});

t("solveScale hits a reachable budget accurately", () => {
  for (const budget of [1000, 4000, 12000, 30000]) {
    const s = { ...S, strategy: "maxClicks", budget };
    const r = runDay(s, COMPS, solveScale(s, COMPS));
    ok(r.cost > budget * 0.9 || r.is > 0.99,
       `budget ${budget}: spent only ${r.cost.toFixed(0)} at IS ${(r.is*100).toFixed(0)}%`);
  }
});

console.log("\n--- PERFORMANCE ---");
t("full render path under 400ms", () => {
  const s = { ...S, strategy: "maxClicks" };
  const t0 = Date.now();
  const scale = solveScale(s, COMPS);
  runDay(s, COMPS, scale);
  const ms = Date.now() - t0;
  console.log("        took " + ms + "ms");
  ok(ms < 400, `too slow: ${ms}ms per interaction`);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
