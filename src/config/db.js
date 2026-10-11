import mongoose from 'mongoose'

const DEFAULT_URI = 'mongodb://localhost:27017/personal_finance'

/**
 * Connects to MongoDB with connection event listeners and graceful fallback.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI

  mongoose.connection.on('connected', () => {
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.name} at ${mongoose.connection.host}:${mongoose.connection.port}`)
  })

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection disconnected')
  })

  try {
    await mongoose.connect(uri)
  } catch (err) {
    console.error('[MongoDB] Initial connection failed:', err.message)
    throw err
  }
}
