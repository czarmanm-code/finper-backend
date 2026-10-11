import { Router } from 'express'
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createCategory,
} from '../controllers/sectionsController.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(getSections))
router.post('/', asyncHandler(createSection))
router.patch('/reorder', asyncHandler(reorderSections))
router.patch('/:id', asyncHandler(updateSection))
router.delete('/:id', asyncHandler(deleteSection))
router.post('/:sectionId/categories', asyncHandler(createCategory))

export default router
