import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeCaption } from './sanitize.js'

test('trims surrounding whitespace and keeps internal newlines', () => {
  assert.equal(sanitizeCaption('  Check this out!\nSecond line  '), 'Check this out!\nSecond line')
})

test('empty or whitespace-only input becomes null (image-only, no caption)', () => {
  assert.equal(sanitizeCaption(''), null)
  assert.equal(sanitizeCaption('   \n\t  '), null)
  assert.equal(sanitizeCaption(null), null)
  assert.equal(sanitizeCaption(undefined), null)
})

test('emoji and normal text are preserved as-is under the length limit', () => {
  assert.equal(sanitizeCaption('Great shot! 🎉📸'), 'Great shot! 🎉📸')
})

test('truncates to the actual_name column\'s 255-character limit without splitting a surrogate-pair emoji at the boundary', () => {
  // 254 plain characters + one 2-code-unit emoji straddling position 255 — a naive
  // `.slice(0, 255)` (UTF-16 code units) would cut the emoji's surrogate pair in
  // half; sanitizeCaption counts whole code points instead.
  const longCaption = 'a'.repeat(254) + '🎉' + 'b'.repeat(10)
  const result = sanitizeCaption(longCaption)

  assert.equal([...result].length, 255)
  // No lone/broken surrogate half anywhere in the result.
  assert.equal(result, 'a'.repeat(254) + '🎉')
})

test('a caption exactly at the limit is not truncated', () => {
  const exact = 'x'.repeat(255)
  assert.equal(sanitizeCaption(exact), exact)
})
