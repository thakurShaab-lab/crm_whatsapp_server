import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDateWindow, DAYS_PER_PAGE } from './dateWindow.js'

// `toISOString()` converts to UTC first, which shifts the calendar date under any
// non-UTC local timezone — these boundaries are deliberately local-midnight-aligned
// (see dateWindow.js), so assertions must read the date back using local getters too.
function localDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

test('first page (no cursor) covers today plus the 2 previous calendar days', () => {
  const now = new Date('2026-01-12T15:30:00')
  const { fromBoundary, toBoundary } = computeDateWindow(null, now)

  // toBoundary is exclusive — midnight starting the 13th, so the 12th is fully included.
  assert.equal(localDateString(toBoundary), '2026-01-13')
  assert.equal(localDateString(fromBoundary), '2026-01-10')

  const spanDays = (toBoundary - fromBoundary) / (24 * 3_600_000)
  assert.equal(spanDays, DAYS_PER_PAGE)
})

test('a subsequent page uses the previous fromBoundary as the new toBoundary, with no gap or overlap', () => {
  const now = new Date('2026-01-12T15:30:00')
  const page1 = computeDateWindow(null, now)
  const page2 = computeDateWindow(page1.fromBoundary)

  // The two windows must be exactly adjacent: page2 ends precisely where page1 begins.
  assert.equal(page2.toBoundary.getTime(), page1.fromBoundary.getTime())
  assert.equal(localDateString(page2.toBoundary), '2026-01-10')
  assert.equal(localDateString(page2.fromBoundary), '2026-01-07')
})

test('window boundaries land exactly on local midnight, regardless of the input time-of-day', () => {
  const { fromBoundary, toBoundary } = computeDateWindow(null, new Date('2026-06-01T23:59:59'))
  for (const boundary of [fromBoundary, toBoundary]) {
    assert.equal(boundary.getHours(), 0)
    assert.equal(boundary.getMinutes(), 0)
    assert.equal(boundary.getSeconds(), 0)
    assert.equal(boundary.getMilliseconds(), 0)
  }
})

test('repeated paging never re-covers a calendar day already returned', () => {
  const now = new Date('2026-03-15T09:00:00')
  let cursor = null
  const seenDates = new Set()

  for (let page = 0; page < 5; page++) {
    const { fromBoundary, toBoundary } = computeDateWindow(cursor, now)
    for (let d = new Date(fromBoundary); d < toBoundary; d.setDate(d.getDate() + 1)) {
      const key = localDateString(d)
      assert.ok(!seenDates.has(key), `day ${key} was already covered by an earlier page`)
      seenDates.add(key)
    }
    cursor = fromBoundary
  }

  assert.equal(seenDates.size, 5 * DAYS_PER_PAGE)
})

test('an empty toBoundaryInput and a genuinely absent cursor behave identically (both mean "first page")', () => {
  const now = new Date('2026-01-12T15:30:00')
  const a = computeDateWindow(null, now)
  const b = computeDateWindow(undefined, now)
  assert.equal(a.fromBoundary.getTime(), b.fromBoundary.getTime())
  assert.equal(a.toBoundary.getTime(), b.toBoundary.getTime())
})
