import { Router } from 'express'
import { z } from 'zod'
import * as contactsController from '../controllers/contactsController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.get(
  '/',
  validate({ query: z.object({ search: z.string().trim().max(255).optional() }) }),
  asyncHandler(contactsController.searchContacts),
)

router.get(
  '/:mobile',
  validate({ params: z.object({ mobile: z.string().min(1) }) }),
  asyncHandler(contactsController.getContact),
)

export default router
