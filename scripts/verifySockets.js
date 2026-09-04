// Throwaway verification script for Phase 4 (not part of the app). Connects a
// socket, subscribes to a contact's thread, then expects the caller to trigger a
// send + a delivered/read simulate-webhook call against that contact while this
// script is running, and prints every event it receives so we can confirm the
// contract (no polling involved).
import { io } from 'socket.io-client'

const contactId = Number(process.argv[2] || 4)
const socket = io('http://localhost:4000')

socket.on('connect', () => {
  console.log('connected', socket.id)
  socket.emit('conversation:subscribe', { contactId })
  console.log('subscribed to contact', contactId)
})

for (const event of ['conversation:new_message', 'message:status_update', 'conversation:read']) {
  socket.on(event, (payload) => console.log(event, JSON.stringify(payload)))
}

setTimeout(() => {
  console.log('done listening')
  process.exit(0)
}, 8000)
