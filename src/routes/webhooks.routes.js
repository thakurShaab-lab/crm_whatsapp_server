import { Router } from 'express'
import { z } from 'zod'
import * as webhooksController from '../controllers/webhooksController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const webhookBodySchema = z.object({
  event: z.enum(['sent', 'delivered', 'read', 'failed', 'inbound']),
  vendorMessageId: z.string().optional(),
  statusRemark: z.string().optional(),
  occurredAt: z.string().optional(),
  contact: z
    .object({ mobile: z.string(), countryCode: z.string().optional(), name: z.string().optional() })
    .optional(),
  message: z
    .object({
      type: z.enum(['text', 'image', 'video', 'audio', 'document']),
      text: z.string().optional(),
      vendorMessageId: z.string().optional(),
      mime: z.string().optional(),
      filename: z.string().optional(),
      mediaUrl: z.string().optional(),
    })
    .optional(),
})

// AiSensy ('A') sends its own real webhook payload shape (Meta Cloud API format),
// not the internal shape above — the body schema only applies to the other vendors,
// which aren't implemented for real receiving yet and only exercise this shape via
// manual/dev testing.
function validateBodyUnlessAiSensy(req, res, next) {
  if (req.params.vendor === 'A') return next()
  return validate({ body: webhookBodySchema })(req, res, next)
}

// G=Gupshup, C=Netcore, A=AiSensy, N=None — matches tbl_employees.whatsapp_vendor.
router.post(
  '/:vendor',
  validate({ params: z.object({ vendor: z.enum(['G', 'C', 'A', 'N']) }) }),
  validateBodyUnlessAiSensy,
  asyncHandler(webhooksController.receiveVendorWebhook),
)

export default router
