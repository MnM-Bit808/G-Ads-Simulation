import { useState, useMemo } from "react";

/* ============================================================
   ENGINE CONSTANTS
   ============================================================ */

const RAW_DEMAND = [
  0.8, 0.5, 0.35, 0.3, 0.35, 0.6, 1.2, 2.2, 3.6, 4.6, 5.2, 5.6,
  5.4, 5.0, 4.8, 4.9, 5.1, 5.4, 5.8, 6.2, 6.0, 4.8, 3.2, 1.8,
];
const DEMAND_SUM = RAW_DEMAND.reduce((a, b) => a + b, 0);
const DEMAND = RAW_DEMAND.map((v) => v / DEMAND_SUM);

// Intent quality by hour. Evening browsers convert best.
const CONV_MULT = [
  0.6, 0.55, 0.5, 0.5, 0.6, 0.7, 0.85, 0.95, 1.0, 1.05, 1.1, 1.15,
  1.1, 1.0, 0.95, 0.95, 1.0, 1.1, 1.25, 1.4, 1.45, 1.3, 1.05, 0.8,
];

// Slots 1-4 render above the organic results, 5-7 below.
const POS_CTR_MULT = [1, 0.62, 0.42, 0.3, 0.12, 0.08, 0.06];
const TOP_SLOTS = 4;
const MAX_SLOTS = 7;
const AD_RANK_FLOOR = 6;
const SAMPLES_PER_HOUR = 48;

const DAYPART_BLOCKS = [
  { label: "Late night", start: 0, end: 6 },
  { label: "Early morning", start: 6, end: 9 },
  { label: "Late morning", start: 9, end: 12 },
  { label: "Afternoon", start: 12, end: 17 },
  { label: "Evening", start: 17, end: 21 },
  { label: "Night", start: 21, end: 24 },
];

const STRATEGIES = {
  manual: "Manual CPC",
  maxClicks: "Maximise clicks",
  targetCpa: "Target CPA",
  targetRoas: "Target ROAS",
  maxConv: "Maximise conversions",
};

/* ============================================================
   MATH
   ============================================================ */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function qualityScore(q) {
  return clamp(Math.round(0.5 * q.expCtr + 0.3 * q.adRel + 0.2 * q.lpe), 1, 10);
}

// Expected click-through at slot 1, driven by the expected-CTR component.
function baseCtr(expCtr) {
  return 0.02 + ((expCtr - 1) / 9) * 0.1;
}

function daypartMultiplier(adjustments, hour) {
  const block = DAYPART_BLOCKS.findIndex((b) => hour >= b.start && hour < b.end);
  return 1 + (adjustments[block] ?? 0) / 100;
}

/**
 * The bid the strategy actually submits for a given hour.
 * Value-based strategies re-derive their bid from the conversion
 * rate of that hour, which is why they daypart without being told to.
 */
function effectiveBid(s, hour, scale) {
  const cr = s.convRate / 100 * CONV_MULT[hour];
  switch (s.strategy) {
    case "manual":
      return s.bid * daypartMultiplier(s.daypart, hour);
    case "maxClicks":
      return s.bid * scale;
    case "targetCpa":
      return s.targetCpa * cr;
    case "targetRoas":
      return (s.aov * cr) / (s.targetRoas || 1);
    case "maxConv":
      return s.bid * scale * CONV_MULT[hour];
    default:
      return s.bid;
  }
}

/** Draw the field of competing ad ranks for one auction. */
function drawField(competitors, rand) {
  return competitors
    .filter((c) => c.active)
    .map((c) => {
      const noise = 1 + (rand() - 0.5) * 2 * c.volatility;
      return {
        name: c.name,
        qs: c.qs,
        bid: c.bid,
        adRank: c.bid * c.qs * Math.max(0.1, noise),
      };
    });
}

/**
 * Resolve one auction.
 *
 * Always returns the FULL ladder, including advertisers who fell below the ad
 * rank floor, each flagged with `shown`. The interface needs to render those
 * rows: "your rival bid but never appeared" is one of the things worth seeing.
 */
function resolveAuction(myAdRank, myQs, myBid, field) {
  const all = [
    ...field,
    { name: "__me__", adRank: myAdRank, qs: myQs, bid: myBid },
  ].sort((a, b) => b.adRank - a.adRank);

  // Slots go only to advertisers clearing the floor, in rank order.
  let slot = 0;
  for (const entry of all) {
    if (entry.adRank >= AD_RANK_FLOOR && slot < MAX_SLOTS) {
      entry.shown = true;
      entry.position = ++slot;
    } else {
      entry.shown = false;
      entry.position = 0;
    }
  }

  const me = all.find((a) => a.name === "__me__");
  if (!me.shown) return { position: 0, cpc: 0, ladder: all };

  // Second price: pay just enough to beat the advertiser in the slot below.
  const below = all.find((a) => a.shown && a.position === me.position + 1);
  const beatRank = below ? below.adRank : AD_RANK_FLOOR;
  const cpc = Math.min(myBid, beatRank / myQs + 0.01);

  return { position: me.position, cpc, ladder: all, beatRank };
}

/** Run a full 24-hour day. */
function runDay(s, competitors, scale = 1) {
  const qs = qualityScore(s);
  const extBoost = s.extensions ? 1.1 : 1;
  const ctr1 = baseCtr(s.expCtr);
  const rand = mulberry32(s.seed);

  const hours = [];
  let spend = 0;
  let budgetHitAt = null;

  const totals = {
    eligible: 0, impressions: 0, topImpr: 0, absTopImpr: 0,
    clicks: 0, cost: 0, conversions: 0,
    lostRank: 0, lostBudget: 0,
    posCounts: [0, 0, 0, 0, 0, 0, 0],
  };

  for (let h = 0; h < 24; h++) {
    const volume = s.dailyVolume * DEMAND[h];
    const weight = volume / SAMPLES_PER_HOUR;
    const bid = effectiveBid(s, h, scale);
    const myAdRank = bid * qs * extBoost;
    const hourCr = (s.convRate / 100) * CONV_MULT[h];

    const hr = {
      hour: h, volume, bid, impressions: 0, clicks: 0,
      cost: 0, conversions: 0, lostRank: 0, lostBudget: 0, capped: false,
    };

    for (let i = 0; i < SAMPLES_PER_HOUR; i++) {
      totals.eligible += weight;

      if (spend >= s.budget) {
        hr.lostBudget += weight;
        totals.lostBudget += weight;
        hr.capped = true;
        if (budgetHitAt === null) budgetHitAt = h;
        continue;
      }

      const field = drawField(competitors, rand);
      const { position, cpc } = resolveAuction(myAdRank, qs, bid, field);

      if (position === 0) {
        hr.lostRank += weight;
        totals.lostRank += weight;
        continue;
      }

      const ctr = ctr1 * POS_CTR_MULT[position - 1];
      let served = weight;
      let clicks = served * ctr;
      let cost = clicks * cpc;

      // Pro-rate the final sample so the day stops exactly at the budget
      // rather than overshooting by one whole sample's worth of spend.
      if (cost > 0 && spend + cost > s.budget) {
        const frac = Math.max(0, (s.budget - spend) / cost);
        const unserved = weight * (1 - frac);
        served = weight * frac;
        clicks = served * ctr;
        cost = clicks * cpc;
        hr.lostBudget += unserved;
        totals.lostBudget += unserved;
        hr.capped = true;
        if (budgetHitAt === null) budgetHitAt = h;
      }

      hr.impressions += served;
      hr.clicks += clicks;
      hr.cost += cost;
      hr.conversions += clicks * hourCr;
      spend += cost;

      totals.impressions += served;
      totals.posCounts[position - 1] += served;
      if (position <= TOP_SLOTS) totals.topImpr += served;
      if (position === 1) totals.absTopImpr += served;
      totals.clicks += clicks;
      totals.cost += cost;
      totals.conversions += clicks * hourCr;
    }
    hours.push(hr);
  }

  const revenue = totals.conversions * s.aov;
  const grossProfit = revenue * (s.margin / 100);

  return {
    qs, hours, budgetHitAt,
    ...totals,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    avgCpc: totals.clicks ? totals.cost / totals.clicks : 0,
    cpa: totals.conversions ? totals.cost / totals.conversions : 0,
    convRateActual: totals.clicks ? totals.conversions / totals.clicks : 0,
    revenue,
    roas: totals.cost ? revenue / totals.cost : 0,
    profit: grossProfit - totals.cost,
    is: totals.eligible ? totals.impressions / totals.eligible : 0,
    topIs: totals.eligible ? totals.topImpr / totals.eligible : 0,
    absTopIs: totals.eligible ? totals.absTopImpr / totals.eligible : 0,
    isLostRank: totals.eligible ? totals.lostRank / totals.eligible : 0,
    isLostBudget: totals.eligible ? totals.lostBudget / totals.eligible : 0,
  };
}

/**
 * Budget-spending strategies need a bid that exhausts the budget without
 * overshooting it. Binary search until spend lands on target.
 */
function solveScale(s, competitors) {
  if (s.strategy !== "maxClicks" && s.strategy !== "maxConv") return 1;

  // Expand the upper bound until it can actually reach the budget, otherwise
  // the search silently pins at its ceiling and underspends without saying so.
  let lo = 0.05, hi = 12;
  for (let i = 0; i < 8 && runDay(s, competitors, hi).cost < s.budget * 0.97; i++) {
    lo = hi;
    hi *= 3;
  }

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const r = runDay(s, competitors, mid);
    if (r.cost > s.budget * 0.97) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/* ============================================================
   FORMATTING
   ============================================================ */

const inr = (v, d = 0) =>
  "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const num = (v) => Math.round(v).toLocaleString("en-IN");

/* ============================================================
   PRIMITIVES
   ============================================================ */

function Slider({ label, value, onChange, min, max, step = 1, format, hint }) {
  return (
    <div className="ctl">
      <div className="ctl-head">
        <label>{label}</label>
        <span className="ctl-val">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <p className="ctl-hint">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={"stat-val" + (tone ? " t-" + tone : "")}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ============================================================
   VIEW: AUCTION LADDER
   ============================================================ */

function AuctionView({ s, competitors, result, scale }) {
  const [hour, setHour] = useState(20);

  const auction = useMemo(() => {
    const qs = result.qs;
    const bid = effectiveBid(s, hour, scale);
    const myAdRank = bid * qs * (s.extensions ? 1.1 : 1);
    const rand = mulberry32(s.seed + hour * 7919);
    for (let i = 0; i < 5; i++) rand();
    const field = drawField(competitors, rand);
    const res = resolveAuction(myAdRank, qs, bid, field);
    return { qs, bid, myAdRank, field, ...res };
  }, [s, competitors, hour, result.qs, scale]);

  const rows = auction.ladder;
  const maxRank = Math.max(...rows.map((r) => r.adRank), AD_RANK_FLOOR * 1.5);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>One auction, resolved</h2>
          <p>
            A person searches at {String(hour).padStart(2, "0")}:00. Every advertiser
            competing for that query is ranked, and only the top {MAX_SLOTS} get shown.
          </p>
        </div>
        <div className="hour-pick">
          <label htmlFor="hr">Hour of day</label>
          <input
            id="hr" type="range" min={0} max={23} value={hour}
            onChange={(e) => setHour(parseInt(e.target.value))}
          />
          <span className="mono">{String(hour).padStart(2, "0")}:00</span>
        </div>
      </div>

      <div className="ladder">
        {rows.map((r, i) => {
          const me = r.name === "__me__";
          const shown = r.shown;
          const top = shown && r.position <= TOP_SLOTS;
          return (
            <div key={r.name + i} className={"rung" + (me ? " rung-me" : "")}>
              <div className="rung-pos">
                {shown ? r.position : "—"}
              </div>
              <div className="rung-body">
                <div className="rung-top">
                  <span className="rung-name">{me ? "Your ad" : r.name}</span>
                  <span className="rung-slot">
                    {!shown ? "not shown" : top ? "above results" : "below results"}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: (r.adRank / maxRank) * 100 + "%" }}
                  />
                  <div
                    className="bar-floor"
                    style={{ left: (AD_RANK_FLOOR / maxRank) * 100 + "%" }}
                  />
                </div>
                <div className="rung-math mono">
                  {inr(r.bid, 2)} bid × {r.qs} quality
                  {me && s.extensions ? " × 1.10 extensions" : ""} = {r.adRank.toFixed(1)} ad rank
                </div>
              </div>
            </div>
          );
        })}
        <div className="floor-note mono">
          Ad rank floor {AD_RANK_FLOOR.toFixed(1)} — anything below this shows no ad at all
        </div>
      </div>

      <div className="derive">
        <h3>What you actually pay</h3>
        {auction.position === 0 ? (
          <p className="derive-miss">
            Your ad did not appear. Either your ad rank fell under the floor, or seven
            advertisers outranked you. Raise the bid, or raise quality and pay less to
            get there.
          </p>
        ) : (
          <>
            <p>
              You landed in position {auction.position}. You are not charged your bid.
              You are charged the minimum needed to hold off the advertiser directly
              beneath you.
            </p>
            <div className="formula mono">
              <span className="f-line">
                CPC = (ad rank below ÷ your quality score) + ₹0.01
              </span>
              <span className="f-line">
                = ({auction.beatRank.toFixed(1)} ÷ {auction.qs}) + ₹0.01
              </span>
              <span className="f-line f-result">= {inr(auction.cpc, 2)} per click</span>
            </div>
            <p className="derive-note">
              You bid {inr(auction.bid, 2)} and paid {inr(auction.cpc, 2)}, a discount of{" "}
              {pct(1 - auction.cpc / auction.bid)}. Holding this position, a quality
              score of 10 would cost {inr(Math.min(auction.bid, auction.beatRank / 10 + 0.01), 2)}{" "}
              instead, because you divide by a bigger number.
            </p>
            <p className="derive-note">
              One caveat the dashboards rarely spell out: quality lowers the price of a
              given position, but it also lifts you into better positions, where the
              advertiser beneath you is stronger and therefore more expensive to beat.
              So improving quality does not reliably lower your average CPC. What it
              buys is more traffic for the same money, or the same traffic for less.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   VIEW: DAY DASHBOARD
   ============================================================ */

function DayView({ s, result }) {
  const isSegs = [
    { key: "won", label: "Impressions won", val: result.is, color: "var(--you)" },
    { key: "rank", label: "Lost to rank", val: result.isLostRank, color: "var(--grey)" },
    { key: "budget", label: "Lost to budget", val: result.isLostBudget, color: "var(--warn)" },
  ];

  const posMax = Math.max(...result.posCounts, 1);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>The day, totalled</h2>
          <p>
            {num(result.eligible)} searches happened that your keywords were eligible
            for. Here is what you got from them.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Impressions" value={num(result.impressions)} />
        <Stat label="Clicks" value={num(result.clicks)} sub={pct(result.ctr, 2) + " CTR"} />
        <Stat label="Avg. CPC" value={inr(result.avgCpc, 2)} />
        <Stat label="Cost" value={inr(result.cost)} sub={"of " + inr(s.budget) + " budget"}
          tone={result.cost >= s.budget * 0.97 ? "warn" : null} />
        <Stat label="Conversions" value={result.conversions.toFixed(1)}
          sub={pct(result.convRateActual, 2) + " conv. rate"} tone="good" />
        <Stat label="Cost per conversion" value={result.conversions >= 0.5 ? inr(result.cpa) : "—"} />
        <Stat label="Revenue" value={inr(result.revenue)} />
        <Stat label="ROAS" value={result.roas.toFixed(2) + "×"}
          tone={result.roas >= 4 ? "good" : result.roas < 2 ? "warn" : null} />
        <Stat label="Profit after cost of goods" value={inr(result.profit)}
          tone={result.profit > 0 ? "good" : "bad"} />
      </div>

      <div className="split">
        <section className="panel">
          <h3>Where your impressions went</h3>
          <p className="panel-lede">
            Impression share is the single most useful diagnostic on the platform,
            because it splits your losses into two problems with two different fixes.
          </p>
          <div className="is-bar">
            {isSegs.map((seg) => (
              <div key={seg.key} className="is-seg"
                style={{ width: seg.val * 100 + "%", background: seg.color }} />
            ))}
          </div>
          <ul className="legend">
            {isSegs.map((seg) => (
              <li key={seg.key}>
                <span className="dot" style={{ background: seg.color }} />
                {seg.label}
                <span className="mono legend-val">{pct(seg.val)}</span>
              </li>
            ))}
          </ul>
          <div className="sub-stats">
            <div><span>Top impression share</span><b className="mono">{pct(result.topIs)}</b></div>
            <div><span>Absolute top share</span><b className="mono">{pct(result.absTopIs)}</b></div>
          </div>
          <p className="diagnosis">
            {result.isLostBudget > result.isLostRank
              ? "Budget is your binding constraint. Raising bids now just burns the budget faster on fewer searches. Either raise the budget, or cut spend on low-value hours so the money survives to reach the good ones."
              : result.isLostRank > 0.4
              ? "Rank is your binding constraint. You are being outranked, not outspent. Higher bids will help, but improving quality score does the same job without raising your cost per click."
              : "You are holding a healthy share of this market. The remaining losses are the normal cost of not winning every single auction."}
          </p>
        </section>

        <section className="panel">
          <h3>Position distribution</h3>
          <p className="panel-lede">
            You do not occupy one position. You occupy a spread of them, and it shifts
            every auction as competitors' ranks move.
          </p>
          <div className="pos-chart">
            {result.posCounts.map((c, i) => (
              <div key={i} className="pos-row">
                <span className="pos-num mono">{i + 1}</span>
                <div className="pos-track">
                  <div className="pos-fill"
                    style={{
                      width: (c / posMax) * 100 + "%",
                      background: i < TOP_SLOTS ? "var(--you)" : "var(--grey)",
                    }} />
                </div>
                <span className="pos-val mono">{num(c)}</span>
              </div>
            ))}
          </div>
          <p className="derive-note">
            Positions 1–4 sit above the organic results and take the overwhelming
            majority of clicks. Slipping from 1 to 4 costs you about {pct(1 - POS_CTR_MULT[3])} of
            your click-through rate.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ============================================================
   VIEW: DAYPARTING
   ============================================================ */

function HoursView({ s, set, result }) {
  const [metric, setMetric] = useState("cost");

  const metrics = {
    cost: { label: "Spend", get: (h) => h.cost, fmt: (v) => inr(v) },
    clicks: { label: "Clicks", get: (h) => h.clicks, fmt: (v) => num(v) },
    conversions: { label: "Conversions", get: (h) => h.conversions, fmt: (v) => v.toFixed(1) },
    bid: { label: "Bid submitted", get: (h) => h.bid, fmt: (v) => inr(v, 2) },
    volume: { label: "Searches available", get: (h) => h.volume, fmt: (v) => num(v) },
  };

  const m = metrics[metric];
  const vals = result.hours.map(m.get);
  const max = Math.max(...vals, 0.0001);

  const auto = s.strategy === "targetCpa" || s.strategy === "targetRoas";

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>The day, hour by hour</h2>
          <p>
            Demand and buying intent are not flat. Evening searchers convert roughly
            twice as often as 3am searchers, and your bidding either accounts for that
            or wastes money.
          </p>
        </div>
      </div>

      <div className="tabs-mini">
        {Object.entries(metrics).map(([k, v]) => (
          <button key={k} className={"mini" + (metric === k ? " mini-on" : "")}
            onClick={() => setMetric(k)}>{v.label}</button>
        ))}
      </div>

      <div className="hours-chart">
        {result.hours.map((h) => {
          const v = m.get(h);
          return (
            <div key={h.hour} className="hcol">
              <div className="hcol-track">
                <div
                  className={"hcol-fill" + (h.capped ? " hcol-capped" : "")}
                  style={{ height: Math.max(1, (v / max) * 100) + "%" }}
                  title={m.fmt(v)}
                />
              </div>
              <span className="hcol-lab mono">{h.hour % 3 === 0 ? h.hour : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="chart-foot">
        <span className="mono">Peak {m.fmt(max)}</span>
        {result.budgetHitAt !== null && (
          <span className="mono warn-text">
            Budget exhausted at {String(result.budgetHitAt).padStart(2, "0")}:00 — every
            search after this point was lost
          </span>
        )}
      </div>

      <section className="panel">
        <h3>Bid adjustments by time block</h3>
        {auto ? (
          <p className="panel-lede lede-lock">
            {STRATEGIES[s.strategy]} sets its own bids from the conversion rate it
            expects in each hour, so manual adjustments are ignored. Switch the chart to
            "Bid submitted" and watch it climb into the evening on its own. This is what
            automated bidding is actually doing.
          </p>
        ) : (
          <p className="panel-lede">
            A −60% adjustment on late night means you bid 40% of your base there. Pull
            spend out of hours that convert badly and it survives to reach hours that
            convert well.
          </p>
        )}
        <div className={"daypart-grid" + (auto ? " is-locked" : "")}>
          {DAYPART_BLOCKS.map((b, i) => {
            const avgConv =
              CONV_MULT.slice(b.start, b.end).reduce((a, c) => a + c, 0) / (b.end - b.start);
            return (
              <div key={b.label} className="dp">
                <div className="dp-head">
                  <span>{b.label}</span>
                  <span className="mono">
                    {String(b.start).padStart(2, "0")}–{String(b.end).padStart(2, "0")}
                  </span>
                </div>
                <input
                  type="range" min={-90} max={200} step={5} disabled={auto}
                  value={s.daypart[i]}
                  onChange={(e) => {
                    const next = [...s.daypart];
                    next[i] = parseInt(e.target.value);
                    set({ daypart: next });
                  }}
                />
                <div className="dp-foot">
                  <span className="mono dp-adj">
                    {s.daypart[i] > 0 ? "+" : ""}{s.daypart[i]}%
                  </span>
                  <span className="dp-intent">
                    converts {avgConv >= 1.15 ? "well" : avgConv >= 0.9 ? "averagely" : "poorly"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   VIEW: MARKET
   ============================================================ */

function MarketView({ competitors, setCompetitors, result }) {
  const upd = (i, patch) =>
    setCompetitors(competitors.map((c, j) => (i === j ? { ...c, ...patch } : c)));

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Who you are bidding against</h2>
          <p>
            Your results are never about your settings alone. Switch a competitor off and
            watch your cost per click fall without you changing a thing.
          </p>
        </div>
      </div>

      <div className="comp-grid">
        {competitors.map((c, i) => (
          <div key={c.name} className={"comp" + (c.active ? "" : " comp-off")}>
            <div className="comp-head">
              <span className="comp-name">{c.name}</span>
              <button className="toggle" onClick={() => upd(i, { active: !c.active })}>
                {c.active ? "In the auction" : "Sitting out"}
              </button>
            </div>
            <p className="comp-desc">{c.desc}</p>
            <Slider label="Max bid" value={c.bid} min={5} max={150} step={1}
              onChange={(v) => upd(i, { bid: v })} format={(v) => inr(v)} />
            <Slider label="Quality score" value={c.qs} min={1} max={10} step={1}
              onChange={(v) => upd(i, { qs: v })} />
            <Slider label="Bid volatility" value={c.volatility} min={0} max={0.8} step={0.05}
              onChange={(v) => upd(i, { volatility: v })}
              format={(v) => pct(v, 0)}
              hint="How much their ad rank swings between auctions" />
            <div className="comp-rank mono">
              Typical ad rank {(c.bid * c.qs).toFixed(0)}
              {c.active && c.bid * c.qs < AD_RANK_FLOOR ? " — below floor, never shows" : ""}
            </div>
          </div>
        ))}
      </div>

      <p className="derive-note">
        Your ad rank right now is roughly{" "}
        <span className="mono">{(result.hours[12].bid * result.qs).toFixed(0)}</span>. Compare
        it against the numbers above to see exactly why you sit where you sit.
      </p>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

const DEFAULT_COMPETITORS = [
  { name: "Northgate Direct", desc: "Deep pockets, mediocre landing page. Buys position.", bid: 62, qs: 6, volatility: 0.2, active: true },
  { name: "Vella & Co.", desc: "Excellent ads, disciplined bidding. Your real problem.", bid: 38, qs: 9, volatility: 0.15, active: true },
  { name: "BudgetBox", desc: "Cheap bids, weak quality. Often below the floor.", bid: 14, qs: 4, volatility: 0.35, active: true },
  { name: "Marlow Retail", desc: "Erratic automated bidding. Swings wildly.", bid: 45, qs: 7, volatility: 0.55, active: true },
];

const DEFAULT_SETTINGS = {
  bid: 45,
  budget: 6000,
  strategy: "manual",
  targetCpa: 400,
  targetRoas: 5,
  expCtr: 7,
  adRel: 7,
  lpe: 6,
  extensions: true,
  convRate: 4.5,
  aov: 2400,
  margin: 45,
  dailyVolume: 9000,
  daypart: [0, 0, 0, 0, 0, 0],
  seed: 42,
};

export default function AdsAuctionSandbox() {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [competitors, setCompetitors] = useState(DEFAULT_COMPETITORS);
  const [tab, setTab] = useState("auction");

  const set = (patch) => setS((p) => ({ ...p, ...patch }));

  const scale = useMemo(() => solveScale(s, competitors), [s, competitors]);
  const result = useMemo(() => runDay(s, competitors, scale), [s, competitors, scale]);

  const qs = result.qs;
  const spendsBudget = s.strategy === "maxClicks" || s.strategy === "maxConv";

  return (
    <div className="root">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.root {
  --ground:#E9ECEF; --panel:#FFFFFF; --ink:#14181D; --muted:#6B7480;
  --rule:#D2D8DE; --you:#1B44C8; --grey:#8A939D; --warn:#B26B00; --good:#0E7A5F;
  --bad:#A32B1C;
  font-family:'IBM Plex Sans',system-ui,sans-serif;
  background:var(--ground); color:var(--ink);
  min-height:100vh; font-size:14px; line-height:1.5;
}
.root *{box-sizing:border-box;}
.mono{font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums;}
.root h1,.root h2,.root h3{margin:0; font-weight:600; letter-spacing:-0.01em;}
.root p{margin:0;}

.masthead{padding:22px 26px 18px; border-bottom:1px solid var(--rule); background:var(--panel);}
.masthead h1{font-size:21px;}
.masthead p{color:var(--muted); margin-top:5px; max-width:62ch;}

.shell{display:grid; grid-template-columns:296px 1fr; align-items:start;}
@media (max-width:900px){ .shell{grid-template-columns:1fr;} }

.rail{background:var(--panel); border-right:1px solid var(--rule);
  padding:18px 18px 40px; position:sticky; top:0; max-height:100vh; overflow-y:auto;}
@media (max-width:900px){ .rail{position:static; max-height:none; border-right:none;
  border-bottom:1px solid var(--rule);} }
.rail-group{margin-bottom:24px;}
.rail-group > h3{font-size:12px; font-weight:600; color:var(--muted);
  padding-bottom:7px; border-bottom:1px solid var(--rule); margin-bottom:13px;}

.ctl{margin-bottom:15px;}
.ctl-head{display:flex; justify-content:space-between; align-items:baseline; gap:8px;}
.ctl-head label{font-size:13px;}
.ctl-val{font-family:'IBM Plex Mono',monospace; font-size:12.5px;
  font-variant-numeric:tabular-nums; color:var(--you); font-weight:500;}
.ctl-hint{font-size:11.5px; color:var(--muted); margin-top:3px; line-height:1.35;}

.root input[type=range]{width:100%; margin-top:6px; accent-color:var(--you);
  height:18px; cursor:pointer;}
.root input[type=range]:disabled{accent-color:var(--grey); cursor:not-allowed; opacity:.5;}
.root input[type=range]:focus-visible{outline:2px solid var(--you); outline-offset:3px;}

.field{margin-bottom:15px;}
.field label{display:block; font-size:13px; margin-bottom:5px;}
.field select, .field input[type=number]{width:100%; padding:7px 8px;
  border:1px solid var(--rule); border-radius:3px; background:var(--panel);
  font-family:inherit; font-size:13px; color:var(--ink);}
.field select:focus-visible, .field input:focus-visible{outline:2px solid var(--you);
  outline-offset:1px;}

.check{display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;
  margin-bottom:14px;}
.check input{accent-color:var(--you); width:15px; height:15px;}

.qs-readout{border:1px solid var(--rule); border-radius:3px; padding:11px 12px;
  display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;}
.qs-readout span{font-size:12.5px; color:var(--muted);}
.qs-num{font-family:'IBM Plex Mono',monospace; font-size:26px; font-weight:500;
  color:var(--you); line-height:1;}

.tabs{display:flex; gap:0; border-bottom:1px solid var(--rule); background:var(--panel);
  padding:0 26px; overflow-x:auto;}
.tab{background:none; border:none; border-bottom:2px solid transparent;
  padding:13px 15px; font-family:inherit; font-size:13.5px; color:var(--muted);
  cursor:pointer; white-space:nowrap;}
.tab:hover{color:var(--ink);}
.tab-on{color:var(--ink); border-bottom-color:var(--you); font-weight:500;}
.tab:focus-visible{outline:2px solid var(--you); outline-offset:-2px;}

.view{padding:24px 26px 56px; max-width:1040px;}
.view-head{display:flex; justify-content:space-between; align-items:flex-start;
  gap:26px; margin-bottom:22px; flex-wrap:wrap;}
.view-head h2{font-size:18px; margin-bottom:5px;}
.view-head p{color:var(--muted); max-width:66ch;}

.hour-pick{min-width:190px;}
.hour-pick label{display:block; font-size:12px; color:var(--muted); margin-bottom:2px;}
.hour-pick span{font-size:13px;}

.ladder{background:var(--panel); border:1px solid var(--rule); border-radius:4px;
  padding:6px 0 0;}
.rung{display:flex; gap:13px; padding:12px 16px; border-bottom:1px solid var(--rule);}
.rung:last-of-type{border-bottom:none;}
.rung-me{background:#F2F5FE;}
.rung-pos{font-family:'IBM Plex Mono',monospace; font-size:15px; width:22px;
  text-align:right; color:var(--muted); padding-top:1px;}
.rung-me .rung-pos{color:var(--you); font-weight:500;}
.rung-body{flex:1; min-width:0;}
.rung-top{display:flex; justify-content:space-between; gap:10px; margin-bottom:6px;}
.rung-name{font-size:13.5px;}
.rung-me .rung-name{font-weight:600; color:var(--you);}
.rung-slot{font-size:11.5px; color:var(--muted);}
.bar-track{position:relative; height:7px; background:var(--ground); border-radius:2px;
  overflow:visible;}
.bar-fill{height:100%; background:var(--grey); border-radius:2px;}
.rung-me .bar-fill{background:var(--you);}
.bar-floor{position:absolute; top:-3px; bottom:-3px; width:1px; background:var(--bad);}
.rung-math{font-size:11.5px; color:var(--muted); margin-top:6px;}
.floor-note{font-size:11.5px; color:var(--bad); padding:10px 16px;
  border-top:1px solid var(--rule);}

.derive{margin-top:20px; background:var(--panel); border:1px solid var(--rule);
  border-radius:4px; padding:18px 20px;}
.derive h3{font-size:15px; margin-bottom:9px;}
.derive p{color:var(--muted); max-width:68ch;}
.derive-miss{color:var(--bad) !important;}
.formula{margin:14px 0; padding:13px 15px; background:var(--ground); border-radius:3px;
  display:flex; flex-direction:column; gap:5px; font-size:13px;}
.f-line{color:var(--muted);}
.f-result{color:var(--you); font-weight:500; font-size:15px;}
.derive-note{font-size:12.5px; color:var(--muted); margin-top:12px; max-width:70ch;}

.stat-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(158px,1fr));
  gap:1px; background:var(--rule); border:1px solid var(--rule); border-radius:4px;
  overflow:hidden; margin-bottom:22px;}
.stat{background:var(--panel); padding:13px 15px;}
.stat-label{font-size:11.5px; color:var(--muted); margin-bottom:5px;}
.stat-val{font-family:'IBM Plex Mono',monospace; font-size:20px; font-weight:500;
  font-variant-numeric:tabular-nums; line-height:1.15;}
.stat-sub{font-size:11.5px; color:var(--muted); margin-top:3px;}
.t-good{color:var(--good);} .t-warn{color:var(--warn);} .t-bad{color:var(--bad);}

.split{display:grid; grid-template-columns:1fr 1fr; gap:16px;}
@media (max-width:820px){ .split{grid-template-columns:1fr;} }
.panel{background:var(--panel); border:1px solid var(--rule); border-radius:4px;
  padding:17px 19px;}
.panel h3{font-size:15px; margin-bottom:7px;}
.panel-lede{font-size:12.5px; color:var(--muted); margin-bottom:15px; max-width:60ch;}
.lede-lock{color:var(--warn);}

.is-bar{display:flex; height:26px; border-radius:3px; overflow:hidden;
  background:var(--ground);}
.is-seg{height:100%;}
.legend{list-style:none; padding:0; margin:13px 0 0; display:flex;
  flex-direction:column; gap:7px;}
.legend li{display:flex; align-items:center; gap:8px; font-size:12.5px;}
.dot{width:9px; height:9px; border-radius:2px; flex-shrink:0;}
.legend-val{margin-left:auto; font-size:12.5px;}
.sub-stats{margin-top:14px; padding-top:12px; border-top:1px solid var(--rule);
  display:flex; flex-direction:column; gap:6px;}
.sub-stats div{display:flex; justify-content:space-between; font-size:12.5px;
  color:var(--muted);}
.sub-stats b{color:var(--ink); font-weight:500;}
.diagnosis{font-size:12.5px; color:var(--ink); margin-top:14px; padding:11px 13px;
  background:var(--ground); border-radius:3px; line-height:1.45;}

.pos-chart{display:flex; flex-direction:column; gap:6px;}
.pos-row{display:flex; align-items:center; gap:10px;}
.pos-num{font-size:12px; color:var(--muted); width:12px;}
.pos-track{flex:1; height:14px; background:var(--ground); border-radius:2px;}
.pos-fill{height:100%; border-radius:2px;}
.pos-val{font-size:11.5px; color:var(--muted); width:52px; text-align:right;}

.tabs-mini{display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap;}
.mini{background:var(--panel); border:1px solid var(--rule); border-radius:3px;
  padding:6px 11px; font-family:inherit; font-size:12.5px; color:var(--muted);
  cursor:pointer;}
.mini:hover{color:var(--ink);}
.mini-on{background:var(--you); border-color:var(--you); color:#fff;}
.mini:focus-visible{outline:2px solid var(--you); outline-offset:2px;}

.hours-chart{display:flex; gap:3px; align-items:flex-end; height:210px;
  background:var(--panel); border:1px solid var(--rule); border-radius:4px;
  padding:14px 14px 6px;}
.hcol{flex:1; display:flex; flex-direction:column; align-items:center; height:100%;}
.hcol-track{flex:1; width:100%; display:flex; align-items:flex-end;}
.hcol-fill{width:100%; background:var(--you); border-radius:2px 2px 0 0;
  transition:height .18s ease;}
.hcol-capped{background:var(--warn);}
.hcol-lab{font-size:10.5px; color:var(--muted); height:15px; padding-top:4px;}
.chart-foot{display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap;
  font-size:11.5px; color:var(--muted); margin:8px 0 22px;}
.warn-text{color:var(--warn);}

.daypart-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(178px,1fr));
  gap:15px;}
.is-locked{opacity:.5;}
.dp-head{display:flex; justify-content:space-between; font-size:12.5px; gap:6px;}
.dp-head .mono{color:var(--muted); font-size:11.5px;}
.dp-foot{display:flex; justify-content:space-between; align-items:baseline; gap:6px;}
.dp-adj{font-size:13px; color:var(--you); font-weight:500;}
.dp-intent{font-size:11px; color:var(--muted);}

.comp-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(252px,1fr));
  gap:15px;}
.comp{background:var(--panel); border:1px solid var(--rule); border-radius:4px;
  padding:15px 16px;}
.comp-off{opacity:.45;}
.comp-head{display:flex; justify-content:space-between; align-items:center; gap:8px;
  margin-bottom:6px;}
.comp-name{font-weight:600; font-size:13.5px;}
.toggle{background:none; border:1px solid var(--rule); border-radius:3px;
  padding:3px 8px; font-family:inherit; font-size:11px; color:var(--muted);
  cursor:pointer;}
.toggle:hover{border-color:var(--you); color:var(--you);}
.toggle:focus-visible{outline:2px solid var(--you); outline-offset:1px;}
.comp-desc{font-size:12px; color:var(--muted); margin-bottom:13px !important;
  line-height:1.4;}
.comp-rank{font-size:11.5px; color:var(--muted); padding-top:10px;
  border-top:1px solid var(--rule);}

@media (prefers-reduced-motion:reduce){ .root *{transition:none !important;} }
      `}</style>

      <header className="masthead">
        <h1>Search auction sandbox</h1>
        <p>
          Every setting on the left feeds a live auction engine. Change one thing and
          watch the consequence propagate through rank, price, share and profit.
        </p>
      </header>

      <div className="shell">
        <aside className="rail">
          <div className="rail-group">
            <h3>Bidding</h3>
            <div className="field">
              <label htmlFor="strat">Strategy</label>
              <select id="strat" value={s.strategy}
                onChange={(e) => set({ strategy: e.target.value })}>
                {Object.entries(STRATEGIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {(s.strategy === "manual") && (
              <Slider label="Max CPC bid" value={s.bid} min={5} max={150}
                onChange={(v) => set({ bid: v })} format={(v) => inr(v)} />
            )}
            {s.strategy === "targetCpa" && (
              <Slider label="Target cost per conversion" value={s.targetCpa}
                min={50} max={2000} step={25}
                onChange={(v) => set({ targetCpa: v })} format={(v) => inr(v)}
                hint="The system bids your target × the conversion rate it expects" />
            )}
            {s.strategy === "targetRoas" && (
              <Slider label="Target return on ad spend" value={s.targetRoas}
                min={1} max={20} step={0.5}
                onChange={(v) => set({ targetRoas: v })} format={(v) => v + "×"}
                hint="Higher targets bid less and win less" />
            )}
            {spendsBudget && (
              <p className="ctl-hint" style={{ marginBottom: 15 }}>
                This strategy sets its own bids to spend the full budget. Your max CPC is
                ignored. Solved bid multiplier: {scale.toFixed(2)}×
              </p>
            )}

            <Slider label="Daily budget" value={s.budget} min={500} max={40000} step={250}
              onChange={(v) => set({ budget: v })} format={(v) => inr(v)} />
          </div>

          <div className="rail-group">
            <h3>Ad quality</h3>
            <div className="qs-readout">
              <span>Quality score</span>
              <span className="qs-num">{qs}</span>
            </div>
            <Slider label="Expected click-through rate" value={s.expCtr} min={1} max={10}
              onChange={(v) => set({ expCtr: v })} />
            <Slider label="Ad relevance" value={s.adRel} min={1} max={10}
              onChange={(v) => set({ adRel: v })} />
            <Slider label="Landing page experience" value={s.lpe} min={1} max={10}
              onChange={(v) => set({ lpe: v })} />
            <label className="check">
              <input type="checkbox" checked={s.extensions}
                onChange={(e) => set({ extensions: e.target.checked })} />
              Sitelinks and callouts enabled
            </label>
          </div>

          <div className="rail-group">
            <h3>Your business</h3>
            <Slider label="Conversion rate" value={s.convRate} min={0.2} max={15} step={0.1}
              onChange={(v) => set({ convRate: v })} format={(v) => v.toFixed(1) + "%"} />
            <Slider label="Average order value" value={s.aov} min={200} max={20000} step={100}
              onChange={(v) => set({ aov: v })} format={(v) => inr(v)} />
            <Slider label="Gross margin" value={s.margin} min={5} max={95}
              onChange={(v) => set({ margin: v })} format={(v) => v + "%"} />
            <Slider label="Daily searches available" value={s.dailyVolume}
              min={500} max={40000} step={500}
              onChange={(v) => set({ dailyVolume: v })} format={num}
              hint="How big this keyword market is" />
          </div>

          <button className="mini" onClick={() => { setS(DEFAULT_SETTINGS); setCompetitors(DEFAULT_COMPETITORS); }}>
            Reset everything
          </button>
        </aside>

        <main>
          <nav className="tabs">
            {[
              ["auction", "Auction"],
              ["day", "Day totals"],
              ["hours", "Dayparting"],
              ["market", "Competitors"],
            ].map(([k, label]) => (
              <button key={k} className={"tab" + (tab === k ? " tab-on" : "")}
                onClick={() => setTab(k)}>{label}</button>
            ))}
          </nav>

          {tab === "auction" && <AuctionView s={s} competitors={competitors} result={result} scale={scale} />}
          {tab === "day" && <DayView s={s} result={result} />}
          {tab === "hours" && <HoursView s={s} set={set} result={result} />}
          {tab === "market" && <MarketView competitors={competitors} setCompetitors={setCompetitors} result={result} />}
        </main>
      </div>
    </div>
  );
}
