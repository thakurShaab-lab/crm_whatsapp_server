import { Router } from 'express'
import * as meController from '../controllers/meController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(meController.getMyProfile))

export default router
