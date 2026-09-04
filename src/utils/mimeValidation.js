import fileTypePkg from 'file-type'
import { config } from '../config/index.js'

// file-type@16 (the last CommonJS-compatible major; v17+ dropped CJS) exposes
// `fromBuffer`, not the `fileTypeFromBuffer` name used by its later ESM-only versions.
const { fromBuffer: fileTypeFromBuffer } = fileTypePkg

// Matches the legacy `type` column: I=Image, V=Video, D=Document, A=Audio.
const ALLOWLIST = {
  I: {
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    maxBytes: config.upload.maxImageBytes,
  },
  V: {
    mimes: new Set(['video/mp4', 'video/3gpp', 'video/quicktime']),
    maxBytes: config.upload.maxVideoBytes,
  },
  D: {
    mimes: new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
    ]),
    maxBytes: config.upload.maxDocumentBytes,
  },
  A: {
    mimes: new Set(['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav']),
    maxBytes: config.upload.maxAudioBytes,
  },
}

function messageTypeForMime(mime) {
  for (const [type, rule] of Object.entries(ALLOWLIST)) {
    if (rule.mimes.has(mime)) return type
  }
  return null
}

/**
 * Server-authoritative validation: sniffs real magic bytes rather than trusting the
 * client-declared MIME/extension (the legacy app validated file type in JS only,
 * which is trivially bypassable). `text/plain` has no reliable magic-byte signature,
 * so it falls back to the client-declared MIME for that one case only.
 */
export async function detectAndValidateUpload(buffer, declaredMime) {
  const sniffed = await fileTypeFromBuffer(buffer)
  const mime = sniffed?.mime || (declaredMime === 'text/plain' ? 'text/plain' : null)

  if (!mime) {
    return { ok: false, reason: 'Unable to determine file type' }
  }

  const type = messageTypeForMime(mime)
  if (!type) {
    return { ok: false, reason: `File type "${mime}" is not allowed` }
  }

  const { maxBytes } = ALLOWLIST[type]
  if (buffer.length > maxBytes) {
    return { ok: false, reason: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit for ${type}` }
  }

  return { ok: true, type, mime, sizeBytes: buffer.length }
}

export const uploadLimits = ALLOWLIST
