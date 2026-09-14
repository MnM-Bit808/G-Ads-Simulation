/**
 * Your keywords, drawn (plans/2026-09-13-studio-makeover.md, section 4).
 *
 * The cards are the kit's (ui/kit/card.js), the one card round 0 draws too,
 * with the week's parts switched on; the planner is the kit's drawer. What each
 * card shows is worked out in ./read.js and every sentence is in
 * ../words/keywords.js: this file only draws the section around them, its
 * head, the reading panel and Adjust several. Changes go through the decision
 * form's own functions and its own refresh (`ctx.refresh`), so the new screen is
 * a new way to reach the same draft, and the tray, the search terms and the rest
 * of the page follow as they do in the classic look.
 *
 * A DRAG IS NEVER REDRAWN UNDER THE FINGER. While a slider moves, only its
 * card's figure, "was", outline and warning change, and the tray; the switch and
 * the tick change in place for the same reason. Anything else redraws the
 * section, keeping focus.
 */

import { el, add, rupees, pct } from '../dom.js';
import { addKeyword, addKeywords, removeKeyword, updateKeyword } from '../decisions.js';
import { marketOutlook } from '../chart.js';
import { whyButton } from '../guide/drawer.js';
import { KEYWORDS } from '../words/keywords.js';
import { keywordCards, adjustSeveral, readingPanel } from './read.js';
import { keywordCard, sliderMaxPaise, SLIDER_STEP_PAISE } from '../kit/card.js';
import { openPlanner } from '../kit/planner.js';
import { pills } from '../kit/controls.js';

const MATCHES = ['exact', 'phrase', 'broad'];
const MATCH_WORD = { exact: KEYWORDS.exact, phrase: KEYWORDS.phrase, broad: KEYWORDS.broad };
const HELD = {
  budget: KEYWORDS.heldBudget, both: KEYWORDS.heldBoth, rank: KEYWORDS.heldRank, saturated: KEYWORDS.heldSaturated,
};
const SAID = {
  budget: KEYWORDS.saidBudget, both: KEYWORDS.saidBoth, rank: KEYWORDS.saidRank, saturated: KEYWORDS.saidSaturated,
};
const LEVER = {
  stretch: [KEYWORDS.leverStretch, KEYWORDS.leverStretchHow],
  addMoney: [KEYWORDS.leverAddMoney, KEYWORDS.leverAddMoneyHow],
  raise: [KEYWORDS.leverRaise, KEYWORDS.leverRaiseHow],
  reach: [KEYWORDS.leverReach, KEYWORDS.leverReachHow],
};
const RUPEE_STEP = SLIDER_STEP_PAISE / 100;
const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * @param {object} args
 * @param {object} args.game
 * @param {object} args.ctx - the dashboard's context, from `renderDashboard`'s `onContext`
 * @param {Function} [args.openGuide]
 * @param {(key: string) => void} args.openSection
 * @param {(node: HTMLElement|null) => void} args.setTrayOverride
 * @returns {{node: HTMLElement, refresh: () => void, leave: () => void}}
 */
export function renderKeywordsSection({ game, ctx, openGuide, openSection, setTrayOverride }) {
  const played = game.reports.length;
  const state = { selecting: false, selected: new Set() };
  // Fixed for the week from the bids it started with, so the slider never
  // rescales under a finger; a typed bid past its end widens it.
  let maxRupees = Math.round(sliderMaxPaise(ctx.draft.base.keywords) / 100);
  let bulk = null;

  const node = el('div', 'ksection');
  // The guide's "show me on the card" looks for the keywords slot (sections.js, draws).
  node.dataset.slot = 'keywords';

  const staged = (light = false) => ctx.refresh(light ? { summaryOnly: true } : undefined);
  const focusAdd = () => node.querySelector('[data-key="add"]')?.focus();
  // The full query set, for one number per keyword: what its bid must clear
  // (ui/reserve.js), as `ctx.reach` reads it for another. No tag is shown.
  const cardsFor = (keywords) => keywordCards({
    draft: { ...ctx.draft, keywords },
    byKeyword: ctx.byKeyword,
    quality: ctx.quality,
    grades: ctx.grades,
    reach: ctx.reach,
    querySet: game.state.querySet,
  });

  function redraw() {
    const key = document.activeElement?.dataset?.key;
    node.replaceChildren(...[header(), panel(), grid()].filter(Boolean));
    if (key) node.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
  }

  function header() {
    const row = el('div', 'khead');
    const range = game.view.termsRange === 'week'
      ? KEYWORDS.rangeWeek({ week: played })
      : KEYWORDS.rangeAll({ from: 1, to: played });
    const sub = el('p', 'ksub', KEYWORDS.sub({ count: ctx.draft.keywords.length, range }));
    add(sub, whyButton(KEYWORDS.sub, openGuide));
    row.append(sub);
    if (!state.selecting) {
      const switcher = pills({
        options: [['week', KEYWORDS.thisWeek()], ['all', KEYWORDS.allWeeks()]],
        value: game.view.termsRange,
        label: KEYWORDS.rangeLabel(),
        keyPrefix: 'range',
        onPick: (value) => { game.view.termsRange = value; staged(); redraw(); },
      });
      switcher.classList.add('kswitch');
      const adjust = el('button', 'kadjust', KEYWORDS.adjust());
      adjust.type = 'button';
      adjust.dataset.key = 'adjust';
      adjust.addEventListener('click', startSelecting);
      const tools = el('div', 'ktools');
      tools.append(switcher, adjust);
      row.append(tools);
    }
    return row;
  }

  function panel() {
    const names = new Map(game.state.advertisers.map((a) => [a.id, a.name]));
    const model = readingPanel({
      outlook: marketOutlook(game.insights, game.playerId, names),
      keywords: ctx.draft.base.keywords,
      lastWeek: game.reports.at(-1)?.byAdvertiser?.[game.playerId]?.breakdown?.byKeyword ?? {},
      week: played,
    });
    if (!model) return null;

    const read = el('div', 'kpanel-read');
    const heading = el('h3', null, HELD[model.kind]());
    add(heading, whyButton(HELD[model.kind], openGuide));
    read.append(
      el('p', 'kpanel-eyebrow', KEYWORDS.eyebrow({ week: model.week })),
      heading,
      el('p', null, SAID[model.kind]({
        budget: pct(model.lostToBudget),
        rank: pct(model.lostToRank),
        rankNone: Math.round(100 * model.lostToRank) === 0,
        shown: pct(model.impressionShare),
      })),
    );

    const spend = el('div', 'kpanel-spend');
    const bar = el('div', 'kbar');
    model.spend.forEach((row, i) => {
      const part = el('span', i === 0 ? 'lead' : null);
      part.style.flexGrow = String(row.costPaise);
      part.title = `${row.text}: ${rupees(row.costPaise)}, ${pct(row.share)}`;
      bar.append(part);
    });
    const legend = el('ul', 'klegend');
    const item = (label, share, lead) => {
      const li = el('li', lead ? 'lead' : null);
      li.append(el('span', 'klegend-key'), el('span', null, label), el('strong', null, share));
      return li;
    };
    model.named.forEach((row, i) => legend.append(item(row.text, pct(row.share), i === 0)));
    if (model.others) legend.append(item(KEYWORDS.others({ count: model.others.count }), pct(model.others.share), false));
    spend.append(el('p', 'kpanel-small', KEYWORDS.spendTitle({ week: model.week })), bar, legend);

    const levers = el('div', 'kpanel-levers');
    for (const lever of model.levers) {
      const [name, how] = LEVER[lever];
      const pull = el('button', 'klever press');
      pull.type = 'button';
      pull.dataset.key = `lever:${lever}`;
      pull.append(el('strong', null, name()), el('span', null, how()));
      pull.addEventListener('click', () => {
        if (lever === 'addMoney') openSection('money');
        else if (lever === 'reach') planner();
        else startSelecting();
      });
      levers.append(pull);
    }

    const box = el('div', 'kpanel');
    box.append(read, spend, levers);
    return box;
  }

  function grid() {
    const box = el('div', 'kgrid');
    for (const card of cardsFor(ctx.draft.keywords)) box.append(cardNode(card));
    const plus = el('button', 'kadd');
    plus.type = 'button';
    plus.dataset.key = 'add';
    plus.append(el('strong', null, KEYWORDS.addTitle()), el('span', null, KEYWORDS.addHow()));
    plus.addEventListener('click', planner);
    box.append(plus);
    return box;
  }

  function cardNode(card) {
    const own = () => ctx.draft.keywords.filter((k) => k.id === card.id);
    const drawn = keywordCard({
      card,
      maxRupees,
      openGuide,
      onMatch: (matchType) => { updateKeyword(ctx.draft, card.id, { matchType }); staged(); redraw(); },
      onBid: (value, settled) => {
        if (!updateKeyword(ctx.draft, card.id, { bidPaise: value * 100 }).ok) return;
        if (value > maxRupees) maxRupees = Math.ceil(value / RUPEE_STEP) * RUPEE_STEP;
        staged(!settled);
        if (settled) { redraw(); return; }
        drawn.show(cardsFor(own())[0]);
      },
      // The card, and the menu that had focus, are gone after the redraw.
      onRemove: () => { removeKeyword(ctx.draft, card.id); staged(); redraw(); focusAdd(); },
      onActive: (on) => { updateKeyword(ctx.draft, card.id, { active: on }); staged(); },
      select: state.selecting
        ? {
          on: state.selected.has(card.id),
          onToggle: (on) => {
            if (on) state.selected.add(card.id);
            else state.selected.delete(card.id);
            bulk?.update();
          },
        }
        : null,
    });
    return drawn.node;
  }

  function planner() {
    openPlanner({
      trigger: { focus: focusAdd },
      queries: ctx.queries,
      weeklyVolume: ctx.weeklyVolume,
      // The classic planner's own state (ui/decisions.js), so both keep what was typed.
      state: ctx.planner,
      held: () => new Set(ctx.draft.keywords.map((k) => normal(k.text))),
      reach: ctx.reach,
      tag: ctx.tagKeyword,
      onAdd: (text, spec) => {
        const { ok } = addKeyword(ctx.draft, { text, ...spec }, { tag: ctx.tagKeyword });
        if (ok) { staged(); redraw(); }
        return ok;
      },
      onAddAll: (texts, spec) => {
        addKeywords(ctx.draft, texts.map((text) => ({ text, ...spec })), { tag: ctx.tagKeyword });
        staged();
        redraw();
      },
    });
  }

  function startSelecting() {
    state.selecting = true;
    state.selected.clear();
    bulk = bulkBar();
    setTrayOverride(bulk.node);
    redraw();
  }

  function stopSelecting() {
    state.selecting = false;
    state.selected.clear();
    bulk = null;
    setTrayOverride(null);
    redraw();
  }

  function bulkBar() {
    const bar = el('div', 'kbulk');
    const count = el('strong', 'kbulk-count');
    const note = el('span', 'kbulk-note');
    const numberBox = (text, value) => {
      const label = el('label', 'kbulk-label');
      const input = el('input', 'kfield knum');
      input.type = 'number';
      input.step = '1';
      input.value = value;
      label.append(el('span', null, text), input);
      return { label, input };
    };
    const action = (text, onClick, className = 'kbulk-apply') => {
      const b = el('button', className, text);
      b.type = 'button';
      b.classList.add('press');
      b.addEventListener('click', onClick);
      return b;
    };
    const apply = (change) => {
      const ids = [...state.selected];
      if (ids.length === 0) { note.textContent = KEYWORDS.pickFirst(); return; }
      const out = adjustSeveral(ctx.draft, ids, change);
      note.textContent = out.refused.length > 0
        ? KEYWORDS.refused({ n: out.refused.length, reason: out.refused[0].reason })
        : '';
      staged();
      redraw();
    };
    const setBox = numberBox(KEYWORDS.setBid(), '');
    const pctBox = numberBox(KEYWORDS.changeBy(), '-20');
    const setGroup = el('div', 'kbulk-group');
    setGroup.append(setBox.label, action(KEYWORDS.apply(), () => {
      const n = Math.round(Number(setBox.input.value));
      if (n >= 1) apply({ setBidPaise: n * 100 });
    }));
    const pctGroup = el('div', 'kbulk-group');
    pctGroup.append(pctBox.label, el('span', null, KEYWORDS.percent()), action(KEYWORDS.apply(), () => {
      const n = Number(pctBox.input.value);
      if (pctBox.input.value !== '' && Number.isFinite(n)) apply({ byPercent: n });
    }));
    const matchGroup = el('div', 'kbulk-group');
    matchGroup.append(el('span', null, KEYWORDS.matchAll()));
    for (const m of MATCHES) matchGroup.append(action(MATCH_WORD[m](), () => apply({ matchType: m }), 'kbulk-pill'));
    bar.append(count, setGroup, pctGroup, matchGroup, note, action(KEYWORDS.done(), stopSelecting, 'kbulk-done'));
    const update = () => { count.textContent = KEYWORDS.selected({ n: state.selected.size }); };
    update();
    return { node: bar, update };
  }

  redraw();
  return {
    node,
    refresh: redraw,
    // Leaving the section while picking would leave the tray showing its bar.
    leave: () => { if (state.selecting) stopSelecting(); },
  };
}
