import { Router } from 'express'
import {
  getInvestments,
  getInvestmentById,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  addOrUpdateRecord,
  deleteRecord,
} from '../controllers/investmentsController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All investment routes require authentication and are user-isolated
router.use(authenticate)

router.get('/', asyncHandler(getInvestments))
router.get('/:id', asyncHandler(getInvestmentById))
router.post('/', asyncHandler(createInvestment))
router.patch('/:id', asyncHandler(updateInvestment))
router.delete('/:id', asyncHandler(deleteInvestment))

// Monthly Snapshot Records
router.post('/:id/records', asyncHandler(addOrUpdateRecord))
router.delete('/:id/records/:recordId', asyncHandler(deleteRecord))

export default router

