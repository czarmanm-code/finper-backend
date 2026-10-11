import jwt from 'jsonwebtoken'
import User from '../models/User.js'

/**
 * Middleware to authenticate requests via Bearer JWT token.
 * Populates req.user with the authenticated user document.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication token missing or invalid',
      })
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.JWT_SECRET || 'supersecretjwtkey_finper_dev_mode_change_in_production'

    let decoded
    try {
      decoded = jwt.verify(token, secret)
    } catch (jwtErr) {
      return res.status(401).json({
        message: 'Invalid or expired authentication token',
      })
    }

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({
        message: 'User associated with this token no longer exists',
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact an administrator.',
      })
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Middleware to authorize requests by role.
 * Example: authorize('admin') or authorize('admin', 'user')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: requires one of the following roles: ${roles.join(', ')}`,
      })
    }

    next()
  }
}

