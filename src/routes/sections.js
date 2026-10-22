import { Router } from 'express'
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '../controllers/sectionsController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All section operations require authentication and are scoped to the user
router.use(authenticate)

router.get('/', asyncHandler(getSections))
router.post('/', asyncHandler(createSection))
router.patch('/reorder', asyncHandler(reorderSections))
router.patch('/:id', asyncHandler(updateSection))
router.delete('/:id', asyncHandler(deleteSection))

export default router
