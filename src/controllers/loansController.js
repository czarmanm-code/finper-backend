import mongoose from 'mongoose'
import Loan from '../models/Loan.js'
import Category from '../models/Category.js'
import Section from '../models/Section.js'
import Transaction from '../models/Transaction.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

/**
 * Helper to compute dynamic loan progress from transactions.
 */
async function attachLoanMetrics(loan, userId) {
  const catId = loan.categoryId?._id || loan.categoryId

  // Find all payment transactions logged under this loan's category
  const payments = await Transaction.find({
    userId,
    categoryId: catId,
    type: 'expense',
  })
    .populate('categoryId', 'name type icon color')
    .sort({ date: -1 })

  const paymentsMadeInApp = payments.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  const startingBal = Number(loan.startingBalance) || 0
  const totalAmt = Number(loan.totalAmount) || startingBal

  const currentBalance = Math.max(0, startingBal - paymentsMadeInApp)
  const previousAmortized = Math.max(0, totalAmt - startingBal)
  const totalPaid = previousAmortized + paymentsMadeInApp
  const progressPercent = totalAmt > 0 ? Math.min(100, Math.round((totalPaid / totalAmt) * 100)) : 0
  const isPaidOff = currentBalance <= 0

  // Build timeline history (chronological payment progress)
  const chronologicalPayments = [...payments].sort((a, b) => new Date(a.date) - new Date(b.date))
  let runningBalance = startingBal

  const timeline = chronologicalPayments.map((p) => {
    runningBalance = Math.max(0, runningBalance - Number(p.amount))
    return {
      transactionId: p._id.toString(),
      date: p.date,
      amount: Number(p.amount),
      description: p.description,
      remainingBalanceAfter: runningBalance,
    }
  })

  const loanJson = loan.toJSON ? loan.toJSON() : { ...loan }

  return {
    ...loanJson,
    currentBalance,
    totalPaid,
    paymentsMadeInApp,
    paymentsCount: payments.length,
    payments: payments.map((p) => (p.toJSON ? p.toJSON() : p)),
    timeline,
    progressPercent,
    isPaidOff,
  }
}

/**
 * Get all loans for the authenticated user with live progress metrics.
 */
export async function getLoans(req, res) {
  const loans = await Loan.find({ userId: req.user._id })
    .populate({
      path: 'categoryId',
      select: 'name color icon sectionId plannedAmount type',
      populate: {
        path: 'sectionId',
        select: 'name color icon',
      },
    })
    .sort({ createdAt: -1 })

  const loansWithMetrics = await Promise.all(
    loans.map((loan) => attachLoanMetrics(loan, req.user._id))
  )

  res.json(loansWithMetrics)
}

/**
 * Get a single loan by ID with full transaction history and monthly timeline.
 */
export async function getLoanById(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Loan not found')
  }

  const loan = await Loan.findOne({ _id: id, userId: req.user._id }).populate({
    path: 'categoryId',
    select: 'name color icon sectionId plannedAmount type',
    populate: {
      path: 'sectionId',
      select: 'name color icon',
    },
  })

  if (!loan) {
    throw httpError(404, 'Loan not found')
  }

  const loanWithMetrics = await attachLoanMetrics(loan, req.user._id)
  res.json(loanWithMetrics)
}

/**
 * Create a new loan.
 */
export async function createLoan(req, res) {
  const {
    name,
    categoryId,
    startingBalance,
    totalAmount,
    expectedPayment,
    paymentFrequency = 'monthly',
    startDate,
    endDate,
    notes,
  } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Loan name is required')
  }

  if (!categoryId || !mongoose.isValidObjectId(categoryId)) {
    throw httpError(400, 'Valid Category ID is required')
  }

  // Ensure category belongs to user
  const category = await Category.findOne({ _id: categoryId, userId: req.user._id })
  if (!category) {
    throw httpError(404, 'Category not found or does not belong to you')
  }

  const numStarting = Number(startingBalance)
  if (isNaN(numStarting) || numStarting < 0) {
    throw httpError(400, 'Starting balance must be a non-negative number')
  }

  const numTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
    ? Number(totalAmount)
    : numStarting

  if (isNaN(numTotal) || numTotal < numStarting) {
    throw httpError(400, 'Total loan amount cannot be less than the starting balance')
  }

  const numPayment = Number(expectedPayment)
  if (isNaN(numPayment) || numPayment < 0) {
    throw httpError(400, 'Expected payment must be a non-negative number')
  }

  const validFrequencies = ['monthly', 'biweekly', 'weekly', 'quarterly', 'semiannual', 'annual']
  const frequency = validFrequencies.includes(paymentFrequency) ? paymentFrequency : 'monthly'

  const loan = await Loan.create({
    name: name.trim(),
    categoryId,
    startingBalance: numStarting,
    totalAmount: numTotal,
    expectedPayment: numPayment,
    paymentFrequency: frequency,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
    notes: notes ? String(notes).trim() : '',
    status: 'active',
    userId: req.user._id,
  })

  const populated = await Loan.findById(loan._id).populate({
    path: 'categoryId',
    select: 'name color icon sectionId plannedAmount type',
    populate: {
      path: 'sectionId',
      select: 'name color icon',
    },
  })

  const loanWithMetrics = await attachLoanMetrics(populated, req.user._id)
  res.status(201).json(loanWithMetrics)
}

/**
 * Update an existing loan.
 */
export async function updateLoan(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Loan not found')
  }

  const loan = await Loan.findOne({ _id: id, userId: req.user._id })
  if (!loan) {
    throw httpError(404, 'Loan not found')
  }

  const {
    name,
    categoryId,
    startingBalance,
    totalAmount,
    expectedPayment,
    paymentFrequency,
    startDate,
    endDate,
    notes,
    status,
  } = req.body

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw httpError(400, 'Loan name cannot be empty')
    }
    loan.name = name.trim()
  }

  if (categoryId !== undefined) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw httpError(400, 'Valid Category ID is required')
    }
    const category = await Category.findOne({ _id: categoryId, userId: req.user._id })
    if (!category) {
      throw httpError(404, 'Category not found')
    }
    loan.categoryId = categoryId
  }

  if (startingBalance !== undefined) {
    const num = Number(startingBalance)
    if (isNaN(num) || num < 0) {
      throw httpError(400, 'Starting balance cannot be negative')
    }
    loan.startingBalance = num
  }

  if (totalAmount !== undefined) {
    const num = Number(totalAmount)
    if (isNaN(num) || num < loan.startingBalance) {
      throw httpError(400, 'Total loan amount cannot be less than starting balance')
    }
    loan.totalAmount = num
  }

  if (expectedPayment !== undefined) {
    const num = Number(expectedPayment)
    if (isNaN(num) || num < 0) {
      throw httpError(400, 'Expected payment cannot be negative')
    }
    loan.expectedPayment = num
  }

  if (paymentFrequency !== undefined) {
    const validFrequencies = ['monthly', 'biweekly', 'weekly', 'quarterly', 'semiannual', 'annual']
    if (!validFrequencies.includes(paymentFrequency)) {
      throw httpError(400, 'Payment frequency must be monthly, biweekly, weekly, quarterly, semiannual, or annual')
    }
    loan.paymentFrequency = paymentFrequency
  }

  if (startDate !== undefined) {
    loan.startDate = startDate ? new Date(startDate) : new Date()
  }

  if (endDate !== undefined) {
    loan.endDate = endDate ? new Date(endDate) : null
  }

  if (notes !== undefined) {
    loan.notes = String(notes).trim()
  }

  if (status !== undefined) {
    if (!['active', 'paid_off', 'archived'].includes(status)) {
      throw httpError(400, 'Invalid loan status')
    }
    loan.status = status
  }

  await loan.save()

  const populated = await Loan.findById(loan._id).populate({
    path: 'categoryId',
    select: 'name color icon sectionId plannedAmount type',
    populate: {
      path: 'sectionId',
      select: 'name color icon',
    },
  })

  const loanWithMetrics = await attachLoanMetrics(populated, req.user._id)
  res.json(loanWithMetrics)
}

/**
 * Delete a loan.
 */
export async function deleteLoan(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Loan not found')
  }

  const loan = await Loan.findOneAndDelete({ _id: id, userId: req.user._id })
  if (!loan) {
    throw httpError(404, 'Loan not found')
  }

  res.json({ message: 'Loan deleted successfully' })
}

