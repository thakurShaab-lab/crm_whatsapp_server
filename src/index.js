import { createServer } from 'node:http'
import { createApp } from './app.js'
import { initSocket } from './socket/io.js'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'

const app = createApp()
const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(config.port, '127.0.0.1', () => {
  logger.info(`server listening on http://localhost:${config.port}`)
})
