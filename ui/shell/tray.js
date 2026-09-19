/**
 * The tray's lines (plans/2026-09-13-studio-makeover.md, section 2): every
 * change in the draft, from `changes(draft)`, oldest first.
 *
 * A line keeps the place it first appeared in. So a new change always lands at
 * the end, which is the one line the tray animates in, and a line whose figures
 * move mid-drag (₹33 → ₹25 → ₹20) never moves.
 */

/**
 * @param {Array<{id: string, label: string, detail: string, undo: Function|null}>} rows
 * @param {string[]} [previousOrder] - ids, in the order they first appeared
 * @returns {{lines: Array<{id: string, text: string, detail: string, undo: Function|null}>, order: string[]}}
 */
export function trayLines(rows, previousOrder = []) {
  const present = new Map(rows.map((row) => [row.id, row]));
  const order = previousOrder.filter((id) => present.has(id));
  for (const row of rows) if (!order.includes(row.id)) order.push(row.id);
  return {
    lines: order.map((id) => {
      const row = present.get(id);
      return { id, text: row.label, detail: row.detail, undo: row.undo ?? null };
    }),
    order,
  };
}

/**
 * WHAT WEEK 5 STILL HAS OPEN, and whether running past it should ask first.
 *
 * Pure, because the decision has three inputs and no DOM: which halves of the
 * window are open, whether anything has been committed to them already, and
 * whether Your money has been opened in this week. The last one is the whole
 * point — a player who looked and chose to skip is not asked again, and one
 * who never looked is asked once (the owner's choice, 2026-09-19).
 *
 * @param {object} at
 * @param {boolean} at.capexOpen - capital can still be committed this week
 * @param {boolean} at.repositionOpen - the brand can still be moved this week
 * @param {boolean} at.decided - something is already staged against the window
 * @param {boolean} at.seenThisWeek - Your money has been opened since the week turned
 * @returns {{open: boolean, half: 'both'|'capital'|'move'|null, asks: boolean}}
 */
export function capitalWindow({ capexOpen, repositionOpen, decided, seenThisWeek }) {
  const half = (capexOpen && repositionOpen && 'both')
    || (capexOpen && 'capital')
    || (repositionOpen && 'move')
    || null;
  return {
    open: half !== null,
    half,
    // Nothing staged and never looked: the one case where running is a choice
    // the player has not knowingly made.
    asks: half !== null && !decided && !seenThisWeek,
  };
}
