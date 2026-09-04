import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import * as messagesController from '../controllers/messagesController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { config } from '../config/index.js'

const router = Router({ mergeParams: true })

// Real validation (MIME/magic-byte/size) happens server-side in uploadService; this
// cap is just a coarse upper bound (largest allowed category) so a wildly oversized
// request is rejected before it's even buffered in memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxDocumentBytes, files: 10 },
})

// Mirrors the query params the legacy `whatsapp_chat.php?...` route is opened with
// when a chat is selected from the sidebar — see messagesController.listThreadMessages
// for how each one is resolved/validated against the real tables.
const legacyChatContextQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  ctrId: z.coerce.number().int().optional(),
  for: z.enum(['C', 'L', 'D', 'V']).optional(),
  refid: z.coerce.number().int().optional(),
  def: z.string().optional(),
  view: z.string().optional(),
  cname: z.string().optional(),
  viewfrom: z.string().optional(),
  is_chat: z.string().optional(),
  is_on_right: z.string().optional(),
  useradminid: z.coerce.number().int().optional(),
  wabano: z.string().optional(),
  wanum: z.string().optional(),
})

router.get(
  '/',
  validate({ query: legacyChatContextQuery }),
  asyncHandler(messagesController.listThreadMessages),
)

router.post(
  '/',
  upload.array('files', 10),
  validate({ body: z.object({ text: z.string().max(4096).optional() }) }),
  asyncHandler(messagesController.sendMessage),
)

export default router
