import { Router } from 'express'
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  resetMyMonthTransactions,
} from '../controllers/transactionsController.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All transaction operations require authentication and are scoped to the user
router.use(authenticate)

router.get('/', asyncHandler(getTransactions))
router.post('/reset-month', asyncHandler(resetMyMonthTransactions))
router.get('/:id', asyncHandler(getTransactionById))
router.post('/', asyncHandler(createTransaction))
router.patch('/:id', asyncHandler(updateTransaction))
router.delete('/:id', asyncHandler(deleteTransaction))

export default router

