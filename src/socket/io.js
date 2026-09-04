import { Server } from 'socket.io'
import { registerConnectionHandler } from './connectionHandler.js'
import { isAllowedOrigin } from '../utils/corsOrigins.js'

let io = null

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) },
  })
  registerConnectionHandler(io)
  return io
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized yet')
  return io
}

export function waRoom(waNumber) {
  return `wa:${waNumber}`
}
