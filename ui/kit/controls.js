/**
 * The Studio kit's controls (plans/2026-09-13-studio-makeover.md, section 3).
 * Plain elements, each with its words handed in, so a control never holds a
 * sentence. A control that changes itself (the switch, the slider) does so in
 * place: redrawn under a finger, a drag would end.
 */

import { el } from '../dom.js';
import { ICON_BOX } from '../shell/sections.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A stroked icon from a list of paths (ui/shell/sections.js, ICONS). */
export function icon(paths) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', ICON_BOX);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('studio-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** A button that is never a form's submit. */
export function button(className, ...children) {
  const node = el('button', className);
  node.type = 'button';
  node.append(...children);
  return node;
}

/** One choice from a few, as radio buttons. */
export function pills({ options, value, label, onPick, keyPrefix = null }) {
  const group = el('div', 'kpills');
  group.setAttribute('role', 'radiogroup');
  if (label) group.setAttribute('aria-label', label);
  for (const [optionValue, text] of options) {
    const pill = el('button', 'kpill', text);
    pill.type = 'button';
    pill.setAttribute('role', 'radio');
    pill.setAttribute('aria-checked', String(optionValue === value));
    if (keyPrefix) pill.dataset.key = `${keyPrefix}:${optionValue}`;
    pill.addEventListener('click', () => { if (optionValue !== value) onPick(optionValue); });
    group.append(pill);
  }
  return group;
}

/** An on/off switch with its state written beside it; it flips in place. */
export function toggle({ on, labelOn, labelOff, titleOn, titleOff, onToggle }) {
  const node = el('button', 'ktoggle');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  const track = el('span', 'ktoggle-track');
  track.append(el('span', 'ktoggle-knob'));
  const label = el('span', 'ktoggle-label');
  node.append(track, label);
  let state = on;
  const show = () => {
    node.setAttribute('aria-checked', String(state));
    label.textContent = state ? labelOn : labelOff;
    node.title = state ? titleOn : titleOff;
  };
  show();
  node.addEventListener('click', () => { state = !state; show(); onToggle(state); });
  return node;
}

/** A number over its label. */
export function stat(value, label) {
  const box = el('div', 'kstat');
  box.append(el('div', 'kstat-value', value), el('div', 'kstat-label', label));
  return box;
}

/**
 * A slider in whole rupees, with the week's starting value marked. `onInput`
 * fires while dragging; the caller updates figures in place. `onSettle` fires
 * once the finger lifts (or a key moves it), for work too heavy for every step.
 *
 * THE TRACK IS DRAWN, AND IT CARRIES THE RESERVE (2026-09-25, design option C).
 * Until now this was the browser's own control with `accent-color` set, so it
 * looked different on every machine and said nothing about the bid. It now
 * paints its own rail and filled part, and — when `floorRupees` is given —
 * hatches the stretch below the reserve, the bid under which the ad enters
 * every auction and shows in none.
 *
 * WHY THE FLOOR BELONGS ON THE TRACK. The card already knows that number and
 * only ever said it AFTERWARDS, in a warning that appears once the bid is
 * already too low. `AD_RANK_FLOOR` is a reserve and not an eligibility gate, so
 * an advertiser under it reports "lost to rank 100%" — which reads as being
 * outbid and sends a beginner to raise the one lever that cannot help
 * (`HANDOVER.md`, *The one that will cost you an afternoon*). Drawing it turns
 * a trap you fall into into a cliff you can see.
 *
 * The position work is CSS custom properties rather than elements, so a drag
 * repaints without touching the DOM — the same reason `was` is positioned by
 * percentage. The native input stays underneath it: keyboard, focus ring and
 * screen readers are the browser's, and only the paint is ours.
 *
 * @param {object} args
 * @param {number|null} [args.floorRupees] - the reserve, or null when there is
 *   no bid to set (Smart Bidding, or a paused keyword)
 */
export function slider({
  minRupees, maxRupees, valueRupees, wasRupees = null, floorRupees = null,
  label, onInput, onSettle = null,
}) {
  const box = el('div', 'kslider');
  const range = el('input');
  range.type = 'range';
  range.min = String(minRupees);
  range.max = String(maxRupees);
  range.step = '1';
  range.value = String(valueRupees);
  range.setAttribute('aria-label', label);
  const was = el('span', 'kslider-was');
  const floor = el('span', 'kslider-floor');

  const at = (value) => (100 * (value - minRupees)) / (maxRupees - minRupees);
  const clamp = (percent) => Math.max(0, Math.min(100, percent));

  const paint = (value) => { box.style.setProperty('--kslider-fill', `${clamp(at(value))}%`); };
  const showWas = (value) => {
    was.hidden = value === null;
    if (value !== null) was.style.left = `${clamp(at(value))}%`;
  };
  const showFloor = (value) => {
    // A reserve at or under the left end is not a cliff, it is the whole track.
    const known = value !== null && value > minRupees;
    floor.hidden = !known;
    box.classList.toggle('has-floor', known);
    if (known) box.style.setProperty('--kslider-floor', `${clamp(at(value))}%`);
  };

  paint(valueRupees);
  showWas(wasRupees);
  showFloor(floorRupees);
  range.addEventListener('input', () => { paint(Number(range.value)); onInput(Number(range.value)); });
  if (onSettle) range.addEventListener('change', () => onSettle(Number(range.value)));
  box.append(range, floor, was);
  return { node: box, range, showWas, showFloor };
}

/**
 * A figure that becomes a box to type in when tapped: a slider alone is too
 * coarse for a bid. `value` may be a function, read when the box opens: a
 * slider beside it changes the figure in place, and the box must open on what
 * the figure says now, not on what it said when it was drawn.
 */
export function typeIn({ text, value, label, onCommit }) {
  const shown = el('button', 'kbid', text);
  shown.type = 'button';
  shown.title = label;
  shown.addEventListener('click', () => {
    const box = el('input', 'kfield kbid-input');
    box.type = 'number';
    box.min = '1';
    box.step = '1';
    box.value = String(typeof value === 'function' ? value() : value);
    box.setAttribute('aria-label', label);
    let done = false;
    // Enter and Escape put focus back on the figure BEFORE the caller redraws,
    // so a redraw that keeps the reader's place by data-key finds it there. A
    // blur does not: focus went where the reader clicked, and stays there.
    const finish = (commit, refocus) => {
      if (done) return;
      done = true;
      const typed = Math.round(Number(box.value));
      box.replaceWith(shown);
      if (refocus) shown.focus();
      if (commit && Number.isFinite(typed) && typed >= 1) onCommit(typed);
    };
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true, true);
      if (event.key === 'Escape') finish(false, true);
    });
    box.addEventListener('blur', () => finish(true, false));
    shown.replaceWith(box);
    box.focus();
    box.select();
  });
  return shown;
}
