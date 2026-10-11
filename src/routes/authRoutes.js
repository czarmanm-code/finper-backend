import { Router } from 'express'
import {
  register,
  login,
  getProfile,
  generateInvitation,
  listInvitations,
  listUsers,
} from '../controllers/authController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public authentication routes
router.post('/register', asyncHandler(register))
router.post('/login', asyncHandler(login))

// Authenticated user route
router.get('/me', authenticate, asyncHandler(getProfile))

// Admin-only invitation management
router.post('/invitations', authenticate, authorize('admin'), asyncHandler(generateInvitation))
router.get('/invitations', authenticate, authorize('admin'), asyncHandler(listInvitations))

// Admin-only user management
router.get('/users', authenticate, authorize('admin'), asyncHandler(listUsers))

export default router

