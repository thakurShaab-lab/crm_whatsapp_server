import { Router } from 'express'
import { z } from 'zod'
import * as conversationsController from '../controllers/conversationsController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.get(
  '/',
  validate({
    query: z.object({
      search: z.string().trim().max(255).optional(),
      filter: z.enum(['recent', 'unread', 'dateRange']).optional(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  }),
  asyncHandler(conversationsController.listConversations),
)

router.post(
  '/:mobile/read',
  validate({ params: z.object({ mobile: z.string().min(1) }) }),
  asyncHandler(conversationsController.markRead),
)

// Hard delete — permanently removes the conversation's messages, no undo.
router.delete(
  '/:mobile',
  validate({ params: z.object({ mobile: z.string().min(1) }) }),
  asyncHandler(conversationsController.deleteConversation),
)

export default router
