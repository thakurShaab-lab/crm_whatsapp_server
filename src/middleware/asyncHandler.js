// Express 5 forwards rejected promises to error middleware automatically, but keeping
// this thin wrapper makes the intent explicit and protects against any handler that
// isn't declared async but still returns a rejected promise.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
