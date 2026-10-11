import { Router } from 'express'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../controllers/categoriesController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All category operations require authentication and are scoped to the user
router.use(authenticate)

router.get('/', asyncHandler(getCategories))
router.post('/', asyncHandler(createCategory))
router.patch('/reorder', asyncHandler(reorderCategories))
router.patch('/:id', asyncHandler(updateCategory))
router.delete('/:id', asyncHandler(deleteCategory))

export default router
