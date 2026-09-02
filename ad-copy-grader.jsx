import { useState } from "react";

/* Google's real Responsive Search Ad limits. */
const HEADLINE_MAX = 30;
const DESC_MAX = 90;

/* Reference rival for the CPC illustration, matching the sandbox engine. */
const RIVAL_AD_RANK = 40;
const REF_BID = 45;
const AD_RANK_FLOOR = 6;

const DEFAULT_BUSINESS =
  "Kaapi Club — a Delhi-based specialty coffee subscription. Single-origin Indian beans from Chikmagalur and Coorg, roasted to order, delivered every two weeks. From ₹649/month. Free delivery in Delhi NCR, pause or cancel anytime.";

const DEFAULT_QUERIES = `specialty coffee subscription delhi
monthly coffee delivery india
single origin coffee beans online
best coffee subscription box india
fresh roasted coffee delivered
chikmagalur coffee beans buy online
coffee subscription price
arabica beans delivery ncr`;

const DEFAULT_HEADLINES = ["Best Coffee Online", "Shop Now", "Great Prices"];
const DEFAULT_DESCRIPTIONS = [
  "We have the best coffee products for all your needs. Order today!",
  "Quality you can trust. Fast shipping available.",
];
const DEFAULT_LANDING =
  "Homepage with a rotating banner, links to all product categories including tea and mugs, and a newsletter popup on load. No pricing shown above the fold.";

const SYSTEM_PROMPT = `You are a Google Ads quality evaluator. You grade search ad copy the way Google's ad auction actually grades it, and you are a harsh but fair marker.

Score three components from 1 to 10:

1. expectedCtr — will people click this rather than a competitor's ad? Reward specificity, numbers, prices, differentiators, and a clear reason to click. Punish generic filler ("Shop Now", "Best Prices", "Quality You Can Trust") which carries no information.
2. adRelevance — does the copy echo the intent and vocabulary of the target queries? Reward copy that mirrors the searcher's actual words and covers the query themes. Punish copy that could belong to any business in any category.
3. landingPage — is the destination relevant, transparent, and easy to act on? Reward a page matching the ad's promise, visible pricing, a clear next step. Punish generic homepages, hidden pricing, popups, and mismatch with the ad.

Calibration anchors, apply them strictly:
1-3 = generic filler, could be any advertiser, no specific information
4-6 = adequate but unremarkable, some specificity, missing obvious opportunities
7-8 = strong, specific, clearly matched to the queries
9-10 = exceptional, hard to improve, every element earning its space

Most real ad copy scores 4-6. Do not inflate. A score of 8+ must be earned.

Reply with ONLY a JSON object, no preamble and no markdown fences:
{
  "expectedCtr": { "score": 0, "reason": "one or two sentences" },
  "adRelevance": { "score": 0, "reason": "one or two sentences" },
  "landingPage": { "score": 0, "reason": "one or two sentences" },
  "biggestProblem": "the single most costly weakness, one sentence",
  "rewrites": [
    { "original": "the weak line", "better": "your replacement, respecting the character limit", "why": "one short sentence" }
  ]
}

Give exactly 2 rewrites. Headlines must be 30 characters or fewer, descriptions 90 or fewer.`;

function buildUserPrompt(s) {
  const queries = s.queries.split("\n").map((q) => q.trim()).filter(Boolean);
  return `BUSINESS
${s.business}

TARGET SEARCH QUERIES
${queries.map((q) => "- " + q).join("\n")}

AD HEADLINES (30 char limit each)
${s.headlines.filter(Boolean).map((h, i) => `${i + 1}. ${h}`).join("\n")}

AD DESCRIPTIONS (90 char limit each)
${s.descriptions.filter(Boolean).map((d, i) => `${i + 1}. ${d}`).join("\n")}

LANDING PAGE
${s.landing}

Grade this ad.`;
}

const qualityScore = (a, b, c) =>
  Math.min(10, Math.max(1, Math.round(0.5 * a + 0.3 * b + 0.2 * c)));

const cpcAt = (qs) => Math.min(REF_BID, RIVAL_AD_RANK / qs + 0.01);
const inr = (v, d = 2) =>
  "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

function Counter({ value, max }) {
  const over = value.length > max;
  return (
    <span className={"count mono" + (over ? " count-over" : "")}>
      {value.length}/{max}
    </span>
  );
}

function ScoreBar({ label, score, reason, weight }) {
  return (
    <div className="score">
      <div className="score-head">
        <span className="score-label">{label}</span>
        <span className="score-weight mono">{weight}</span>
        <span className="score-num mono">{score}</span>
      </div>
      <div className="score-track">
        <div className="score-fill" style={{ width: score * 10 + "%" }} />
      </div>
      <p className="score-reason">{reason}</p>
    </div>
  );
}

export default function AdCopyGrader() {
  const [s, setS] = useState({
    business: DEFAULT_BUSINESS,
    queries: DEFAULT_QUERIES,
    headlines: DEFAULT_HEADLINES,
    descriptions: DEFAULT_DESCRIPTIONS,
    landing: DEFAULT_LANDING,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const setAt = (key, i, v) => {
    const next = [...s[key]];
    next[i] = v;
    set({ [key]: next });
  };

  const overLimit =
    s.headlines.some((h) => h.length > HEADLINE_MAX) ||
    s.descriptions.some((d) => d.length > DESC_MAX);
  const empty = !s.headlines.some(Boolean) || !s.descriptions.some(Boolean);

  async function grade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(s) }],
        }),
      });
      const data = await res.json();
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);

      // The model occasionally returns a shape we did not ask for. Check it
      // here rather than letting the render crash on a missing field.
      const band = (x) =>
        x && typeof x.score === "number" && x.score >= 1 && x.score <= 10;
      if (!band(parsed.expectedCtr) || !band(parsed.adRelevance) || !band(parsed.landingPage)) {
        throw new Error("shape");
      }
      parsed.rewrites = Array.isArray(parsed.rewrites) ? parsed.rewrites : [];
      parsed.biggestProblem = parsed.biggestProblem || "No single problem identified.";

      setResult(parsed);
    } catch (e) {
      setError("The grader could not be reached, or returned something unparseable. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const qs = result
    ? qualityScore(result.expectedCtr.score, result.adRelevance.score, result.landingPage.score)
    : null;

  return (
    <div className="root">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
.root{--ground:#E9ECEF;--panel:#FFF;--ink:#14181D;--muted:#6B7480;--rule:#D2D8DE;
  --you:#1B44C8;--warn:#B26B00;--good:#0E7A5F;--bad:#A32B1C;
  font-family:'IBM Plex Sans',system-ui,sans-serif;background:var(--ground);
  color:var(--ink);min-height:100vh;font-size:14px;line-height:1.5;}
.root *{box-sizing:border-box;}
.mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.root h1,.root h2,.root h3{margin:0;font-weight:600;letter-spacing:-0.01em;}
.root p{margin:0;}
.masthead{padding:22px 26px 18px;border-bottom:1px solid var(--rule);background:var(--panel);}
.masthead h1{font-size:20px;}
.masthead p{color:var(--muted);margin-top:5px;max-width:66ch;}
.shell{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);
  align-items:start;}
@media (max-width:880px){.shell{grid-template-columns:1fr;}}
.col{background:var(--ground);padding:22px 24px 48px;}
.group{margin-bottom:20px;}
.group > h3{font-size:12px;font-weight:600;color:var(--muted);padding-bottom:7px;
  border-bottom:1px solid var(--rule);margin-bottom:12px;}
.f{margin-bottom:12px;}
.f-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;
  margin-bottom:4px;}
.f-head label{font-size:12.5px;color:var(--muted);}
.count{font-size:11.5px;color:var(--muted);}
.count-over{color:var(--bad);font-weight:500;}
.root input[type=text],.root textarea{width:100%;padding:8px 9px;border:1px solid var(--rule);
  border-radius:3px;background:var(--panel);font-family:inherit;font-size:13px;
  color:var(--ink);resize:vertical;line-height:1.5;}
.root textarea{min-height:64px;}
.root input:focus-visible,.root textarea:focus-visible{outline:2px solid var(--you);
  outline-offset:1px;}
.over input{border-color:var(--bad);}
.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.4;}
.btn{background:var(--you);color:#fff;border:none;border-radius:3px;padding:10px 18px;
  font-family:inherit;font-size:13.5px;font-weight:500;cursor:pointer;}
.btn:disabled{background:var(--muted);cursor:not-allowed;}
.btn:focus-visible{outline:2px solid var(--you);outline-offset:2px;}
.btn-ghost{background:none;border:1px solid var(--rule);color:var(--muted);
  border-radius:3px;padding:6px 11px;font-family:inherit;font-size:12px;cursor:pointer;}
.btn-ghost:hover{color:var(--ink);border-color:var(--you);}
.btn-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:4px;}
.empty{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  padding:26px 22px;color:var(--muted);font-size:13px;max-width:52ch;}
.err{background:#FBEDEB;border:1px solid var(--bad);border-radius:3px;padding:11px 13px;
  color:var(--bad);font-size:12.5px;margin-bottom:14px;}
.qs-panel{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  padding:17px 19px;margin-bottom:16px;}
.qs-top{display:flex;align-items:center;gap:16px;margin-bottom:14px;}
.qs-big{font-family:'IBM Plex Mono',monospace;font-size:44px;font-weight:500;
  color:var(--you);line-height:1;}
.qs-cap{font-size:12.5px;color:var(--muted);}
.qs-cap b{display:block;color:var(--ink);font-size:14px;font-weight:600;margin-bottom:2px;}
.impact{border-top:1px solid var(--rule);padding-top:13px;font-size:12.5px;
  color:var(--muted);}
.impact-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;}
.impact-row b{color:var(--ink);font-weight:500;}
.impact-note{margin-top:9px;padding:10px 12px;background:var(--ground);border-radius:3px;
  color:var(--ink);line-height:1.45;}
.score{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  padding:14px 16px;margin-bottom:10px;}
.score-head{display:flex;align-items:baseline;gap:9px;margin-bottom:7px;}
.score-label{font-size:13.5px;font-weight:500;}
.score-weight{font-size:11px;color:var(--muted);}
.score-num{margin-left:auto;font-size:19px;font-weight:500;color:var(--you);}
.score-track{height:6px;background:var(--ground);border-radius:2px;}
.score-fill{height:100%;background:var(--you);border-radius:2px;}
.score-reason{font-size:12.5px;color:var(--muted);margin-top:8px !important;
  line-height:1.5;}
.prob{background:var(--panel);border:1px solid var(--rule);border-left:3px solid var(--warn);
  border-radius:0;padding:13px 15px;margin-bottom:16px;}
.prob h3{font-size:12px;color:var(--warn);margin-bottom:5px;}
.prob p{font-size:13px;line-height:1.5;}
.rw{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  padding:13px 15px;margin-bottom:10px;}
.rw-old{font-size:12.5px;color:var(--muted);text-decoration:line-through;
  margin-bottom:5px !important;}
.rw-new{font-size:13.5px;font-weight:500;color:var(--good);margin-bottom:6px !important;}
.rw-why{font-size:12px;color:var(--muted);}
.prompt-box{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  padding:13px 15px;margin-top:12px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;
  color:var(--muted);white-space:pre-wrap;line-height:1.55;max-height:340px;
  overflow-y:auto;}
      `}</style>

      <header className="masthead">
        <h1>Ad copy grader</h1>
        <p>
          Claude reads your ad against the queries you are targeting and returns the three
          components that make up Quality Score. This is the piece that replaces the fake
          sliders in the sandbox.
        </p>
      </header>

      <div className="shell">
        <div className="col">
          <div className="group">
            <h3>Context</h3>
            <div className="f">
              <div className="f-head"><label>What you sell</label></div>
              <textarea value={s.business} onChange={(e) => set({ business: e.target.value })} />
            </div>
            <div className="f">
              <div className="f-head"><label>Target search queries, one per line</label></div>
              <textarea style={{ minHeight: 130 }} value={s.queries}
                onChange={(e) => set({ queries: e.target.value })} />
              <p className="hint">
                Relevance is judged against these. In the full sim these come from the
                query engine rather than being typed by hand.
              </p>
            </div>
          </div>

          <div className="group">
            <h3>Headlines</h3>
            {s.headlines.map((h, i) => (
              <div className={"f" + (h.length > HEADLINE_MAX ? " over" : "")} key={i}>
                <div className="f-head">
                  <label>Headline {i + 1}</label>
                  <Counter value={h} max={HEADLINE_MAX} />
                </div>
                <input type="text" value={h} onChange={(e) => setAt("headlines", i, e.target.value)} />
              </div>
            ))}
            <p className="hint">
              Google caps headlines at 30 characters. That constraint is most of the
              difficulty, and it is why vague filler is so tempting.
            </p>
          </div>

          <div className="group">
            <h3>Descriptions</h3>
            {s.descriptions.map((d, i) => (
              <div className={"f" + (d.length > DESC_MAX ? " over" : "")} key={i}>
                <div className="f-head">
                  <label>Description {i + 1}</label>
                  <Counter value={d} max={DESC_MAX} />
                </div>
                <input type="text" value={d} onChange={(e) => setAt("descriptions", i, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="group">
            <h3>Landing page</h3>
            <div className="f">
              <div className="f-head"><label>Describe where the click goes</label></div>
              <textarea value={s.landing} onChange={(e) => set({ landing: e.target.value })} />
            </div>
          </div>

          <div className="btn-row">
            <button className="btn" onClick={grade} disabled={loading || overLimit || empty}>
              {loading ? "Grading…" : "Grade this ad"}
            </button>
            <button className="btn-ghost" onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? "Hide prompt" : "Inspect the prompt"}
            </button>
          </div>
          {overLimit && <p className="hint" style={{ color: "var(--bad)" }}>
            Something is over the character limit. Google would reject this ad.
          </p>}

          {showPrompt && (
            <div className="prompt-box">{SYSTEM_PROMPT + "\n\n─── user message ───\n\n" + buildUserPrompt(s)}</div>
          )}
        </div>

        <div className="col">
          {error && <div className="err">{error}</div>}

          {!result && !loading && (
            <div className="empty">
              The prefilled copy is deliberately weak — generic headlines, a homepage with
              no pricing. Grade it as-is first to check the marker is honest, then rewrite
              and grade again to see what moves.
            </div>
          )}

          {loading && <div className="empty">Reading your ad against the query set…</div>}

          {result && (
            <>
              <div className="qs-panel">
                <div className="qs-top">
                  <span className="qs-big">{qs}</span>
                  <span className="qs-cap">
                    <b>Quality score</b>
                    0.5 × expected CTR + 0.3 × relevance + 0.2 × landing page
                  </span>
                </div>
                <div className="impact">
                  <div className="impact-row">
                    <span>Ad rank at a {inr(REF_BID, 0)} bid</span>
                    <b className="mono">{(REF_BID * qs).toFixed(0)}</b>
                  </div>
                  <div className="impact-row">
                    <span>Price per click against a rival at rank {RIVAL_AD_RANK}</span>
                    <b className="mono">{inr(cpcAt(qs))}</b>
                  </div>
                  <div className="impact-row">
                    <span>Same bid, same rival, at quality 10</span>
                    <b className="mono">{inr(cpcAt(10))}</b>
                  </div>
                  <p className="impact-note">
                    {qs >= 8
                      ? "Strong. You are reaching this position more cheaply than a competitor bidding higher with weaker copy."
                      : qs >= 5
                      ? `Middling. Getting to quality 10 would cut your cost per click by ${(
                          (1 - cpcAt(10) / cpcAt(qs)) * 100
                        ).toFixed(0)}% without touching your bid.`
                      : `Weak. At ${inr(REF_BID, 0)} your ad rank is ${(REF_BID * qs).toFixed(
                          0
                        )}, and you are paying ${inr(cpcAt(qs))} for positions a better ad would get for ${inr(cpcAt(9))}.`}
                  </p>
                </div>
              </div>

              <ScoreBar label="Expected click-through rate" weight="50% of score"
                score={result.expectedCtr.score} reason={result.expectedCtr.reason} />
              <ScoreBar label="Ad relevance" weight="30% of score"
                score={result.adRelevance.score} reason={result.adRelevance.reason} />
              <ScoreBar label="Landing page experience" weight="20% of score"
                score={result.landingPage.score} reason={result.landingPage.reason} />

              <div className="prob">
                <h3>Biggest problem</h3>
                <p>{result.biggestProblem}</p>
              </div>

              {result.rewrites?.map((r, i) => (
                <div className="rw" key={i}>
                  <p className="rw-old">{r.original}</p>
                  <p className="rw-new">{r.better}</p>
                  <p className="rw-why">{r.why}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
