export const DAYS_PER_PAGE = 3

/** Midnight of the calendar day after `date`, in the server's local timezone (same "no explicit TZ conversion" convention every other date computation in this app already uses — see mappers.js's isWindowExpired). */
function startOfNextLocalDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + 1)
  return next
}

/**
 * A calendar-day-aligned pagination window: `toBoundary` is the exclusive upper
 * bound, `fromBoundary` is exactly `DAYS_PER_PAGE` calendar days earlier — so the
 * range `[fromBoundary, toBoundary)` always covers exactly 3 whole calendar days,
 * regardless of how many (or how few) messages fall on any of them.
 *
 * `toBoundaryInput` is `null` for the very first page (meaning "through the end of
 * today"), or the previous page's `fromBoundary` for every subsequent "load more" —
 * so pages tile the calendar exactly, with no gap or overlap between them even when
 * a day in between had zero messages.
 */
export function computeDateWindow(toBoundaryInput, now = new Date()) {
  const toBoundary = toBoundaryInput ? new Date(toBoundaryInput) : startOfNextLocalDay(now)
  const fromBoundary = new Date(toBoundary)
  fromBoundary.setDate(fromBoundary.getDate() - DAYS_PER_PAGE)
  return { fromBoundary, toBoundary }
}
