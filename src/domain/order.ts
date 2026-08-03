/**
 * Fractional ordering.
 *
 * Dropping a task between two others should touch one record, not renumber the
 * whole day — otherwise every drag rewrites the entire list and undo has to
 * remember all of it. So positions are floats and an insertion takes the
 * midpoint of its neighbours.
 *
 * Midpoints run out of float precision after roughly fifty consecutive drops
 * into the same gap. `needsRenormalisation` catches that before it becomes a
 * silent ordering bug, and the caller renumbers the day once.
 */

const GAP = 1024
const MIN_GAP = 1e-6

/** Position for a task appended after `orders` (which need not be sorted). */
export function orderAtEnd(orders: number[]): number {
  return orders.length === 0 ? GAP : Math.max(...orders) + GAP
}

/** Position for a task prepended before `orders`. */
export function orderAtStart(orders: number[]): number {
  return orders.length === 0 ? GAP : Math.min(...orders) - GAP
}

/**
 * Position between two neighbours. `before`/`after` are the orders of the
 * items on either side; `null` means the edge of the list.
 */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return GAP
  if (before === null) return after! - GAP
  if (after === null) return before + GAP
  return (before + after) / 2
}

/** True once neighbours are too close for another midpoint to land between them. */
export function needsRenormalisation(orders: number[]): boolean {
  const sorted = [...orders].sort((a, b) => a - b)
  return sorted.some((value, i) => i > 0 && value - sorted[i - 1]! < MIN_GAP)
}

/** Evenly respaced positions, preserving the current sequence. */
export function renormalise<T extends { id: string; order: number }>(
  items: T[],
): Record<string, number> {
  return Object.fromEntries(
    [...items].sort((a, b) => a.order - b.order).map((item, index) => [item.id, (index + 1) * GAP]),
  )
}
