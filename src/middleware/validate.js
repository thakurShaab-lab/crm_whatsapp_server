import { HttpError } from './errorHandler.js'

// Express 5's req.query is a getter-only accessor on the request prototype, so it
// can't be reassigned directly (`req.query = x` throws) — parsed values are mutated
// into the existing object instead. req.body/req.params remain plain assignable
// properties, so those are reassigned as usual.
function applyParsedQuery(req, parsed) {
  for (const key of Object.keys(req.query)) delete req.query[key]
  Object.assign(req.query, parsed)
}

export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {})
      if (query) applyParsedQuery(req, query.parse(req.query))
      if (params) req.params = params.parse(req.params)
      next()
    } catch (error) {
      next(new HttpError(400, 'Validation failed', error.issues || error.errors || String(error)))
    }
  }
}
