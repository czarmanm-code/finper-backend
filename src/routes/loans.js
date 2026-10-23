import { Router } from 'express'
import {
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
} from '../controllers/loansController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All loan routes require authentication and are user-isolated
router.use(authenticate)

router.get('/', asyncHandler(getLoans))
router.get('/:id', asyncHandler(getLoanById))
router.post('/', asyncHandler(createLoan))
router.patch('/:id', asyncHandler(updateLoan))
router.delete('/:id', asyncHandler(deleteLoan))

export default router

