/**
 * Step 4, your ad (plans/2026-09-14-round-zero-redesign.md, sections 4 and 5):
 * who writes it, the ad as searchers see it, and the two grades it runs at
 * from week 1. The fee buys not having to write (I11): a hired writer's copy is
 * the real copy for your square (content/writerCopy.js), graded at the
 * writer's level; writing it yourself opens the boxes, graded live on your
 * words by the game's own grader.
 *
 * A KEYSTROKE NEVER REDRAWS THE BOXES: the preview, the counters, the grades
 * and the tray change in place. The classic page learned this the hard way:
 * redrawing under the cursor swallowed every character after the first.
 */

import { el, add, rupees } from '../dom.js';
import { BRAND_IDENTITIES } from '../../content/brands.js';
import { writerTier, isDiy } from '../../content/writers.js';
import { validateAdCopy, namesARival } from '../../agents/grader.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, CREATIVE_ALLOCATION_PAISE,
} from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { R0 } from '../words/roundZero.js';
import { serp } from '../kit/serp.js';
import { writerOptions, setWriter, writeAd, adGrades, submittedAd } from './rules.js';

const WHAT = {
  diy: R0.writerDiy, freelancer: R0.writerFreelancer, agency: R0.writerAgency, retainer: R0.writerRetainer,
};
/** Grades run from 1 to 10 (the grader's scale, agents/grader.js). */
const GRADE_SCALE = 10;
/** Room past the limit, so the counter can say a line is too long rather than cut it. */
const OVER_ROOM = 20;

/**
 * @param {object} ctx - the frame's context (./studio.js)
 * @param {object} ctx.draft - round 0's draft; the writer and the ad are kept here
 * @param {number} ctx.rootSeed - picks the hired writer's copy for the square
 * @param {Function} ctx.openGuide
 * @param {() => void} ctx.changed - moves the ticks and the tray, not the step
 * @param {() => void} ctx.redraw - redraws this step, keeping the scroll and focus
 * @returns {{node: HTMLElement}}
 */
export function renderAdStep({ draft, rootSeed, openGuide, changed, redraw }) {
  const brand = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
  const rivalNames = BRAND_IDENTITIES.filter((b) => b.id !== draft.playerBrandId).map((b) => b.name);
  const writing = isDiy(draft.writerTier);
  const node = el('div', 'r0-ad');
  const intro = el('p', 'r0-intro', R0.adIntro());
  add(intro, whyButton(R0.adIntro, openGuide));
  add(intro, whyButton(R0.whoWrites, openGuide));

  // Who writes it, and what is left of the creative budget.
  const writers = el('div', 'r0-writers');
  writers.dataset.region = R0.whoWrites();
  const head = el('div', 'r0-head');
  head.append(el('h3', null, R0.whoWrites()),
    el('span', 'r0-small', R0.fromBudget({ budget: rupees(CREATIVE_ALLOCATION_PAISE) })));
  writers.append(head);
  for (const option of writerOptions(draft)) {
    const row = el('button', option.on ? 'r0-writer on' : 'r0-writer');
    row.type = 'button';
    row.dataset.key = `writer:${option.id}`;
    row.setAttribute('aria-pressed', String(option.on));
    row.append(
      el('strong', null, option.label),
      el('span', 'r0-writer-price', option.pricePaise === 0 ? R0.free() : rupees(option.pricePaise)),
      el('span', 'r0-small', WHAT[option.id]()),
      el('span', 'r0-writer-grade', option.grade === null ? R0.yourWordsDecide() : R0.runsAt({ grade: option.grade })),
    );
    row.addEventListener('click', () => { if (!option.on) { setWriter(draft, option.id, rootSeed); redraw(); } });
    writers.append(row);
  }
  const left = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;
  writers.append(el('p', 'r0-small', R0.leftover({ amount: rupees(left) })));

  // The ad as searchers meet it, and, when you write it, the boxes.
  const preview = el('div', 'r0-preview');
  const serpHost = el('div');
  preview.append(el('h3', null, R0.asSearchersSee()), serpHost);
  const boxes = el('div', 'r0-boxes');
  const problems = el('ul', 'r0-problems');
  const grades = el('div', 'r0-grades');
  grades.dataset.region = R0.howItRuns({ week: 1 });

  function field(part, index, max, label) {
    const box = el('input', 'kfield');
    box.classList.add('r0-box');
    box.value = draft.ad[part][index];
    box.maxLength = max + OVER_ROOM;
    box.setAttribute('aria-label', label);
    box.dataset.key = `ad:${part}:${index}`;
    const count = el('span', 'r0-count');
    const show = () => {
      count.textContent = R0.charCount({ n: box.value.length, max });
      count.classList.toggle('over', box.value.length > max);
    };
    show();
    box.addEventListener('input', () => { writeAd(draft, part, index, box.value); show(); refresh(); });
    const wrap = el('label', 'r0-field');
    wrap.append(el('span', 'r0-small', label), box, count);
    boxes.append(wrap);
  }

  if (writing) {
    draft.ad.headlines.forEach((_, i) => field('headlines', i, HEADLINE_MAX_CHARS, R0.headlineN({ n: i + 1 })));
    draft.ad.descriptions.forEach((_, i) => field('descriptions', i, DESCRIPTION_MAX_CHARS, R0.descriptionN({ n: i + 1 })));
  }

  function drawSerp() {
    const ad = submittedAd(draft);
    serpHost.replaceChildren(serp({
      domain: brand.domain, headlines: ad.headlines, descriptions: ad.descriptions,
      sponsored: R0.sponsored(), emptyHead: R0.emptyHead(), emptyDesc: R0.emptyDesc(),
    }));
  }

  function drawGrades() {
    const graded = adGrades(draft);
    const source = graded.byWriter
      ? R0.byWriter({ writer: writerTier(draft.writerTier).label.toLowerCase() })
      : R0.byYou();
    const row = (label, value) => {
      const line = el('div', 'r0-grade');
      const track = el('span', 'r0-grade-track');
      const fill = el('span', 'r0-grade-fill');
      fill.style.width = `${(100 * value) / GRADE_SCALE}%`;
      track.append(fill);
      line.append(el('span', 'r0-grade-name', label), el('span', 'r0-small', source), track,
        el('strong', 'r0-grade-value', R0.outOf({ value, scale: GRADE_SCALE })));
      return line;
    };
    const note = el('p', 'r0-small', graded.byWriter ? R0.hiredNote() : R0.diyNote());
    add(note, whyButton(graded.byWriter ? R0.hiredNote : R0.diyNote, openGuide));
    grades.replaceChildren(el('h3', null, R0.howItRuns({ week: 1 })), el('p', 'r0-small', R0.twoParts()),
      row(R0.expectedCtr(), graded.expectedCtr), row(R0.adRelevance(), graded.adRelevance), note);

    // Your own words' problems, as the classic page shows them: the grader's
    // own sentence for each line that breaks Google's limits, and what naming a
    // rival costs. Not the grader's notes as well: they say the same two things
    // again, in the engine's words ("adRelevance penalised by 4").
    problems.replaceChildren();
    if (writing) {
      for (const text of validateAdCopy(submittedAd(draft)).violations) problems.append(el('li', null, text));
      const rival = namesARival(draft.ad, rivalNames);
      if (rival) problems.append(el('li', null, R0.namesRival({ name: rival })));
    }
    problems.hidden = problems.children.length === 0;
  }

  function refresh() {
    drawSerp();
    drawGrades();
    changed();
  }

  drawSerp();
  drawGrades();
  const written = el('div', 'r0-written');
  written.append(preview, boxes, problems);
  const split = el('div', 'r0-ad-split');
  split.append(written, grades);
  node.append(intro, writers, split);
  return { node };
}
