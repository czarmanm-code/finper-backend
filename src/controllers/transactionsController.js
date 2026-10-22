import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Category from '../models/Category.js'
import { seedDefaultCategoriesForUser } from '../utils/seedDefaults.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

/**
 * Resiliently resolves a category for the user, gracefully handling
 * offline/fallback identifiers (e.g., 'cat-food', 'cat-salary') or category names.
 */
async function resolveUserCategory(userId, categoryId, type) {
  await seedDefaultCategoriesForUser(userId)

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const existing = await Category.findOne({ _id: categoryId, userId })
    if (existing) return existing
  }

  const fallbackIdToName = {
    'cat-salary': 'Salary',
    'cat-vouchers': 'Food Vouchers',
    'cat-investments-inc': 'Investments & Returns',
    'cat-investments': 'Investments & Returns',
    'cat-housing': 'Housing & Rent',
    'cat-food': 'Food & Groceries',
    'cat-transport': 'Transportation',
    'cat-utilities': 'Utilities & Services',
    'cat-entertainment': 'Entertainment',
  }

  const targetName = fallbackIdToName[categoryId] || categoryId

  if (targetName && typeof targetName === 'string') {
    const byName = await Category.findOne({
      userId,
      name: { $regex: new RegExp(`^${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    })
    if (byName) return byName
  }

  if (type) {
    const fallbackByType = await Category.findOne({ userId, type })
    if (fallbackByType) return fallbackByType
  }

  return Category.findOne({ userId })
}

/**
 * List transactions for the authenticated user with optional filtering and pagination.
 */
export async function getTransactions(req, res) {
  const { type, categoryId, startDate, endDate, limit = 50, page = 1 } = req.query

  const filter = { userId: req.user._id }

  if (type && ['income', 'expense'].includes(type)) {
    filter.type = type
  }

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    filter.categoryId = categoryId
  }

  if (startDate || endDate) {
    filter.date = {}
    if (startDate) filter.date.$gte = new Date(startDate)
    if (endDate) filter.date.$lte = new Date(endDate)
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  const skip = (pageNum - 1) * limitNum

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate('categoryId', 'name type icon color')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Transaction.countDocuments(filter),
  ])

  res.json({
    data: transactions,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  })
}

/**
 * Get a single transaction by ID (scoped to the authenticated user).
 */
export async function getTransactionById(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Transaction not found')
  }

  const transaction = await Transaction.findOne({ _id: id, userId: req.user._id }).populate(
    'categoryId',
    'name type icon color'
  )

  if (!transaction) {
    throw httpError(404, 'Transaction not found')
  }

  res.json(transaction)
}

/**
 * Create a transaction scoped to the authenticated user.
 */
export async function createTransaction(req, res) {
  const { amount, type, categoryId, date, description, receiptUrl } = req.body

  if (typeof amount !== 'number' || amount <= 0) {
    throw httpError(400, 'Amount must be a positive number')
  }

  if (!['income', 'expense'].includes(type)) {
    throw httpError(400, 'Type must be either income or expense')
  }

  const category = await resolveUserCategory(req.user._id, categoryId, type)
  if (!category) {
    throw httpError(400, 'No valid category found for user')
  }

  const transaction = await Transaction.create({
    amount,
    type,
    categoryId: category._id,
    date: date ? new Date(date) : new Date(),
    description: description ? description.trim() : '',
    receiptUrl: receiptUrl ? receiptUrl.trim() : null,
    userId: req.user._id,
  })

  await transaction.populate('categoryId', 'name type icon color')

  res.status(201).json(transaction)
}

/**
 * Update a transaction scoped to the authenticated user.
 */
export async function updateTransaction(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Transaction not found')
  }

  const { amount, type, categoryId, date, description, receiptUrl } = req.body
  const updates = {}

  if (amount !== undefined) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw httpError(400, 'Amount must be a positive number')
    }
    updates.amount = amount
  }

  if (type !== undefined) {
    if (!['income', 'expense'].includes(type)) {
      throw httpError(400, 'Type must be either income or expense')
    }
    updates.type = type
  }

  if (categoryId !== undefined) {
    const category = await resolveUserCategory(req.user._id, categoryId, updates.type || type)
    if (!category) {
      throw httpError(400, 'No valid category found for user')
    }
    updates.categoryId = category._id
  }

  if (date !== undefined) updates.date = new Date(date)
  if (description !== undefined) updates.description = description.trim()
  if (receiptUrl !== undefined) updates.receiptUrl = receiptUrl ? receiptUrl.trim() : null

  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  ).populate('categoryId', 'name type icon color')

  if (!transaction) {
    throw httpError(404, 'Transaction not found')
  }

  res.json(transaction)
}

/**
 * Delete a transaction scoped to the authenticated user.
 */
export async function deleteTransaction(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Transaction not found')
  }

  const transaction = await Transaction.findOneAndDelete({ _id: id, userId: req.user._id })

  if (!transaction) {
    throw httpError(404, 'Transaction not found')
  }

  res.sendStatus(204)
}

/**
 * Resets/clears test transactions exclusively for the authenticated user (admin test tool).
 * Strictly scoped by userId to ensure no other user's financial records are touched.
 */
export async function resetMyMonthTransactions(req, res) {
  const result = await Transaction.deleteMany({ userId: req.user._id })
  return res.status(200).json({
    message: 'Month transactions reset successfully for your account',
    deletedCount: result.deletedCount,
  })
}

