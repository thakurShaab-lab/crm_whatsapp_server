import { Router } from 'express'
import * as devController from '../controllers/devController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

// Reuses the same body shape as the real webhook route (see webhooks.routes.js);
// intentionally left unvalidated/loose here since it's a dev-only convenience tool.
router.post('/simulate-webhook', asyncHandler(devController.simulateWebhook))

export default router
