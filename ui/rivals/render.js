/**
 * The Studio's Rivals (design/market/, chosen by the owner 2026-09-15): the
 * market's four public figures and the player's own share on one card, then
 * each rival you meet as a card, with how often you meet week by week, their
 * ad as searchers see it, and who comes out above. What it shows is worked out
 * in ./read.js and the market reading (ui/chart.js, `marketOutlook`); the
 * words are in ui/words/rivals.js, and the re-split week's in ui/words/market.js.
 *
 * Read-only: nothing here is a decision, so nothing reaches the tray.
 */

import { el, add, rupees, whole, pct } from '../dom.js';
import { formatINR } from '../../engine/money.js';
import { TOTAL_ROUNDS, ROUNDS_PER_MONTH } from '../../engine/constants.js';
import { marketOutlook, insightMovers, marketChange } from '../chart.js';
import { whyButton } from '../guide/drawer.js';
import { serp } from '../kit/serp.js';
import { AD } from '../words/ad.js';
import { MARKET } from '../words/market.js';
import { RIVALS } from '../words/rivals.js';
import { rivalCards, marketFigures } from './read.js';

/** The height of a week's bar at 100% of your auctions, px. */
const BAR_PX = 30;

/**
 * @param {object} args
 * @param {object} args.game - the played game: `insights`, `state`, `playerId`
 * @param {object} args.ctx - the dashboard's context: `advertisers`, `weeklyVolume`
 * @param {Function} [args.openGuide] - `guide.open`
 * @returns {{node: HTMLElement, refresh: () => void}}
 */
export function renderRivalsSection({ game, ctx, openGuide }) {
  const node = el('div', 'rv');

  function figure(label, value, sub) {
    const box = el('div', 'rv-figure');
    box.append(el('span', 'rv-label', label), el('strong', 'rv-value', value), el('span', 'rv-small', sub));
    return box;
  }

  /** The week month 3's budgets take effect (D12, C8), whose rule is public (D4). */
  function reSplitWeek() {
    const snapshot = game.state.budgetSchedule?.rankSnapshotRound;
    return snapshot != null && game.state.history.length === snapshot + 1;
  }

  function contextCard(names) {
    const card = el('div', 'rv-card');
    card.dataset.slot = 'market';
    const m = marketFigures(game.state.marketContext, ctx.weeklyVolume);
    if (m) {
      const last = (value) => (value === null ? RIVALS.firstWeek() : RIVALS.lastWeek({ value }));
      const cents = (paise) => formatINR(paise, { decimals: 2 });
      const row = el('div', 'rv-figures');
      row.append(
        figure(RIVALS.marketSpend(), rupees(m.spendPaise), last(m.lastSpendPaise === null ? null : rupees(m.lastSpendPaise))),
        // A click costs paise: Rs 9.68 against Rs 9.40 is not a rupee's rise.
        figure(RIVALS.medianClick(), cents(m.medianCpcPaise), last(m.lastMedianCpcPaise === null ? null : cents(m.lastMedianCpcPaise))),
        figure(RIVALS.advertisersRunning(), String(m.advertisers), last(m.lastAdvertisers === null ? null : String(m.lastAdvertisers))),
        figure(RIVALS.searchesWeek(), whole(m.weeklySearches), RIVALS.sameEveryWeek()),
      );
      card.append(row);
      const change = marketChange(game.state.marketContext);
      if (reSplitWeek() && change) {
        const round = game.state.history.length;
        card.append(el('p', 'rv-read', MARKET.newMonth({
          month: Math.ceil(round / ROUNDS_PER_MONTH), snapshot: round - 1,
          spent: rupees(change.thisWeekPaise), before: rupees(change.lastWeekPaise),
        })));
      }
    }
    const out = marketOutlook(game.insights, game.playerId, names);
    if (out) {
      const you = el('div', 'rv-you');
      const pair = (value, label, why) => {
        const item = el('span', 'rv-pair');
        item.append(el('strong', null, value), el('span', 'rv-small', label));
        add(item, why ? whyButton(why, openGuide) : null);
        return item;
      };
      you.append(el('span', 'rv-label', RIVALS.you()),
        pair(pct(out.impressionShare), RIVALS.shown()),
        pair(pct(out.lostToBudget), RIVALS.lostBudget()),
        pair(pct(out.lostToRank), RIVALS.lostRank(), RIVALS.lostRank));
      const said = [RIVALS.reading[out.constraint]({
        share: pct(out.impressionShare), budget: pct(out.lostToBudget), rank: pct(out.lostToRank),
      })];
      if (out.meetMost && out.meetMost.rate > 0) {
        said.push(out.aboveYouMost.id === out.meetMost.id
          ? RIVALS.meetSame({ name: out.meetMost.name, overlap: pct(out.meetMost.rate), above: pct(out.aboveYouMost.rate) })
          : RIVALS.meetOther({
            name: out.meetMost.name, overlap: pct(out.meetMost.rate),
            other: out.aboveYouMost.name, above: pct(out.aboveYouMost.rate),
          }));
      }
      card.append(you, el('p', 'rv-read', said.join(' ')));
    }
    return card;
  }

  function weekBars(weeks) {
    const bars = el('div', 'rv-bars');
    bars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const bar = el('span');
      const value = weeks[i];
      if (value === undefined || value === null) bar.classList.add('future');
      else {
        bar.style.height = `${Math.max(1, Math.round(BAR_PX * value))}px`;
        if (i === weeks.length - 1) bar.classList.add('now');
      }
      bars.append(bar);
    }
    return bars;
  }

  function line(label, value) {
    const row = el('div', 'rv-line');
    const track = el('span', 'rv-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = el('span');
    fill.style.width = pct(value);
    track.append(fill);
    row.append(el('span', 'rv-small', label), track, el('strong', 'rv-num', pct(value)));
    return row;
  }

  function rivalCard(c) {
    const card = el('article', 'rv-card');
    const head = el('div', 'rv-head');
    head.append(el('h3', null, c.name));
    if (c.moved) {
      const said = c.overlap > c.was ? RIVALS.movedUp : RIVALS.movedDown;
      head.append(el('span', 'rv-small', said({ from: pct(c.was) })));
    }
    const meet = el('div', 'rv-meet');
    const big = el('div', 'rv-big');
    big.append(el('strong', 'rv-value', pct(c.overlap)), el('span', 'rv-small', RIVALS.showedIn()));
    meet.append(big, weekBars(c.weeks));
    card.append(head, meet);
    if (c.ad) {
      // The offer rides in the ad rather than beside it: a shop putting its
      // discount in its own copy is the whole of how a player finds out that
      // the field is discounting (I45).
      const descriptions = c.offerPaise > 0
        ? [...c.ad.descriptions, RIVALS.offersPrepaid({ amount: rupees(c.offerPaise) })]
        : c.ad.descriptions;
      card.append(serp({
        domain: c.domain, headlines: c.ad.headlines, descriptions, sponsored: AD.sponsored(),
      }));
    }
    card.append(line(RIVALS.aboveWhenMeet(), c.above), line(RIVALS.youOutrank(), c.beat));
    return card;
  }

  function draw() {
    const names = new Map((ctx.advertisers ?? []).map((a) => [a.id, a.name]));
    const parts = [contextCard(names)];
    const movers = insightMovers(game.insights, game.playerId, names);
    if (movers.length > 0) {
      parts.push(el('p', 'rv-read', MARKET.moved({
        movers: movers.map((m) => MARKET.mover({ name: m.name, from: pct(m.from), to: pct(m.to) })),
      })));
    } else if (reSplitWeek()) {
      parts.push(el('p', 'rv-read', MARKET.nobodyMoved()));
    }
    const { met, never } = rivalCards(game.insights, game.playerId, ctx.advertisers);
    parts.push(el('p', 'rv-small', `${RIVALS.notSpend()} ${RIVALS.key()}`));
    const grid = el('div', 'rv-grid');
    grid.dataset.slot = 'insights';
    grid.append(...met.map(rivalCard));
    parts.push(grid);
    if (never.length > 0) parts.push(el('p', 'rv-small', RIVALS.never({ names: never.map((c) => c.name) })));
    node.replaceChildren(...parts);
  }

  draw();
  return { node, refresh: draw };
}
