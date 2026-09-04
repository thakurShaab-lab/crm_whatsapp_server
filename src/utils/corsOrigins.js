import { config } from '../config/index.js'

// Every Vercel deployment (production and every preview build) gets its own
// `<project>-<hash>-<team>.vercel.app` subdomain — these are Vercel-issued, not
// attacker-controlled, so allowing the whole pattern avoids needing a new explicit
// CORS entry on every single preview deploy.
const VERCEL_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i

// A browser's `Origin` header never carries a trailing slash, but it's an easy typo
// to leave one on a configured value — normalize both sides so that mismatch can't
// silently reject a legitimate origin.
function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

/** Shared by the REST `cors` middleware and Socket.IO's own CORS config. */
export function isAllowedOrigin(origin) {
  if (!origin) return true // same-origin requests, curl, server-to-server — no Origin header at all
  const normalized = stripTrailingSlash(origin)
  return config.clientOrigins.map(stripTrailingSlash).includes(normalized) || VERCEL_ORIGIN_PATTERN.test(normalized)
}
