import express from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import path from 'node:path'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { isAllowedOrigin } from './utils/corsOrigins.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) }))
  app.use(pinoHttp({ logger }))
  app.use(express.json())
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), config.upload.dir), { dotfiles: 'deny', index: false }),
  )

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
