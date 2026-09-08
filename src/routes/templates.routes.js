import { Router } from 'express'
import * as templatesController from '../controllers/templatesController.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(templatesController.listTemplates))
router.get('/:id', asyncHandler(templatesController.getTemplateDetail))

export default router
