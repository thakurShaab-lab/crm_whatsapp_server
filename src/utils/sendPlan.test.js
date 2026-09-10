import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSendPlan } from './sendPlan.js'

const FAKE_IMAGE = { type: 'I', mime: 'image/jpeg', url: '/uploads/media/userfolder_1/whatsapp_sent_file/a.jpg', originalFilename: 'a.jpg' }
const FAKE_IMAGE_2 = { type: 'I', mime: 'image/jpeg', url: '/uploads/media/userfolder_1/whatsapp_sent_file/b.jpg', originalFilename: 'b.jpg' }

test('text only: one text message, no media', () => {
  const plan = buildSendPlan({ text: 'Hello', files: [] })
  assert.deepEqual(plan, [{ kind: 'text', text: 'Hello' }])
})

test('image only (no text): one media message, no caption', () => {
  const plan = buildSendPlan({ text: '', files: [FAKE_IMAGE] })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].kind, 'media')
  assert.equal(plan[0].media, FAKE_IMAGE)
  assert.equal(plan[0].caption, null)
})

test('image + caption: exactly ONE media message carrying the caption — never a separate text message', () => {
  const plan = buildSendPlan({ text: 'Check this out!', files: [FAKE_IMAGE] })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].kind, 'media')
  assert.equal(plan[0].caption, 'Check this out!')
  // The key requirement, made explicit: no plan item is ever a standalone text message
  // when at least one file is attached.
  assert.ok(!plan.some((item) => item.kind === 'text'))
})

test('whitespace-only text + image is treated as image-only (no caption)', () => {
  const plan = buildSendPlan({ text: '   \n\t  ', files: [FAKE_IMAGE] })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].caption, null)
})

test('multiline caption and emoji are preserved verbatim (only surrounding whitespace is trimmed)', () => {
  const plan = buildSendPlan({ text: '  Line one\nLine two 🎉  ', files: [FAKE_IMAGE] })
  assert.equal(plan[0].caption, 'Line one\nLine two 🎉')
})

test('multiple images + one caption: only the first file gets the caption, never a separate text message', () => {
  const plan = buildSendPlan({ text: 'Group caption', files: [FAKE_IMAGE, FAKE_IMAGE_2] })
  assert.equal(plan.length, 2)
  assert.equal(plan[0].caption, 'Group caption')
  assert.equal(plan[1].caption, null)
  assert.ok(!plan.some((item) => item.kind === 'text'))
})

test('no text and no files: an empty plan (caller rejects this as a 400)', () => {
  assert.deepEqual(buildSendPlan({ text: '', files: [] }), [])
  assert.deepEqual(buildSendPlan({ text: undefined, files: undefined }), [])
})
