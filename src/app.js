import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import healthRoutes from './routes/healthRoutes.js'
import authRoutes from './routes/authRoutes.js'
import categoriesRoutes from './routes/categories.js'
import transactionsRoutes from './routes/transactions.js'
import savingGoalsRoutes from './routes/savingGoals.js'
import sectionsRoutes from './routes/sections.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// Public & Health
app.use(healthRoutes)

// Authentication & Admin User/Invite Management
app.use('/api/auth', authRoutes)

// Core Financial Resources (User-isolated)
app.use('/api/categories', categoriesRoutes)
app.use('/api/transactions', transactionsRoutes)
app.use('/api/saving-goals', savingGoalsRoutes)

// Legacy / Section layout endpoints
app.use('/api/sections', sectionsRoutes)

// Global error handling
app.use(notFound)
app.use(errorHandler)

export default app
