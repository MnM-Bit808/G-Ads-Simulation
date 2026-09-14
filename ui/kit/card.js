/**
 * The keyword card (plans/2026-09-13-studio-makeover.md, section 4). One card
 * for the whole game: round 0 draws it before any week has run, with its
 * weekly places present and empty; the weekly Your keywords section fills
 * the same places with the week's figures.
 *
 * A DRAG IS NEVER REDRAWN UNDER THE FINGER. While the slider moves, the caller
 * hands the new model to `show`, which changes the figure and the warning in
 * place; anything else (a match type, a typed bid) the caller redraws.
 */

import { el, add, rupees, whole } from '../dom.js';
import { whyButton } from '../guide/drawer.js';
import { QUALITY_MIN_IMPRESSIONS } from '../../engine/constants.js';
import { KEYWORDS } from '../words/keywords.js';
import { FORM } from '../words/form.js';
import { pills, stat, slider, typeIn } from './controls.js';

/** The slider never ends below ₹100; past that, half again the highest bid (I6's display bounds). */
export const SLIDER_FLOOR_PAISE = 10000;
export const SLIDER_HEADROOM = 1.5;
export const SLIDER_STEP_PAISE = 1000;

/** @returns {number} paise: the slider's right end for these keywords */
export function sliderMaxPaise(keywords) {
  const top = Math.max(0, ...keywords.map((k) => k.bidPaise));
  const wanted = Math.ceil((top * SLIDER_HEADROOM) / SLIDER_STEP_PAISE) * SLIDER_STEP_PAISE;
  return Math.max(SLIDER_FLOOR_PAISE, wanted);
}

const MATCHES = ['exact', 'phrase', 'broad'];
const MATCH_WORD = { exact: KEYWORDS.exact, phrase: KEYWORDS.phrase, broad: KEYWORDS.broad };
const RATING_WORD = { above: KEYWORDS.above, average: KEYWORDS.average, below: KEYWORDS.below };

/**
 * @param {object} args
 * @param {object} args.card - the model: `setupKeywordCards` (round 0) or the
 *   weekly `keywordCards`
 * @param {number} args.maxRupees - the slider's right end
 * @param {Function|null} [args.openGuide]
 * @param {(matchType: string) => void} args.onMatch
 * @param {(rupees: number, settled: boolean) => void} args.onBid - `settled` is
 *   false while the slider moves
 * @param {() => void} args.onRemove
 * @returns {{node: HTMLElement, show: (card: object) => void}}
 */
export function keywordCard({ card, maxRupees, openGuide = null, onMatch, onBid, onRemove }) {
  let model = card;
  let view = 'body';
  const node = el('article', 'kcard');
  node.dataset.id = card.id;

  const left = el('div', 'kcard-left');
  if (card.isNew) left.append(el('span', 'knew', KEYWORDS.newTag()));
  const qs = el('button', 'kqs', KEYWORDS.qs({ value: card.quality.value ?? '—' }));
  qs.type = 'button';
  qs.dataset.key = `${card.id}:qs`;
  const more = el('button', 'kmore', '⋯');
  more.type = 'button';
  more.dataset.key = `${card.id}:more`;
  more.setAttribute('aria-label', KEYWORDS.more());
  const right = el('div', 'kcard-right');
  right.append(qs, more);
  const top = el('div', 'kcard-top');
  top.append(left, right);
  const menuHost = el('div');
  const inner = el('div', 'kcard-inner');
  node.append(top, menuHost, el('h3', 'kcard-name', card.text), inner);

  // The two things a drag changes, kept so `show` can reach them.
  let figure = null;
  const warning = el('p', 'kwarn');
  const warningText = el('span');
  warning.append(warningText);
  add(warning, whyButton(KEYWORDS.underReserve, openGuide));

  function showWarning() {
    warning.hidden = model.needPaise == null;
    warningText.textContent = model.needPaise == null ? '' : KEYWORDS.underReserve({ need: rupees(model.needPaise) });
  }

  function paidLine() {
    if (model.isNew) return KEYWORDS.isNew();
    if (model.stats?.cpcPaise != null) return KEYWORDS.paid({ cpc: rupees(model.stats.cpcPaise) });
    return KEYWORDS.noClicks();
  }

  function body() {
    const box = el('div', 'kcard-body');
    const match = pills({
      options: MATCHES.map((m) => [m, MATCH_WORD[m]()]),
      value: model.matchType,
      label: KEYWORDS.match(),
      keyPrefix: `${model.id}:match`,
      onPick: onMatch,
    });
    const reach = el('p', 'kreach', FORM.reach({ count: model.reach }));
    let tagsText = '';
    if (model.tags) tagsText = model.noTagsOnBroad ? KEYWORDS.noTags() : KEYWORDS.tags({ list: model.tags.join(' · ') });
    const tags = el('p', model.noTagsOnBroad ? 'ktags warn' : 'ktags', tagsText);
    tags.title = tagsText;

    figure = typeIn({
      text: rupees(model.bidPaise),
      // Read on opening: a drag moves `model` without redrawing (see `show`).
      value: () => Math.round(model.bidPaise / 100),
      label: KEYWORDS.typeBid({ keyword: model.text }),
      onCommit: (value) => onBid(value, true),
    });
    figure.dataset.key = `${model.id}:bid`;
    const bidRow = el('div', 'kbid-row');
    bidRow.append(el('span', 'klabel', KEYWORDS.bid()), figure);

    const bar = slider({
      minRupees: 1,
      maxRupees,
      valueRupees: Math.min(maxRupees, Math.round(model.bidPaise / 100)),
      label: KEYWORDS.sliderLabel({ keyword: model.text }),
      onInput: (value) => onBid(value, false),
    });
    bar.range.dataset.key = `${model.id}:slider`;
    showWarning();

    const figures = el('div', 'kstats');
    const s = model.stats;
    figures.append(
      stat(s ? whole(s.clicks) : '—', KEYWORDS.clicks()),
      stat(s ? rupees(s.costPaise) : '—', KEYWORDS.cost()),
      stat(s ? (s.conversions > 0 ? s.conversions.toFixed(1) : '0') : '—', KEYWORDS.conv()),
    );
    box.append(match, reach, tags, bidRow, bar.node, warning, el('p', 'kpaid', paidLine()), figures);
    return box;
  }

  function qualityPanel() {
    const box = el('div', 'kqs-panel');
    box.append(el('p', 'kqs-title', KEYWORDS.qsTitle({ value: model.quality.value ?? '—' })));
    if (model.quality.value === null) {
      const none = el('p', 'kqs-note', KEYWORDS.qsNone({ impressions: whole(QUALITY_MIN_IMPRESSIONS) }));
      add(none, whyButton(KEYWORDS.qsNone, openGuide));
      box.append(none);
    } else {
      const parts = el('dl', 'kqs-parts');
      for (const part of model.quality.ratings) {
        parts.append(el('dt', null, part.label), el('dd', `rating-${part.rating}`, RATING_WORD[part.rating]()));
      }
      const note = el('p', 'kqs-note', KEYWORDS.qsNote());
      add(note, whyButton(KEYWORDS.qsNote, openGuide));
      box.append(parts, note);
    }
    const back = el('button', 'kback', KEYWORDS.back());
    back.type = 'button';
    back.dataset.key = `${model.id}:qs`;
    // Focus goes back to what opened the panel: the panel it was in is gone.
    back.addEventListener('click', () => { view = 'body'; draw(); qs.focus(); });
    box.append(back);
    return box;
  }

  function menu() {
    const box = el('div', 'kmenu');
    box.setAttribute('role', 'menu');
    const remove = el('button', 'kmenu-danger', KEYWORDS.remove());
    remove.type = 'button';
    remove.setAttribute('role', 'menuitem');
    remove.addEventListener('click', onRemove);
    const cancel = el('button', null, KEYWORDS.cancel());
    cancel.type = 'button';
    cancel.setAttribute('role', 'menuitem');
    const shut = () => { view = 'body'; draw(); more.focus(); };
    cancel.addEventListener('click', shut);
    box.addEventListener('keydown', (event) => { if (event.key === 'Escape') shut(); });
    box.append(remove, cancel);
    queueMicrotask(() => remove.focus());
    return box;
  }

  function draw() {
    qs.setAttribute('aria-expanded', String(view === 'qs'));
    more.setAttribute('aria-expanded', String(view === 'menu'));
    menuHost.replaceChildren(...(view === 'menu' ? [menu()] : []));
    inner.replaceChildren(view === 'qs' ? qualityPanel() : body());
  }

  qs.addEventListener('click', () => { view = view === 'qs' ? 'body' : 'qs'; draw(); });
  more.addEventListener('click', () => { view = view === 'menu' ? 'body' : 'menu'; draw(); });
  draw();

  /** Mid-drag: the new bid and its warning, in place. */
  function show(next) {
    model = next;
    if (figure) figure.textContent = rupees(next.bidPaise);
    showWarning();
  }

  return { node, show };
}
