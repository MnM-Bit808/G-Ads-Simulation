/**
 * The playtest recorder (stage B, reviews/slc-review.md).
 *
 * WHY IT EXISTS. The route asks for three strangers to play the live site
 * before stage C rebuilds the screens, so there is a "before" to measure the
 * rebuild against. The one recorded human game was caught by a scratch script
 * injected into the browser pane, which can only watch a player sitting at this
 * machine. A stranger plays in their own browser, so the recording lives here,
 * and they send it back as a file. Nothing is sent anywhere by the page.
 *
 * ONLY THE INVITE LINK SWITCHES IT ON (`?playtest=1`). The ordinary game never
 * creates a recorder, so a player on the plain link runs exactly the game it
 * ran before this file existed.
 *
 * WHAT IT KEEPS is what that recorded game taught was worth keeping: time per
 * phase was the finding (round 0 took 67% of the session, weeks 5-11 took 72s),
 * so time is measured with a hidden tab and an untouched one taken off. Clicks
 * are named by the card they landed in. Keystrokes are COUNTED, never kept —
 * what a player typed into the game is already in their decision log, and
 * anything else they typed is theirs.
 *
 * ITS OWN STORAGE, APART FROM THE SAVE. Round 0 is never saved (a game only
 * exists once the account opens), yet round 0 is where a stranger is most
 * likely to give up. So the recording is written from the first screen on.
 *
 * The recording itself takes its clock and storage as arguments, like
 * `save.js`, and is tested without a browser. `attachRecorder` and the panel at
 * the bottom are the thin part that touches the page.
 */

import { el } from './dom.js';
import { SAVE_KEY } from './save.js';

/** Where the recording is kept, beside the save and never inside it. */
export const RECORDING_KEY = 'g-ads-simulation:playtest';

/** Remembers that this browser came in on the playtest link. */
const MODE_KEY = 'g-ads-simulation:playtest-mode';

/** The shape of a recording, versioned so the reader can refuse a stranger one. */
export const RECORDING_FORMAT = 1;

/**
 * A visible tab with no input for this long is idle rather than being read.
 * Two minutes, because scrolling and moving the pointer count as input and a
 * card of this game takes well under that to read; a player who has not
 * scrolled for two minutes has gone to make tea. A measuring choice, not a
 * number the game runs on (DECISIONS I6).
 */
export const IDLE_AFTER_MS = 120_000;

/**
 * The most one tick may credit. The page ticks every second; a gap longer than
 * this means the page froze, slept or was throttled, and nobody read anything
 * during it.
 */
const MAX_TICK_MS = 5_000;

/** Card time is written every few ticks rather than every second. */
const STORE_EVERY_TICKS = 5;

/** A click's label is cut at this many characters. */
const LABEL_LIMIT = 60;

/**
 * Is this visit a playtest?
 *
 * @param {string} search - `location.search`
 * @param {Storage|null} storage
 * @returns {boolean} true on the invite link, and on every later visit from a
 *   browser that arrived on it, until `?playtest=0`
 */
export function playtestMode(search, storage) {
  const flag = new URLSearchParams(search).get('playtest');
  try {
    if (flag === '1') {
      storage?.setItem(MODE_KEY, '1');
      return true;
    }
    if (flag === '0') {
      storage?.removeItem(MODE_KEY);
      return false;
    }
    return storage?.getItem(MODE_KEY) === '1';
  } catch {
    // A browser that will not store the flag still came in on the link.
    return flag === '1';
  }
}

function emptyRecording(at) {
  return {
    format: RECORDING_FORMAT,
    startedAt: at,
    loads: [],
    phases: [],
    clicks: [],
    weeks: [],
    answers: {},
  };
}

function readRecording(storage, at) {
  try {
    const raw = storage?.getItem(RECORDING_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (stored?.format === RECORDING_FORMAT && Array.isArray(stored.phases)) return stored;
  } catch {
    // Unreadable reads as absent, the same rule the save follows.
  }
  return emptyRecording(at);
}

/**
 * A recorder for one page load, carrying on whatever recording this browser
 * already holds.
 *
 * Every time is wall-clock milliseconds, because a recording spans reloads and
 * `performance.now()` starts again at zero on each.
 *
 * @param {object} deps
 * @param {Storage|null} deps.storage
 * @param {() => number} deps.now - milliseconds
 */
export function createRecorder({ storage, now }) {
  const recording = readRecording(storage, now());
  // Per page load, never stored: they describe this load, not the recording.
  let lastTickAt = now();
  let lastInputAt = now();
  let hiddenSince = null;
  let ticks = 0;

  const store = () => {
    try {
      storage?.setItem(RECORDING_KEY, JSON.stringify(recording));
    } catch {
      // A full or refusing storage still records in memory, and the file
      // carries what memory holds.
    }
  };

  const open = () => {
    const last = recording.phases.at(-1);
    return last && last.endAt === null ? last : null;
  };

  const seen = (at) => {
    const current = open();
    if (current) current.lastSeenAt = at;
  };

  return {
    /**
     * A page load. A phase left open by a reload is closed where it was last
     * seen: what happened between then and the reload is unknown, so it is
     * not counted.
     */
    load() {
      const at = now();
      const current = open();
      if (current) current.endAt = current.lastSeenAt;
      recording.loads.push(at);
      lastTickAt = at;
      lastInputAt = at;
      hiddenSince = null;
      store();
    },

    /** The player is now looking at `name`. The same screen drawn again is not a new phase. */
    phase(name) {
      const at = now();
      const current = open();
      if (current?.name === name) return;
      if (current) current.endAt = at;
      recording.phases.push({
        name,
        startAt: at,
        endAt: null,
        lastSeenAt: at,
        hiddenMs: 0,
        idleMs: 0,
        clicks: 0,
        keys: 0,
        cardMs: {},
      });
      lastTickAt = at;
      lastInputAt = at;
      store();
    },

    /** @param {string} where - from `describeClick` */
    click(where) {
      const at = now();
      const current = open();
      if (current) current.clicks += 1;
      recording.clicks.push({ at, phase: recording.phases.length - 1, where });
      lastInputAt = at;
      seen(at);
      store();
    },

    /** A keystroke. Takes nothing, so what was typed cannot reach the recording. */
    key() {
      const at = now();
      const current = open();
      if (current) current.keys += 1;
      lastInputAt = at;
      seen(at);
    },

    /** Scrolling or moving the pointer: proof someone is there, and nothing more. */
    activity() {
      lastInputAt = now();
    },

    hidden() {
      const at = now();
      hiddenSince = at;
      seen(at);
      store();
    },

    visible() {
      const at = now();
      const current = open();
      if (hiddenSince !== null && current) current.hiddenMs += at - hiddenSince;
      hiddenSince = null;
      lastTickAt = at;
      lastInputAt = at;
      seen(at);
      store();
    },

    /**
     * Called once a second with the titles of the cards on screen. The time
     * since the last tick is credited to each, unless the screen is idle.
     *
     * @param {string[]} cards
     */
    tick(cards) {
      const at = now();
      const current = open();
      const elapsed = at - lastTickAt;
      lastTickAt = at;
      if (!current || hiddenSince !== null) return;

      const counted = Math.min(elapsed, MAX_TICK_MS);
      current.idleMs += elapsed - counted;
      if (at - lastInputAt > IDLE_AFTER_MS) {
        current.idleMs += counted;
      } else {
        for (const card of cards) current.cardMs[card] = (current.cardMs[card] ?? 0) + counted;
      }
      current.lastSeenAt = at;
      ticks += 1;
      if (ticks % STORE_EVERY_TICKS === 0) store();
    },

    /** How long week `week` took to compute, in this browser. */
    week(week, computeMs) {
      recording.weeks.push({ week, computeMs: Math.round(computeMs) });
      store();
    },

    answer(id, text) {
      recording.answers[id] = String(text);
      store();
    },

    /** Write out what the last few ticks and keystrokes have not. */
    flush() {
      store();
    },

    /** A copy of the recording, safe to hand out. */
    log() {
      return JSON.parse(JSON.stringify(recording));
    },
  };
}

const seconds = (ms) => Math.round(ms / 1000);

/**
 * The recording as a table of phases.
 *
 * `activeSeconds` is what the phase took minus the hidden and idle time,
 * which is the figure stage C's gate is written in.
 *
 * @param {object} log - from `recorder.log()`
 * @returns {object[]} one row per phase, in order
 */
export function summarise(log) {
  return log.phases.map((p) => {
    const total = seconds(Math.max(0, (p.endAt ?? p.lastSeenAt) - p.startAt));
    const hiddenSeconds = seconds(p.hiddenMs);
    const idleSeconds = seconds(p.idleMs);
    return {
      name: p.name,
      seconds: total,
      activeSeconds: Math.max(0, total - hiddenSeconds - idleSeconds),
      hiddenSeconds,
      idleSeconds,
      clicks: p.clicks,
      keys: p.keys,
      cards: Object.fromEntries(Object.entries(p.cardMs).map(([card, ms]) => [card, seconds(ms)])),
    };
  });
}

const tidy = (text) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Name a click: the card it landed in, then the control.
 *
 * @param {{card?: string|null, control?: string|null}} parts
 * @returns {string} e.g. "Search terms › Last week"
 */
export function describeClick({ card, control } = {}) {
  const where = tidy(card);
  let label = tidy(control);
  if (label.length > LABEL_LIMIT) label = `${label.slice(0, LABEL_LIMIT - 1)}…`;
  if (where && label) return `${where} › ${label}`;
  return where || label || '(page)';
}

/**
 * Is a card on screen enough to be read?
 *
 * Half of it showing, or — for a card taller than the window — half the
 * window filled by it. A sliver at the edge is not reading.
 *
 * @param {{top: number, bottom: number}} rect - from `getBoundingClientRect`
 * @param {number} viewportHeight
 * @returns {boolean}
 */
export function onScreen(rect, viewportHeight) {
  const height = rect.bottom - rect.top;
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  if (height <= 0 || visible <= 0) return false;
  return visible >= height / 2 || visible >= viewportHeight / 2;
}

/**
 * The saved game exactly as stored, so the reader can replay it through
 * `replayLog`. Not `readSave`, which rebuilds the whole starting state.
 *
 * @param {Storage|null} storage
 * @returns {object|null}
 */
export function savedGameFor(storage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Everything the player sends back, in one object.
 *
 * @param {object} parts
 * @param {object} parts.log - from `recorder.log()`
 * @param {object|null} parts.save - from `savedGameFor`
 * @param {object} parts.environment - browser and screen, to tell a phone from a laptop
 * @returns {object} ready for JSON
 */
export function playtestFile({ log, save, environment }) {
  return {
    format: RECORDING_FORMAT,
    summary: summarise(log),
    answers: log.answers,
    recording: log,
    save: save ?? null,
    environment,
  };
}

/**
 * @param {object} log
 * @returns {string} e.g. "playtest-2026-09-14-0905.json", in UTC
 */
export function playtestFilename(log) {
  const iso = new Date(log.startedAt).toISOString();
  return `playtest-${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}.json`;
}

// ---------------------------------------------------------------------------
// The page. Everything below touches the DOM and is checked by playing it.
// ---------------------------------------------------------------------------

/** A card's own title: its heading's first text, without the grey subtitle. */
function cardTitle(card) {
  if (card.tagName === 'HEADER') return 'header';
  const heading = card.querySelector('h2');
  return tidy(heading?.childNodes[0]?.textContent ?? heading?.textContent);
}

const CONTROL = 'button, a, summary, input, select, textarea, [role="button"]';

function controlLabel(control) {
  if (!control) return '';
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) {
    return control.closest('label')?.querySelector('.field-label')?.textContent
      || control.getAttribute('aria-label')
      || control.getAttribute('placeholder')
      || control.name
      || control.type;
  }
  // innerText, not textContent: a brand button holds "Kestrel" and
  // "kestrel.in" in two blocks, which textContent runs together.
  return control.innerText || control.textContent;
}

/**
 * Wire a recorder to the page.
 *
 * @param {ReturnType<typeof createRecorder>} recorder
 */
export function attachRecorder(recorder) {
  // Capture phase, so a control that stops the click from bubbling is still counted.
  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('.card, header');
    recorder.click(describeClick({
      card: card ? cardTitle(card) : null,
      control: controlLabel(event.target.closest?.(CONTROL)),
    }));
  }, true);
  document.addEventListener('keydown', () => recorder.key(), true);
  for (const type of ['pointermove', 'wheel', 'scroll', 'touchstart']) {
    window.addEventListener(type, () => recorder.activity(), { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) recorder.hidden();
    else recorder.visible();
  });
  // A link opened in a background tab starts hidden and fires no event until
  // it is looked at, so without this the wait would count as reading.
  if (document.hidden) recorder.hidden();
  window.addEventListener('pagehide', () => recorder.flush());

  setInterval(() => {
    if (document.hidden) return;
    const cards = [...document.querySelectorAll('.card')]
      .filter((card) => onScreen(card.getBoundingClientRect(), window.innerHeight))
      .map(cardTitle)
      .filter(Boolean);
    recorder.tick(cards);
  }, 1000);
}

/**
 * Hand the player their file. A download rather than an upload: the page sends
 * nothing anywhere, and the player chooses whether to pass it on.
 *
 * @param {ReturnType<typeof createRecorder>} recorder
 * @param {Storage|null} storage
 */
export function downloadPlaytestFile(recorder, storage) {
  recorder.flush();
  const log = recorder.log();
  const file = playtestFile({
    log,
    save: savedGameFor(storage),
    environment: {
      userAgent: navigator.userAgent,
      viewport: [window.innerWidth, window.innerHeight],
      screen: [window.screen.width, window.screen.height],
    },
  });
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = playtestFilename(log);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function answerBox(recorder, id, question, rows) {
  const wrap = el('label', 'field');
  wrap.append(el('span', 'field-label', question));
  const box = el('textarea');
  box.rows = rows;
  box.value = recorder.log().answers[id] ?? '';
  box.addEventListener('input', () => recorder.answer(id, box.value));
  wrap.append(box);
  return wrap;
}

/**
 * The panel a playtester meets after the end screen: two questions and the file.
 *
 * @param {object} ctx
 * @param {ReturnType<typeof createRecorder>} ctx.recorder
 * @param {() => void} ctx.onDownload
 * @returns {HTMLElement}
 */
export function renderPlaytestPanel({ recorder, onDownload }) {
  const node = el('article', 'card span-4 playtest');
  node.id = 'playtest-panel';
  const heading = el('h2', null, 'Before you go');
  heading.append(el('span', 'muted', 'for the playtest only'));
  node.append(heading);
  node.append(
    answerBox(recorder, 'lessons', 'What three things did this game teach you? In your own words.', 5),
    answerBox(recorder, 'confusing', 'What confused or annoyed you?', 3),
  );
  node.append(el('p', 'note',
    'The file holds how long you spent on each screen, what you clicked, how many '
    + 'keys you pressed (not what they were), your answers, your saved game and your '
    + 'browser and screen size. Nothing has been sent anywhere: download it and send it back.'));
  const button = el('button', null, 'Download the playtest file');
  button.type = 'button';
  button.addEventListener('click', onDownload);
  node.append(button);
  return node;
}
