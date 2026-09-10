import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toMessageDto } from './mappers.js'

const BASE_ROW = {
  sl: 1,
  mobile: '919999900000',
  msgtype: 'R',
  status: 'Y',
  sourceId: 'wamid.abc',
  recvDate: new Date('2026-01-01T10:00:00.000Z'),
}

test('image message with a caption: media.filename keeps the original filename, text carries the caption', () => {
  const dto = toMessageDto({
    ...BASE_ROW,
    type: 'I',
    text: 'photo.jpg', // media rows store the original filename here, not the caption
    actualName: 'Check this out!',
    imageUrl: '/uploads/media/userfolder_1/whatsapp_sent_file/photo.jpg',
  })

  assert.equal(dto.type, 'image')
  assert.equal(dto.text, 'Check this out!')
  assert.equal(dto.media.filename, 'photo.jpg')
  assert.equal(dto.media.url, '/uploads/media/userfolder_1/whatsapp_sent_file/photo.jpg')
})

test('image message with no caption: text is null so the caption area renders nothing', () => {
  const dto = toMessageDto({
    ...BASE_ROW,
    type: 'I',
    text: 'photo.jpg',
    actualName: null,
    imageUrl: '/uploads/media/userfolder_1/whatsapp_sent_file/photo.jpg',
  })

  assert.equal(dto.text, null)
  assert.equal(dto.media.filename, 'photo.jpg') // filename must still show up even without a caption
})

test('multiline + emoji captions survive the mapping untouched', () => {
  const dto = toMessageDto({
    ...BASE_ROW,
    type: 'I',
    text: 'photo.jpg',
    actualName: 'Line one\nLine two 🎉',
    imageUrl: '/uploads/media/userfolder_1/whatsapp_sent_file/photo.jpg',
  })

  assert.equal(dto.text, 'Line one\nLine two 🎉')
})

test('a plain text message is unaffected by the caption column (even if somehow set)', () => {
  const dto = toMessageDto({
    ...BASE_ROW,
    type: 'T',
    text: 'Hello there',
    actualName: 'should never surface for a text message',
    imageUrl: '',
  })

  assert.equal(dto.type, 'text')
  assert.equal(dto.text, 'Hello there')
  assert.equal(dto.media, null)
})
