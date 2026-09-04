import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `dotenv/config`'s default behavior resolves `.env` relative to `process.cwd()` —
// wherever the process happened to be launched from (e.g. a process manager like pm2
// can launch it from a different working directory than this project's root), which
// silently loads nothing and leaves every DB_* var undefined. Resolving the path from
// this file's own location instead makes it independent of how/where it's started.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required env var ${name} — check that server/.env exists and is actually being loaded ` +
        `(if you're using pm2, this is often a working-directory mismatch).`,
    )
  }
  return value
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3009),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'https://crm-whatsapp-client.vercel.app, http://localhost:5173/')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: required('DB_HOST'),
    port: int(process.env.DB_PORT, 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME'),
  },
  // Stand-in for real auth: every request acts as this single configured agent
  // (an existing tbl_employees row) rather than a logged-in session.
  defaultEmployeeId: int(process.env.DEFAULT_EMPLOYEE_ID, 6260),
  defaultUserAdminId: int(process.env.DEFAULT_USER_ADMIN_ID, 6260),
  upload: {
    maxImageBytes: int(process.env.UPLOAD_MAX_IMAGE_MB, 5) * 1024 * 1024,
    maxVideoBytes: int(process.env.UPLOAD_MAX_VIDEO_MB, 16) * 1024 * 1024,
    maxDocumentBytes: int(process.env.UPLOAD_MAX_DOCUMENT_MB, 100) * 1024 * 1024,
    maxAudioBytes: int(process.env.UPLOAD_MAX_AUDIO_MB, 16) * 1024 * 1024,
    dir: process.env.UPLOAD_DIR || 'uploads',
  },
  // Vendor APIs fetch media attachments themselves from a URL — they can't reach
  // `localhost`, so uploaded files need a real public HTTPS origin to be usable in
  // an outbound media message. Unset until this server has one.
  publicMediaBaseUrl: process.env.PUBLIC_MEDIA_BASE_URL || null,
}
