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
