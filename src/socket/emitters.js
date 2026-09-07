import { getIO, waRoom } from './io.js'

export function emitNewMessage(waNumber, { mobile, message, conversation }) {
  getIO().to(waRoom(waNumber)).emit('conversation:new_message', { mobile, message, conversation })
}

export function emitStatusUpdate(waNumber, payload) {
  getIO().to(waRoom(waNumber)).emit('message:status_update', payload)
}

export function emitConversationRead(waNumber, payload) {
  getIO().to(waRoom(waNumber)).emit('conversation:read', payload)
}

export function emitConversationDeleted(waNumber, payload) {
  getIO().to(waRoom(waNumber)).emit('conversation:deleted', payload)
}
