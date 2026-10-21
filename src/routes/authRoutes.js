import { Router } from 'express'
import {
  register,
  login,
  getProfile,
  getSystemStatus,
  verifyInvitation,
  generateInvitation,
  listInvitations,
  deleteInvitation,
  listUsers,
  updateUser,
  deleteUser,
} from '../controllers/authController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public authentication & setup routes
router.get('/status', asyncHandler(getSystemStatus))
router.get('/invitations/verify/:token', asyncHandler(verifyInvitation))
router.post('/register', asyncHandler(register))
router.post('/login', asyncHandler(login))

// Authenticated current user profile
router.get('/me', authenticate, asyncHandler(getProfile))

// Admin-only invitation management
router.post('/invitations', authenticate, authorize('admin'), asyncHandler(generateInvitation))
router.get('/invitations', authenticate, authorize('admin'), asyncHandler(listInvitations))
router.delete('/invitations/:id', authenticate, authorize('admin'), asyncHandler(deleteInvitation))

// Admin-only user management (CRUD)
router.get('/users', authenticate, authorize('admin'), asyncHandler(listUsers))
router.patch('/users/:id', authenticate, authorize('admin'), asyncHandler(updateUser))
router.delete('/users/:id', authenticate, authorize('admin'), asyncHandler(deleteUser))

export default router
