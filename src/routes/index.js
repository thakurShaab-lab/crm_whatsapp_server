import { Router } from 'express'
import { config } from '../config/index.js'
import { agentContext } from '../middleware/agentContext.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import conversationsRoutes from './conversations.routes.js'
import messagesRoutes from './messages.routes.js'
import contactsRoutes from './contacts.routes.js'
import templatesRoutes from './templates.routes.js'
import webhooksRoutes from './webhooks.routes.js'
import devRoutes from './dev.routes.js'

const router = Router()

router.get('/health', (req, res) => res.json({ ok: true }))

// Vendor webhooks carry no session/agent context of their own — agentContext isn't
// relevant there, so it's mounted only on the routes that need it.
router.use('/webhooks/whatsapp', webhooksRoutes)

router.use(asyncHandler(agentContext))
router.use('/conversations', conversationsRoutes)
router.use('/conversations/:mobile/messages', messagesRoutes)
router.use('/contacts', contactsRoutes)
router.use('/templates', templatesRoutes)

if (config.env !== 'production') {
  router.use('/dev', devRoutes)
}

export default router
