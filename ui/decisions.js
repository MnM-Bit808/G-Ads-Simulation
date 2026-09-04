/**
 * The decision form (build step 14, slice three) — what the player changes
 * between weeks, which is the whole game.
 *
 * THE TRAP THIS MODULE IS SHAPED AROUND
 *
 * A player decision must be RETURNED from a controller, never written into
 * state. `submitRound` is what applies structural changes, writes the learning
 * period 12.3 asks for, and appends to `decisionLog` for 12.4's replay.
 * Reaching into `game.state.advertisers[0]` and editing a bid there produces a
 * game that runs, looks right, and silently has three mechanics missing.
 *
 * So the form never sees an advertiser. It is built from `getSelfView`, which
 * deep-copies on the way out — the form physically cannot write through into
 * `GameState` — and it hands back a decision object that goes in by the same
 * door a policy uses. There is no privileged player path (R6).
 *
 * WHAT IT MAY AND MAY NOT KNOW
 *
 * The preview reads the PUBLIC query list (16.1: id, text, volume, intent) and
 * the player's own search terms report. It never reads a query's tags, and it
 * therefore cannot tell the player how far a broad keyword will travel — which
 * is correct rather than a limitation. 8.2 is explicit that you discover what
 * broad match dragged you into *after the fact*, from the report, and blocking
 * it means naming its literal words.
 *
 * Every string operation here is the engine's own (`blockedBy`, `normalise`).
 * A preview that reimplemented the matcher would agree with it right up until
 * one of them changed, which is exactly how the v0.1 prototypes went wrong.
 */

import { el, add, table, field, input, select, rupees, whole } from './dom.js';
import { blockedBy, normalise, tokenise } from '../engine/matching.js';
import { tagKeywordOffline, tagContentHashOf } from '../agents/keywordTagger.js';

/** The three string negatives of 8.2, and no fourth. Tags never appear (H3). */
export const NEGATIVE_TYPES = ['broad', 'phrase', 'exact'];
const MATCH_TYPES = ['exact', 'phrase', 'broad'];

const NEGATIVE_HELP = {
  broad: 'blocks any search containing all these words, in any order',
  phrase: 'blocks any search containing these words in this order',
  exact: 'blocks only this search, word for word',
};

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/**
 * A working copy of the account, and the untouched original to diff against.
 *
 * @param {object} selfView output of `getSelfView` — never an advertiser record
 * @returns {object} draft
 */
export function createDraft(selfView) {
  // Cloned again although getSelfView already cloned. Cheap, and it means this
  // function is safe whatever a future caller hands it.
  const adGroups = structuredClone(selfView.adGroups ?? []);
  const negatives = structuredClone(selfView.campaign?.negatives ?? []);
  const keywords = structuredClone(adGroups[0]?.keywords ?? []);

  return {
    adGroups,
    negatives,
    keywords,
    base: {
      negatives: structuredClone(negatives),
      keywords: structuredClone(keywords),
    },
  };
}

/**
 * The decision to submit, or null when nothing changed.
 *
 * Only what moved is returned. An untouched form is indistinguishable from the
 * `() => null` controller the player had before this slice existed, so opening
 * the form and closing it does not write a decision into the log.
 *
 * `runRound` merges `campaign` shallowly and REPLACES `adGroups` wholesale, so
 * the ad and its grade are carried through untouched rather than omitted.
 *
 * @param {object} draft
 * @returns {object|null} `{ campaign?, adGroups? }`
 */
export function toDecision(draft) {
  const decision = {};

  if (!sameNegatives(draft.negatives, draft.base.negatives)) {
    decision.campaign = { negatives: structuredClone(draft.negatives) };
  }
  if (!sameKeywords(draft.keywords, draft.base.keywords)) {
    decision.adGroups = structuredClone(draft.adGroups).map((group, i) => (
      i === 0 ? { ...group, keywords: structuredClone(draft.keywords) } : group
    ));
  }
  return Object.keys(decision).length > 0 ? decision : null;
}

/**
 * Everything this draft would change, each with a way to take it back.
 *
 * This is what the player reads before committing. A form that hides a
 * consequence it could show is being cruel rather than honest.
 *
 * @param {object} draft
 * @returns {Array<{kind: string, label: string, detail: string, undo: Function}>}
 */
export function changes(draft) {
  const rows = [];

  for (const negative of draft.negatives) {
    if (findNegative(draft.base.negatives, negative) === -1) {
      rows.push({
        kind: 'negative-added',
        label: `Block “${negative.text}”`,
        detail: `${negative.matchType} negative — ${NEGATIVE_HELP[negative.matchType]}`,
        undo: () => dropNegative(draft, findNegative(draft.negatives, negative)),
      });
    }
  }
  draft.base.negatives.forEach((negative, index) => {
    if (findNegative(draft.negatives, negative) === -1) {
      rows.push({
        kind: 'negative-removed',
        label: `Stop blocking “${negative.text}”`,
        detail: `the ${negative.matchType} negative comes off`,
        undo: () => { draft.negatives.splice(index, 0, structuredClone(negative)); },
      });
    }
  });

  for (const keyword of draft.keywords) {
    const before = draft.base.keywords.find((k) => k.id === keyword.id);
    if (!before) {
      rows.push({
        kind: 'keyword-added',
        label: `Add “${keyword.text}”`,
        detail: `${keyword.matchType} match at ${rupees(keyword.bidPaise)}`
          + (keyword.tags.length === 0 ? ' — no tags, so broad will find nothing' : ''),
        undo: () => {
          draft.keywords.splice(draft.keywords.findIndex((k) => k.id === keyword.id), 1);
        },
      });
      continue;
    }
    if (keyword.matchType !== before.matchType) {
      rows.push({
        kind: 'keyword-match',
        label: `“${keyword.text}” → ${keyword.matchType} match`,
        detail: keyword.matchType === 'broad' && before.matchType !== 'broad'
          ? `was ${before.matchType}. Impressions rise and impression share falls`
          : `was ${before.matchType}`,
        undo: () => updateKeyword(draft, keyword.id, { matchType: before.matchType }),
      });
    }
    if (keyword.bidPaise !== before.bidPaise) {
      rows.push({
        kind: 'keyword-bid',
        label: `“${keyword.text}” bid ${rupees(before.bidPaise)} → ${rupees(keyword.bidPaise)}`,
        detail: keyword.bidPaise > before.bidPaise
          ? 'a higher bid buys rank, not a lower price'
          : 'a lower bid gives up rank before it saves money',
        undo: () => updateKeyword(draft, keyword.id, { bidPaise: before.bidPaise }),
      });
    }
    if ((keyword.active !== false) !== (before.active !== false)) {
      const paused = keyword.active === false;
      rows.push({
        kind: paused ? 'keyword-paused' : 'keyword-resumed',
        label: `${paused ? 'Pause' : 'Resume'} “${keyword.text}”`,
        detail: paused
          ? 'it stops entering auctions; its history stays'
          : 'it starts entering auctions again',
        undo: () => updateKeyword(draft, keyword.id, { active: before.active !== false }),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Negatives (8.2)
// ---------------------------------------------------------------------------

/**
 * Stage a negative. String types only — negatives never touch the tag layer.
 *
 * @param {object} draft
 * @param {{text: string, matchType: string}} negative
 * @returns {{added: boolean, reason?: string}}
 */
export function addNegative(draft, { text, matchType } = {}) {
  if (!NEGATIVE_TYPES.includes(matchType)) {
    return { added: false, reason: 'a negative is broad, phrase or exact' };
  }
  const clean = String(text ?? '').trim();
  // Tokenised with the engine's own normaliser: "!!!" carries no words, and a
  // negative with no words would block nothing while looking like it works.
  if (tokenise(clean).length === 0) {
    return { added: false, reason: 'a negative needs at least one word' };
  }
  if (findNegative(draft.negatives, { text: clean, matchType }) !== -1) {
    return { added: false, reason: 'you are already blocking that' };
  }
  draft.negatives.push({ text: clean, matchType });
  return { added: true };
}

/** @param {object} draft @param {number} index */
export function dropNegative(draft, index) {
  if (index < 0 || index >= draft.negatives.length) return { dropped: false };
  draft.negatives.splice(index, 1);
  return { dropped: true };
}

/**
 * Which of the draft's negatives, if any, kills this search term.
 *
 * Used to grey the row out the moment a negative is staged, so the cost of a
 * broad negative is visible in the report it was written from rather than
 * discovered next week.
 *
 * @param {object} draft
 * @param {string} text
 * @returns {object|null}
 */
export function blocksTerm(draft, text) {
  return blockedBy({ text }, draft.negatives);
}

/**
 * What a negative would do, before it is committed.
 *
 * Split into searches you have paid for and searches you have not, because
 * those are two different arguments: the first is money you would stop
 * spending, the second is reach you would give up sight unseen.
 *
 * @param {{text: string, matchType: string}} negative
 * @param {{queries: Array<{id: string, text: string, volumeShareBp: number}>,
 *          terms: Object<string, {clicks: number, costPaise: number, conversions: number}>}} context
 * @returns {object}
 */
export function previewNegative(negative, { queries, terms }) {
  const empty = {
    blocked: [], spent: [], unspent: [],
    totals: { clicks: 0, costPaise: 0, conversions: 0 },
    costsConversions: false,
  };
  if (!NEGATIVE_TYPES.includes(negative?.matchType)) return empty;
  if (tokenise(negative.text ?? '').length === 0) return empty;

  const blocked = [];
  const spent = [];
  const unspent = [];
  const totals = { clicks: 0, costPaise: 0, conversions: 0 };

  for (const query of queries) {
    // The engine's matcher, not a copy of its rules.
    if (!blockedBy({ text: query.text }, [negative])) continue;
    const stats = terms?.[query.id];
    const row = {
      id: query.id,
      text: query.text,
      volumeShareBp: query.volumeShareBp,
      clicks: stats?.clicks ?? 0,
      costPaise: stats?.costPaise ?? 0,
      conversions: stats?.conversions ?? 0,
    };
    blocked.push(row);
    if (stats && (stats.impressions > 0 || stats.clicks > 0)) {
      spent.push(row);
      totals.clicks += row.clicks;
      totals.costPaise += row.costPaise;
      totals.conversions += row.conversions;
    } else {
      unspent.push(row);
    }
  }

  spent.sort((a, b) => b.costPaise - a.costPaise);
  unspent.sort((a, b) => b.volumeShareBp - a.volumeShareBp);
  return { blocked, spent, unspent, totals, costsConversions: totals.conversions > 0 };
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

/**
 * Add a keyword, tagged as it is typed.
 *
 * The tagger runs offline and synchronously (8.4), so a keyword written here
 * is usable on broad immediately — except when the heuristic finds nothing in
 * the vocabulary to hang it on, which is reported rather than hidden. An
 * untagged keyword matches nothing on broad, and a player who is not told that
 * sees a keyword that simply does not work.
 *
 * @param {object} draft
 * @param {{text: string, matchType: string, bidPaise: number}} spec
 * @returns {{ok: boolean, reason?: string, keyword?: object, inertOnBroad?: boolean}}
 */
export function addKeyword(draft, { text, matchType = 'phrase', bidPaise } = {}) {
  const clean = String(text ?? '').trim();
  if (tokenise(clean).length === 0) return { ok: false, reason: 'a keyword needs at least one word' };
  if (!MATCH_TYPES.includes(matchType)) return { ok: false, reason: 'unknown match type' };
  if (!isPaise(bidPaise)) return { ok: false, reason: 'a bid is a whole number of paise above zero' };
  if (draft.keywords.some((k) => normalise(k.text) === normalise(clean))) {
    return { ok: false, reason: 'that keyword is already in the account' };
  }

  const { tags, taggedContentHash } = tagKeywordOffline({ text: clean });
  const keyword = {
    id: freshId(clean, draft.keywords),
    text: clean,
    matchType,
    bidPaise,
    active: true,
    tags,
    taggedContentHash,
  };
  draft.keywords.push(keyword);
  return { ok: true, keyword, inertOnBroad: tags.length === 0 };
}

/**
 * Change a keyword's bid, match type or paused state.
 *
 * None of the three triggers a learning period (12.3) — the bid model has
 * nothing to re-estimate. Rejecting a bad value rather than coercing it: a
 * silently coerced bid is a bid the player did not make.
 *
 * @param {object} draft
 * @param {string} id
 * @param {{bidPaise?: number, matchType?: string, active?: boolean}} patch
 * @returns {{ok: boolean, reason?: string}}
 */
export function updateKeyword(draft, id, patch = {}) {
  const keyword = draft.keywords.find((k) => k.id === id);
  if (!keyword) return { ok: false, reason: 'no such keyword' };

  if ('bidPaise' in patch && !isPaise(patch.bidPaise)) {
    return { ok: false, reason: 'a bid is a whole number of paise above zero' };
  }
  if ('matchType' in patch && !MATCH_TYPES.includes(patch.matchType)) {
    return { ok: false, reason: 'unknown match type' };
  }
  if ('active' in patch && typeof patch.active !== 'boolean') {
    return { ok: false, reason: 'active is a boolean' };
  }

  Object.assign(keyword, patch);
  return { ok: true, keyword };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** R7: money is an integer number of paise, and a bid of nothing is not a bid. */
const isPaise = (value) => Number.isSafeInteger(value) && value > 0;

const negativeKey = (n) => `${n.matchType}::${normalise(n.text)}`;
const findNegative = (list, negative) => list.findIndex((n) => negativeKey(n) === negativeKey(negative));

const sameNegatives = (a, b) => a.length === b.length
  && a.every((n, i) => negativeKey(n) === negativeKey(b[i]));

const keywordKey = (k) => `${k.id}|${k.text}|${k.matchType}|${k.bidPaise}|${k.active !== false}`;
const sameKeywords = (a, b) => a.length === b.length
  && a.every((k, i) => keywordKey(k) === keywordKey(b[i]));

/**
 * An id derived from the keyword's own text.
 *
 * `qualityHistory` is keyed by keyword id, so a recycled id would hand a brand
 * new keyword somebody else's impressions and the `reportedScore` built from
 * them. Deriving from the text also means re-adding a keyword you removed
 * picks its own history back up, which is what a real account does.
 */
function freshId(text, keywords) {
  const base = `kw_${tagContentHashOf({ text }).replace('h53:', '')}`;
  let id = base;
  for (let n = 2; keywords.some((k) => k.id === id); n++) id = `${base}_${n}`;
  return id;
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/**
 * Draw the decision form: what is staged, the negatives, and the keywords.
 *
 * @param {object} ctx
 * @param {object} ctx.draft
 * @param {Array} ctx.queries public query list (16.1) — text, volume, intent
 * @param {number} ctx.weeklyVolume
 * @param {object} ctx.terms search terms report rows, keyed by query id
 * @param {object} ctx.byKeyword per-keyword rows from the same range
 * @param {object} ctx.quality this advertiser's own reportedScores
 * @param {Function} [ctx.sync] re-read the report figures before drawing
 * @param {Function} ctx.onChange called after anything is staged, so the rest
 *   of the dashboard can catch up. `ctx.refresh` is written back for callers
 *   that stage a change from outside this region — the search terms table does.
 * @returns {HTMLElement}
 */
export function renderDecisions(ctx) {
  // `display: contents`, so the cards below take part in the dashboard grid
  // rather than being boxed inside a wrapper of their own.
  const region = el('div', 'decision-region');
  const summary = el('div', 'decision-summary');
  const forms = el('div', 'decision-forms');
  region.append(summary, forms);

  const drawSummary = () => summary.replaceChildren(...summaryCard(ctx));
  const drawAll = () => {
    drawSummary();
    forms.replaceChildren(negativesCard(ctx, refresh), keywordsCard(ctx, refresh));
  };

  function refresh({ summaryOnly = false } = {}) {
    // Before drawing, not after: the caller may have changed which rounds the
    // report covers, and the previews below read those figures.
    ctx.sync?.();
    if (summaryOnly) drawSummary();
    else drawAll();
    ctx.onChange?.();
  }

  ctx.refresh = refresh;
  drawAll();
  return region;
}

const card = (title, subtitle, span = 'span-4') => {
  const node = el('article', `card ${span}`);
  const heading = el('h2', null, title);
  if (subtitle) heading.append(el('span', 'muted', subtitle));
  node.append(heading);
  return node;
};

/** What will be committed when the week is run. Absent when nothing is staged. */
function summaryCard(ctx) {
  const rows = changes(ctx.draft);
  if (rows.length === 0) return [];

  const node = card('Next week', `${rows.length} change${rows.length === 1 ? '' : 's'}, not yet committed`);
  const list = el('div', 'staged');
  for (const row of rows) {
    const item = el('div', `staged-row ${row.kind}`);
    const body = el('div');
    body.append(el('div', 'staged-label', row.label));
    body.append(el('div', 'staged-detail', row.detail));
    const undo = el('button', 'add');
    undo.type = 'button';
    undo.textContent = 'undo';
    undo.addEventListener('click', () => { row.undo(); ctx.refresh(); });
    item.append(body, undo);
    list.append(item);
  }
  node.append(list);
  node.append(el('p', 'note',
    'Nothing here has happened yet. It is applied when you run the week, and '
    + 'the result arrives a week later — later still for anything that depends '
    + 'on conversions.'));
  return [node];
}

// --- negatives -------------------------------------------------------------

function negativesCard(ctx, refresh) {
  const node = card('Negatives', 'written from the report above, and only from it');
  const draft = ctx.draft;

  if (draft.negatives.length > 0) {
    const list = el('table', 'mini');
    table(list, ['Blocked', 'Type', { label: 'Searches it blocks', num: true }, ''],
      draft.negatives.map((negative, index) => {
        const preview = previewNegative(negative, { queries: ctx.queries, terms: ctx.terms });
        const remove = el('button', 'add');
        remove.type = 'button';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => { dropNegative(draft, index); refresh(); });
        return { cells: [negative.text, negative.matchType, whole(preview.blocked.length), remove] };
      }));
    node.append(list);
  } else {
    node.append(el('p', 'muted',
      'Nothing blocked. Use the block button on a search term above, or write '
      + 'one here to catch a whole family of them at once.'));
  }

  // The composer. Its preview updates on every keystroke; the rest of the card
  // does not, or the box would lose focus as you typed into it.
  const composing = { text: '', matchType: 'broad' };
  const preview = el('div', 'neg-preview');
  const drawPreview = () => preview.replaceChildren(...previewBody(composing, ctx));

  const row = el('div', 'neg-compose');
  const text = input({
    placeholder: 'free, near me, how to…',
    onInput: (value) => { composing.text = value; drawPreview(); },
  });
  const type = select({
    options: NEGATIVE_TYPES.map((t) => [t, t]),
    value: composing.matchType,
    onChange: (value) => { composing.matchType = value; drawPreview(); },
  });
  const go = el('button', 'add');
  go.type = 'button';
  go.textContent = 'block it';
  go.addEventListener('click', () => {
    const result = addNegative(draft, composing);
    if (result.added) refresh();
    else {
      preview.replaceChildren(el('p', 'problems', result.reason));
    }
  });

  add(row,
    field('Words to block', text, NEGATIVE_HELP[composing.matchType]),
    field('Type', type),
    go);
  node.append(row, preview);

  node.append(el('p', 'note',
    'A negative matches the words themselves — no synonyms, no close variants, '
    + 'no plurals. That is why you can be dragged into a search by meaning and '
    + 'can only get out of it by naming what it literally said.'));
  return node;
}

/** The consequence, shown before the button is pressed rather than after. */
function previewBody(negative, ctx) {
  if (tokenise(negative.text ?? '').length === 0) return [];
  const preview = previewNegative(negative, { queries: ctx.queries, terms: ctx.terms });

  if (preview.blocked.length === 0) {
    return [el('p', 'muted', `Nothing in the market matches “${negative.text}” on ${negative.matchType}.`)];
  }

  const out = [];
  const headline = el('p', 'neg-headline');
  headline.append(el('strong', null, `${preview.blocked.length} searches`));
  headline.append(document.createTextNode(
    preview.spent.length > 0
      ? ` blocked, ${preview.spent.length} of which you have bought: `
        + `${rupees(preview.totals.costPaise)} and `
        + `${preview.totals.conversions.toFixed(1)} conversions.`
      : ' blocked. You have bought none of them yet.',
  ));
  out.push(headline);

  if (preview.costsConversions) {
    out.push(el('p', 'problems',
      'This would also block searches that converted for you. A negative does '
      + 'not know what you meant by it — it blocks every search carrying those '
      + 'words.'));
  } else if (preview.unspent.length > 0) {
    // The softer half of the same warning. A negative is not only a refund on
    // what you have wasted; it also closes searches you have never run, and
    // you will never find out what they would have done. Read the list.
    out.push(el('p', 'note',
      `${preview.unspent.length} of these you have never bought. Blocking them `
      + 'closes them for good — read the words and decide whether every one of '
      + 'them really is somebody else\'s customer.'));
  }

  const list = el('table', 'mini');
  table(list,
    ['Search it would block', { label: 'Your cost', num: true }, { label: 'Your conv', num: true }],
    [...preview.spent, ...preview.unspent].slice(0, 12).map((row) => ({
      className: row.conversions > 0 ? 'costly' : null,
      cells: [
        row.text,
        row.clicks > 0 ? rupees(row.costPaise) : '—',
        row.conversions > 0 ? row.conversions.toFixed(1) : '—',
      ],
    })));
  out.push(list);
  return out;
}

// --- keywords --------------------------------------------------------------

function keywordsCard(ctx, refresh) {
  const node = card('Keywords', 'what you bid on, and how loosely it matches');
  const draft = ctx.draft;

  const rows = draft.keywords.map((keyword) => {
    const stats = ctx.byKeyword?.[keyword.id];
    const score = ctx.quality?.[keyword.id];
    const paused = keyword.active === false;

    const label = el('div', paused ? 'kw-text paused' : 'kw-text');
    label.append(el('div', null, keyword.text));
    const tags = el('div', 'tag-row');
    if (keyword.tags.length === 0) {
      tags.append(el('span', 'tag warn', 'no tags — broad finds nothing'));
    } else {
      for (const tag of keyword.tags.slice(0, 5)) tags.append(el('span', 'tag', tag));
    }
    label.append(tags);

    const matchType = select({
      options: MATCH_TYPES.map((t) => [t, t]),
      value: keyword.matchType,
      onChange: (value) => { updateKeyword(draft, keyword.id, { matchType: value }); refresh(); },
    });

    const bid = input({
      type: 'number',
      value: String(Math.round(keyword.bidPaise / 100)),
      min: '1',
      step: '1',
      onInput: (value) => {
        // Written straight into the draft, and only the summary redrawn — a
        // full redraw here would rebuild this box and take the caret with it.
        const paise = Math.round(Number(value) * 100);
        if (updateKeyword(draft, keyword.id, { bidPaise: paise }).ok) {
          refresh({ summaryOnly: true });
        }
      },
    });

    const toggle = el('button', 'add');
    toggle.type = 'button';
    toggle.textContent = paused ? 'resume' : 'pause';
    toggle.addEventListener('click', () => {
      updateKeyword(draft, keyword.id, { active: paused });
      refresh();
    });

    return {
      className: paused ? 'paused-row' : null,
      cells: [
        label, matchType, bid,
        stats ? whole(stats.clicks) : '0',
        stats ? rupees(stats.costPaise) : '—',
        stats && stats.clicks > 0 ? rupees(stats.costPaise / stats.clicks) : '—',
        stats && stats.conversions > 0 ? stats.conversions.toFixed(1) : '0',
        score ? String(score.score) : '—',
        toggle,
      ],
    };
  });

  const list = el('table', 'mini picked');
  table(list, [
    'Keyword', 'Match', { label: 'Bid ₹', num: true }, { label: 'Clicks', num: true },
    { label: 'Cost', num: true }, { label: 'CPC', num: true }, { label: 'Conv', num: true },
    { label: 'Quality', num: true }, '',
  ], rows);
  node.append(list);

  if (draft.keywords.every((k) => k.active === false)) {
    node.append(el('p', 'problems',
      'Every keyword is paused. You will enter no auctions at all next week.'));
  }

  node.append(planner(ctx, refresh));
  node.append(el('p', 'note',
    'Exact and phrase match on the words. Broad matches on meaning through the '
    + 'tags — and nobody can tell you in advance how far it will travel, which '
    + 'is the point. Broadening raises impressions and LOWERS impression share, '
    + 'because it grows the number of auctions you were eligible for faster '
    + 'than the number you won.'));
  return node;
}

/**
 * Keyword Planner, mid-game: text, weekly volume, intent, and nothing else.
 *
 * The same list round 0 offered, and the same withholding — what a search does
 * after the click is earned by running it (16.1, C4).
 */
function planner(ctx, refresh) {
  // Held on ctx rather than here, because adding a keyword rebuilds this card.
  // Found by using it: you set "phrase, ₹55", add one keyword, and the box
  // shuts and forgets both — which makes building an ad group from the planner
  // eight fiddly steps instead of eight clicks.
  ctx.planner = ctx.planner ?? { matchType: 'phrase', bidPaise: 3000, term: '', open: false };
  const chosen = ctx.planner;

  const box = el('details', 'planner');
  box.open = chosen.open;
  box.addEventListener('toggle', () => { chosen.open = box.open; });
  box.append(el('summary', null, 'Add a keyword'));

  const held = new Set(ctx.draft.keywords.map((k) => normalise(k.text)));
  const all = ctx.queries
    .map((q) => ({ ...q, weekly: Math.round((ctx.weeklyVolume * q.volumeShareBp) / 10000) }))
    .sort((a, b) => b.weekly - a.weekly);

  const controls = el('div', 'neg-compose');
  const search = input({
    value: chosen.term,
    placeholder: 'search the keyword planner…',
    onInput: (value) => { chosen.term = value; draw(); },
  });
  const type = select({
    options: MATCH_TYPES.map((t) => [t, t]),
    value: chosen.matchType,
    onChange: (value) => { chosen.matchType = value; },
  });
  const bid = input({
    type: 'number',
    value: String(Math.round(chosen.bidPaise / 100)),
    min: '1',
    step: '1',
    onInput: (value) => { chosen.bidPaise = Math.max(100, Math.round(Number(value) * 100)); },
  });
  add(controls, field('Search', search), field('Match', type), field('Bid ₹', bid));
  box.append(controls);

  const listBox = el('div', 'scroll research');
  box.append(listBox);

  function draw() {
    const term = chosen.term.trim().toLowerCase();
    const rows = all
      .filter((q) => !term || q.text.includes(term))
      .slice(0, 40)
      .map((q) => {
        const already = held.has(normalise(q.text));
        const button = el('button', 'add');
        button.type = 'button';
        button.textContent = already ? 'in account' : 'add';
        button.disabled = already;
        button.addEventListener('click', () => {
          addKeyword(ctx.draft, { text: q.text, matchType: chosen.matchType, bidPaise: chosen.bidPaise });
          refresh();
        });
        return { cells: [q.text, whole(q.weekly), q.intent, button] };
      });
    const node = el('table', 'mini');
    table(node, ['Search term', { label: 'Weekly', num: true }, 'Intent', ''], rows);
    listBox.replaceChildren(node);
  }
  draw();

  box.append(el('p', 'note',
    'Volume is public research. What a search is worth to you is not — that is '
    + 'earned by running it and reading the report.'));
  return box;
}
