import { config } from '../config/index.js'
import { findEmployeeById } from '../models/employeesModel.js'
import { waRoom } from './io.js'
import { subscribe, unsubscribe } from './activeSubscriptions.js'
import { logger } from '../utils/logger.js'

// Stand-in for real auth: every socket belongs to the single configured employee's
// WhatsApp number. Resolved once and cached — it never changes at runtime.
let waNumberPromise = null
function getWaNumber() {
  if (!waNumberPromise) {
    waNumberPromise = findEmployeeById(config.defaultEmployeeId).then((employee) => employee.whatsappWabano)
  }
  return waNumberPromise
}

export function registerConnectionHandler(io) {
  io.on('connection', async (socket) => {
    const waNumber = await getWaNumber()
    socket.join(waRoom(waNumber))
    logger.debug({ socketId: socket.id }, 'socket connected')

    socket.on('conversation:subscribe', ({ mobile }) => {
      if (mobile != null) subscribe(waNumber, mobile, socket.id)
    })

    socket.on('conversation:unsubscribe', () => {
      unsubscribe(socket.id)
    })

    socket.on('disconnect', () => {
      unsubscribe(socket.id)
      logger.debug({ socketId: socket.id }, 'socket disconnected')
    })
  })
}
