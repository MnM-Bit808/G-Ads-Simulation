/**
 * The Studio's What people typed (design/what-people-typed/, chosen by the
 * owner 2026-09-15): every search the account bought, most spent first, and
 * Block words beside it. What it shows is worked out in ./read.js; the words
 * are in ui/words/typed.js. A block is staged through the form's own
 * `addNegative`, so it lands in the tray and waits for the week to run.
 *
 * TYPING REDRAWS ONLY THE PREVIEW AND THE ROWS' OUTLINES. Redrawing the
 * section on every keystroke would take the box, and what is being typed into
 * it, with it: today's Negatives card found the same.
 */

import { el, add, rupees, pct } from '../dom.js';
import { blockedBy } from '../../engine/matching.js';
import { NEGATIVE_TYPES, addNegative, dropNegative, termsOutlook } from '../decisions.js';
import { whyButton } from '../guide/drawer.js';
import { TYPED } from '../words/typed.js';
import { termRows, blockPreview } from './read.js';

/** The preview lists at most this many searches a block would catch, of each kind. */
const LISTED = 5;
const NEVER_NAMED = 3;

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

const same = (a, b) => a.text === b.text && a.matchType === b.matchType;

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {object} args.ctx - the dashboard's context: `terms`, `texts`, `queries`, `advertisers`, `sync`
 * @param {Function} [args.openGuide] - `guide.open`
 * @param {() => void} [args.refreshTray] - redraws the tray after a change
 * @returns {{node: HTMLElement, refresh: () => void}}
 */
export function renderTypedSection({ game, ctx, openGuide, refreshTray }) {
  const node = el('div', 'wt');
  const composing = { text: '', matchType: 'broad' };
  let rowNodes = [];
  let previewBox = null;
  let input = null;

  function changed({ refocus = false } = {}) {
    draw();
    refreshTray?.();
    if (refocus) input?.focus();
  }

  function header(rows) {
    const outlook = termsOutlook(game.draft, ctx.terms);
    const range = game.view.termsRange;
    let said = range === 'week' ? TYPED.summaryWeek : TYPED.summary;
    if (rows.length === 0) said = TYPED.nothingYet;
    else if (outlook.mirrored) said = TYPED.mirrored;
    const summary = el('p', 'wt-summary',
      said({ n: rows.length, keywords: outlook.keywords, each: outlook.perKeyword.toFixed(1) }));
    add(summary, whyButton(said, openGuide));
    const chips = el('div', 'wt-range');
    for (const [key, label] of [['all', TYPED.allWeeks({ n: game.state.history.length })], ['week', TYPED.thisWeek()]]) {
      const chip = button('wt-chip', label, () => {
        game.view.termsRange = key;
        ctx.sync();
        draw();
      });
      chip.setAttribute('aria-pressed', String(range === key));
      chips.append(chip);
    }
    const head = el('div', 'wt-head');
    head.append(summary, chips);
    return head;
  }

  function action(r) {
    const draft = game.draft;
    if (r.blocksItself) {
      const staged = !draft.base.negatives.some((n) => same(n, r.blockedBy));
      const undo = button('wt-act', staged ? TYPED.undo() : TYPED.unblock(), () => {
        dropNegative(draft, draft.negatives.indexOf(r.blockedBy));
        changed();
      });
      undo.setAttribute('aria-label', TYPED.unblockThis({ text: r.text }));
      return undo;
    }
    if (r.blockedBy) {
      const said = el('span', 'wt-act', TYPED.blocked());
      said.title = TYPED.typeOf({ text: r.blockedBy.text, type: r.blockedBy.matchType });
      return said;
    }
    const block = button('wt-act', TYPED.block(), () => {
      addNegative(draft, { text: r.text, matchType: 'exact' });
      changed();
    });
    block.setAttribute('aria-label', TYPED.blockThis({ text: r.text }));
    return block;
  }

  function row(r, maxSpend, averages) {
    const line = el('div', 'wt-row');
    if (r.blockedBy) line.classList.add('blocked');
    const term = el('div', 'wt-term');
    term.append(el('span', 'wt-text', r.text));
    if (r.brand) term.append(el('span', 'wt-tag', r.brand.own ? TYPED.yourName() : TYPED.rivalName({ name: r.brand.name })));
    const spent = el('div', 'wt-spent');
    const track = el('span', 'wt-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = el('span');
    fill.style.width = `${Math.max(2, (100 * r.spendPaise) / maxSpend)}%`;
    track.append(fill);
    spent.append(track, el('span', 'wt-num', rupees(r.spendPaise)));
    const perSale = el('span', 'wt-num', r.perSalePaise === null ? '—' : rupees(r.perSalePaise));
    if (r.dear) {
      perSale.classList.add('mark');
      perSale.title = TYPED.dearTitle({ amount: rupees(r.perSalePaise), average: rupees(averages.perSalePaise) });
    }
    const back = el('span', 'wt-num', r.backRate ? pct(r.backRate) : '—');
    if (r.worse) {
      back.classList.add('mark');
      back.title = TYPED.worseTitle({ rate: pct(r.backRate), average: pct(averages.returnRate) });
    }
    line.append(term, spent, el('span', 'wt-num', r.sales.toFixed(1)), perSale, back, action(r));
    rowNodes.push({ node: line, row: r });
    return line;
  }

  function list(rows, averages) {
    const card = el('div', 'wt-card');
    card.dataset.slot = 'terms';
    const cols = el('div', 'wt-row');
    cols.classList.add('wt-cols');
    cols.append(el('span', null, TYPED.search()), el('span', null, TYPED.spent()), el('span', 'wt-num', TYPED.sales()),
      el('span', 'wt-num', TYPED.perSale()), el('span', 'wt-num', TYPED.cameBack()), el('span'));
    const body = el('div', 'wt-rows');
    const maxSpend = Math.max(1, ...rows.map((r) => r.spendPaise));
    rowNodes = [];
    for (const r of rows) body.append(row(r, maxSpend, averages));
    card.append(cols, body);
    if (averages.perSalePaise !== null) {
      const average = rupees(averages.perSalePaise);
      card.append(el('p', 'wt-legend', averages.returnRate > 0
        ? TYPED.legend({ average, rate: pct(averages.returnRate) })
        : TYPED.legendNoReturns({ average })));
    }
    return card;
  }

  function block() {
    const result = addNegative(game.draft, { ...composing });
    if (!result.added) {
      previewBox.hidden = false;
      previewBox.replaceChildren(el('p', 'wt-small', result.reason));
      return;
    }
    composing.text = '';
    changed({ refocus: true });
  }

  /** The block being written: what it would catch, in the panel and in the list. */
  function drawPreview() {
    const words = composing.text.trim();
    const negative = { text: words, matchType: composing.matchType };
    for (const { node: line, row: r } of rowNodes) {
      line.classList.toggle('caught', words !== '' && !r.blockedBy && Boolean(blockedBy({ text: r.text }, [negative])));
    }
    previewBox.hidden = words === '';
    if (words === '') {
      previewBox.replaceChildren();
      return;
    }
    const preview = blockPreview(negative, { queries: ctx.queries, terms: ctx.terms });
    const n = preview.bought.length + preview.never.length;
    let headline = TYPED.nothingSays({ text: words, type: composing.matchType });
    if (n > 0 && preview.bought.length === 0) headline = TYPED.noneBought({ n });
    else if (n > 0) {
      headline = TYPED.someBought({
        n, bought: preview.bought.length, spent: rupees(preview.spentPaise),
        sales: preview.sales.toFixed(1), never: preview.never.length,
      });
    }
    const shown = [el('p', 'wt-headline', headline)];
    if (preview.bought.length > 0) {
      const caught = el('div', 'wt-caught');
      for (const r of preview.bought.slice(0, LISTED)) {
        const sale = el('span', 'wt-num', r.perSalePaise === null ? '—' : TYPED.aSale({ amount: rupees(r.perSalePaise) }));
        if (r.dear) sale.classList.add('mark');
        const line = el('div', 'wt-hit');
        line.append(el('span', 'wt-text', r.text), el('span', 'wt-num', TYPED.salesOf({ sales: r.sales.toFixed(1) })), sale);
        caught.append(line);
      }
      shown.push(caught);
    }
    if (preview.never.length > 0) {
      shown.push(el('p', 'wt-small', TYPED.neverBought({
        list: preview.never.slice(0, NEVER_NAMED).map((q) => q.text).join(', '),
        more: Math.max(0, preview.never.length - NEVER_NAMED),
      })));
    }
    if (n > 0) shown.push(button('wt-go', TYPED.blockThese({ n }), block));
    previewBox.replaceChildren(...shown);
  }

  function blocker() {
    const card = el('div', 'wt-card');
    card.classList.add('wt-blocker');
    card.dataset.slot = 'negatives';
    const note = el('p', 'wt-small', TYPED.blockNote());
    add(note, whyButton(TYPED.blockNote, openGuide));

    input = el('input', 'wt-input');
    input.type = 'text';
    input.value = composing.text;
    input.placeholder = TYPED.placeholder();
    input.setAttribute('aria-label', TYPED.wordsToBlock());
    input.addEventListener('input', () => {
      composing.text = input.value;
      drawPreview();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && composing.text.trim() !== '') block();
    });

    const types = el('div', 'wt-range');
    for (const type of NEGATIVE_TYPES) {
      const chip = button('wt-chip', type, () => {
        composing.matchType = type;
        for (const other of types.children) other.setAttribute('aria-pressed', String(other === chip));
        drawPreview();
      });
      chip.setAttribute('aria-pressed', String(composing.matchType === type));
      types.append(chip);
    }
    previewBox = el('div', 'wt-preview');

    const blocks = el('div', 'wt-blocks');
    const draft = game.draft;
    if (draft.negatives.length === 0) blocks.append(el('p', 'wt-small', TYPED.noneBlocked()));
    draft.negatives.forEach((negative, index) => {
      const caught = blockPreview(negative, { queries: ctx.queries, terms: ctx.terms });
      const line = el('div', 'wt-block');
      const remove = button('wt-remove', '✕', () => {
        dropNegative(draft, index);
        changed();
      });
      remove.setAttribute('aria-label', TYPED.unblockThis({ text: negative.text }));
      line.append(el('span', 'wt-text', TYPED.typeOf({ text: negative.text, type: negative.matchType })),
        el('span', 'wt-small', TYPED.catches({ n: caught.bought.length + caught.never.length })), remove);
      blocks.append(line);
    });

    card.append(el('h3', null, TYPED.blockTitle()), note, input, types, previewBox,
      el('p', 'wt-label', TYPED.blockedTitle()), blocks);
    drawPreview();
    return card;
  }

  function draw() {
    const { rows, averages } = termRows(ctx.terms, {
      texts: ctx.texts, negatives: game.draft.negatives, advertisers: ctx.advertisers, playerId: game.playerId,
    });
    const split = el('div', 'wt-split');
    split.append(list(rows, averages), blocker());
    node.replaceChildren(header(rows), split);
  }

  draw();
  return {
    node,
    refresh() {
      ctx.sync();
      draw();
    },
  };
}
