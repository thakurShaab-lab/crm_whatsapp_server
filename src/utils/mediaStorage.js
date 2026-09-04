import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { detectAndValidateUpload } from './mimeValidation.js'

export const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

/**
 * Validates each uploaded file's real content (magic-byte sniffed, never the
 * client-declared MIME/extension) and persists it under a UUID filename to prevent
 * path traversal/collisions. Returns the legacy single-letter `type` code (I/V/A/D)
 * alongside the servable URL, ready to store directly on a message row.
 *
 * Folder/URL shape matches the legacy convention (`userfolder_<user_admin_id>/
 * whatsapp_sent_file/<filename>`, see code.php's `$online_img_url`), nested under a
 * `media/` namespace inside the uploads folder, served at `/uploads` (app.js) — so
 * the final public URL is `<PUBLIC_MEDIA_BASE_URL>/uploads/media/userfolder_<id>/
 * whatsapp_sent_file/<filename>`.
 */
/**
 * Low-level save shared by outbound (agent-uploaded) and inbound (vendor-downloaded)
 * media — same `userfolder_<id>/<subfolder>/<filename>` shape, just a different
 * subfolder name so the two don't mix (legacy keeps them in separate folders too:
 * `whatsapp_sent_file` vs `wp_incoming_file`).
 */
export async function saveMediaBuffer({ userAdminId, subfolder, buffer, mime, filenameHint }) {
  const dir = path.join(process.cwd(), config.upload.dir, 'media', `userfolder_${userAdminId}`, subfolder)
  await mkdir(dir, { recursive: true })

  const extension = (filenameHint && filenameHint.split('.').pop()) || EXTENSION_BY_MIME[mime] || 'bin'
  const filename = `${randomUUID()}.${extension}`
  await writeFile(path.join(dir, filename), buffer)

  return { filename, url: `/uploads/media/userfolder_${userAdminId}/${subfolder}/${filename}` }
}

export async function storeUploadedFiles(userAdminId, files) {
  const results = []
  for (const file of files) {
    const validation = await detectAndValidateUpload(file.buffer, file.mimetype)
    if (!validation.ok) {
      const error = new Error(`"${file.originalname}": ${validation.reason}`)
      error.status = 400
      throw error
    }

    const dir = path.join(process.cwd(), config.upload.dir, 'media', `userfolder_${userAdminId}`, 'whatsapp_sent_file')
    await mkdir(dir, { recursive: true })

    const extension = EXTENSION_BY_MIME[validation.mime] || 'bin'
    const filename = `${randomUUID()}.${extension}`
    await writeFile(path.join(dir, filename), file.buffer)

    results.push({
      type: validation.type, // 'I' | 'V' | 'A' | 'D'
      mime: validation.mime,
      sizeBytes: validation.sizeBytes,
      originalFilename: file.originalname,
      url: `/uploads/media/userfolder_${userAdminId}/whatsapp_sent_file/${filename}`,
    })
  }
  return results
}
