import { Router } from 'express'
import {
  getSavingGoals,
  getSavingGoalById,
  createSavingGoal,
  updateSavingGoal,
  deleteSavingGoal,
} from '../controllers/savingGoalsController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All saving goal routes require authentication and are user-isolated
router.use(authenticate)

router.get('/', asyncHandler(getSavingGoals))
router.get('/:id', asyncHandler(getSavingGoalById))
router.post('/', asyncHandler(createSavingGoal))
router.patch('/:id', asyncHandler(updateSavingGoal))
router.delete('/:id', asyncHandler(deleteSavingGoal))

export default router

