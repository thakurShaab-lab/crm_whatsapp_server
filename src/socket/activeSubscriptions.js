// Tracks which mobile (contact) each connected socket currently has open, so an
// inbound message for an already-open thread can be auto-marked read instead of
// bumping the unread badge. In-memory/single-process only — fine for this build;
// would need a shared store behind a Socket.IO adapter to scale horizontally.

const mobileBySocket = new Map() // socketId -> mobile
const socketsByWaMobile = new Map() // `${waNumber}:${mobile}` -> Set<socketId>

function key(waNumber, mobile) {
  return `${waNumber}:${mobile}`
}

export function subscribe(waNumber, mobile, socketId) {
  unsubscribe(socketId)
  mobileBySocket.set(socketId, { waNumber, mobile })
  const k = key(waNumber, mobile)
  if (!socketsByWaMobile.has(k)) socketsByWaMobile.set(k, new Set())
  socketsByWaMobile.get(k).add(socketId)
}

export function unsubscribe(socketId) {
  const previous = mobileBySocket.get(socketId)
  if (!previous) return
  const k = key(previous.waNumber, previous.mobile)
  socketsByWaMobile.get(k)?.delete(socketId)
  mobileBySocket.delete(socketId)
}

export function isContactActive(waNumber, mobile) {
  const sockets = socketsByWaMobile.get(key(waNumber, mobile))
  return Boolean(sockets && sockets.size > 0)
}
