import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import * as messagesController from '../controllers/messagesController.js'
import * as templatesController from '../controllers/templatesController.js'
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
  // Opaque, base64url-encoded — see utils/pagination.js + utils/dateWindow.js. Omitted
  // for the first page (the latest 3 calendar days); each "load more" click sends back
  // the previous response's own `nextCursor` to walk one more 3-day window into the past.
  cursor: z.string().optional(),
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

// "Send Approved Template" popup — sends a pre-approved WhatsApp template past the
// 24h customer-service window. `file` (optional) overrides the template's own
// configured media for this one send; `manualValues` is a JSON string since
// multipart form fields are always strings.
router.post(
  '/template',
  upload.single('file'),
  validate({ body: z.object({ templateId: z.coerce.number().int(), manualValues: z.string().optional() }) }),
  asyncHandler(templatesController.sendTemplateToConversation),
)

export default router
