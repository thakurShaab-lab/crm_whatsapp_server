import { logger } from '../utils/logger.js'

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500
  if (status >= 500) {
    logger.error({ err }, 'unhandled error')
  }

  res.status(status).json({
    error: {
      message: status >= 500 ? 'Internal server error' : err.message,
      details: err.details,
    },
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Not found' } })
}
