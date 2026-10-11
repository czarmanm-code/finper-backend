import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Category from '../models/Category.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
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

  if (!mongoose.isValidObjectId(categoryId)) {
    throw httpError(400, 'A valid categoryId is required')
  }

  // Ensure category belongs to the current user
  const category = await Category.findOne({ _id: categoryId, userId: req.user._id })
  if (!category) {
    throw httpError(404, 'Category not found or does not belong to the user')
  }

  const transaction = await Transaction.create({
    amount,
    type,
    categoryId,
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
    if (!mongoose.isValidObjectId(categoryId)) {
      throw httpError(400, 'A valid categoryId is required')
    }
    const category = await Category.findOne({ _id: categoryId, userId: req.user._id })
    if (!category) {
      throw httpError(404, 'Category not found or does not belong to the user')
    }
    updates.categoryId = categoryId
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

