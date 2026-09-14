/**
 * The weekly Your ad (the owner's call, 2026-09-15): read-only, the ad as it
 * runs. What it shows is worked out in ./read.js; the words are in
 * ui/words/ad.js. Drawn afresh each time the section is opened, since a week
 * may have moved a grade (capital going live) since the last time.
 */

import { el, add, rupees } from '../dom.js';
import { getSelfView } from '../../engine/insights.js';
import { CREATIVE_ALLOCATION_PAISE } from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { serp } from '../kit/serp.js';
import { AD } from '../words/ad.js';
import { adModel } from './read.js';

/** Grades run from 1 to 10 (the grader's scale, agents/grader.js). */
const GRADE_SCALE = 10;
const PART_WORD = { expectedCtr: AD.expectedCtr, adRelevance: AD.adRelevance, landingPage: AD.landingPage };
const width = (value) => `${(100 * value) / GRADE_SCALE}%`;

function whoWrote(writer, openGuide) {
  const box = el('div', 'yad-card');
  const budget = rupees(CREATIVE_ALLOCATION_PAISE);
  box.append(el('h3', null, AD.whoWrote()),
    el('p', 'yad-writer', writer.hired ? writer.label : AD.you()),
    el('p', 'yad-small', writer.hired ? AD.fee({ amount: rupees(writer.pricePaise), budget }) : AD.free({ budget })));
  const said = writer.hired ? AD.hired : AD.own;
  const note = el('p', 'yad-note', said());
  add(note, whyButton(said, openGuide));
  box.append(note);
  return box;
}

function howItGrades(model, openGuide) {
  const box = el('div', 'yad-card');
  const rows = el('div', 'yad-grades');
  const laters = [];
  for (const grade of model.grades) {
    const part = PART_WORD[grade.key]();
    const track = el('span', 'yad-track');
    // The grade still to come sits behind this week's, outlined.
    if (grade.later) {
      const ghost = el('span', 'yad-ghost');
      ghost.style.width = width(grade.later.value);
      track.append(ghost);
      const later = grade.later.why === 'page' ? AD.laterPage : AD.laterCopy;
      laters.push(el('p', 'yad-small', later({ part, value: grade.later.value, week: grade.later.week })));
    }
    const fill = el('span', 'yad-fill');
    fill.style.width = width(grade.value);
    track.append(fill);
    rows.append(el('span', null, part), track, el('strong', 'yad-value', AD.outOf({ value: grade.value, scale: GRADE_SCALE })));
  }
  const qs = el('p', 'yad-small', AD.qsNote());
  add(qs, whyButton(AD.qsNote, openGuide));
  box.append(el('h3', null, AD.gradesTitle({ week: model.week })), rows, ...laters, qs);
  return box;
}

function landingPage(model) {
  const box = el('div', 'yad-card');
  box.classList.add('yad-page');
  const sketch = el('div', 'yad-sketch');
  sketch.append(el('div', 'yad-bar', model.domain));
  for (const strip of model.page.strips) {
    let text = strip.label;
    if (strip.week !== null) text = strip.from ? AD.stripFrom(strip) : AD.stripAt(strip);
    sketch.append(el('div', strip.week === null ? 'yad-strip' : 'yad-strip coming', text));
  }
  const words = el('div');
  words.append(el('h3', null, AD.pageTitle()), el('p', 'yad-quote', AD.quoted({ text: model.page.description })),
    el('p', 'yad-small', AD.pageRead()));
  box.append(sketch, words);
  return box;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {Function} args.openGuide - `guide.open`
 * @returns {{node: HTMLElement}}
 */
export function renderAdSection({ game, openGuide }) {
  const self = getSelfView(game.state, game.playerId);
  // The creative block is not in the self view, so it is read from state, as
  // the dashboard reads it (I16).
  const creative = game.state.advertisers.find((a) => a.id === game.playerId)?.creative;
  const model = adModel({ draft: game.draft, creative, name: self.name, domain: self.domain });

  const node = el('div', 'yad');
  const preview = el('div', 'yad-preview');
  preview.append(el('h3', null, AD.asSearchersSee()), serp({
    domain: model.domain, name: model.name, headlines: model.headlines,
    descriptions: model.descriptions, sponsored: AD.sponsored(),
  }));
  const row = el('div', 'yad-row');
  row.append(whoWrote(model.writer, openGuide), howItGrades(model, openGuide));
  node.append(el('p', 'yad-intro', AD.intro({ week: 1 })), preview, row, landingPage(model));
  return { node };
}
