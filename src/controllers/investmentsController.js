import mongoose from 'mongoose'
import Investment from '../models/Investment.js'
import Category from '../models/Category.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

/**
 * Format a Date to "YYYY-MM" monthKey.
 */
function toMonthKey(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Recalculate returns and metrics across all chronological records of an investment.
 */
function computeRecords(records, initialBalance) {
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
  let prevBalance = Number(initialBalance) || 0

  return sorted.map((rec) => {
    const balance = Number(rec.balance) || 0
    const contributions = Number(rec.contributions) || 0
    const withdrawals = Number(rec.withdrawals) || 0
    const netDeposit = contributions - withdrawals

    // If explicit returnAmount provided, honor it; otherwise calculate difference
    let returnAmount = rec.returnAmount
    if (returnAmount === undefined || returnAmount === null) {
      returnAmount = balance - (prevBalance + netDeposit)
    } else {
      returnAmount = Number(returnAmount)
    }

    const baseForYield = prevBalance + contributions
    const returnRate = baseForYield > 0 ? (returnAmount / baseForYield) * 100 : 0

    prevBalance = balance

    return {
      ...rec,
      balance,
      contributions,
      withdrawals,
      returnAmount: Math.round(returnAmount * 100) / 100,
      returnRate: Math.round(returnRate * 100) / 100,
    }
  })
}

/**
 * Enrich an investment document with summary KPIs and historical trajectory.
 */
export function attachInvestmentMetrics(investmentDoc) {
  const inv = investmentDoc.toJSON ? investmentDoc.toJSON() : { ...investmentDoc }
  const rawRecords = inv.records || []
  const initialBal = Number(inv.initialBalance) || 0

  const calculatedRecords = computeRecords(rawRecords, initialBal)

  // Current balance is the latest recorded balance, or initialBalance
  const latestRecord = calculatedRecords.length > 0 ? calculatedRecords[calculatedRecords.length - 1] : null
  const currentBalance = latestRecord ? latestRecord.balance : initialBal

  // Cumulative numbers
  const sumContributions = calculatedRecords.reduce((sum, r) => sum + (Number(r.contributions) || 0), 0)
  const sumWithdrawals = calculatedRecords.reduce((sum, r) => sum + (Number(r.withdrawals) || 0), 0)
  const totalInvested = initialBal + sumContributions - sumWithdrawals
  const totalGainLoss = currentBalance - totalInvested
  const totalReturnPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

  // Last period return
  const lastReturnAmount = latestRecord ? latestRecord.returnAmount : 0
  const lastReturnRate = latestRecord ? latestRecord.returnRate : 0

  // Trajectory timeline for charts
  const timeline = [
    {
      date: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
      balance: initialBal,
      returnAmount: 0,
      returnRate: 0,
      label: 'Initial',
    },
    ...calculatedRecords.map((r) => ({
      id: r.id || r._id,
      date: r.date,
      monthKey: r.monthKey,
      balance: r.balance,
      contributions: r.contributions,
      withdrawals: r.withdrawals,
      returnAmount: r.returnAmount,
      returnRate: r.returnRate,
      notes: r.notes,
      label: r.monthKey,
    })),
  ]

  return {
    ...inv,
    currentBalance: Math.round(currentBalance * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalGainLoss: Math.round(totalGainLoss * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 10) / 10,
    lastReturnAmount: Math.round(lastReturnAmount * 100) / 100,
    lastReturnRate: Math.round(lastReturnRate * 10) / 10,
    recordsCount: calculatedRecords.length,
    records: calculatedRecords,
    timeline,
  }
}

/**
 * GET /api/investments - List all investments for authenticated user
 */
export async function getInvestments(req, res) {
  const investments = await Investment.find({ userId: req.user._id })
    .populate('categoryId', 'name color icon sectionId')
    .sort({ createdAt: -1 })

  const enriched = investments.map(attachInvestmentMetrics)
  res.json(enriched)
}

/**
 * GET /api/investments/:id - Get investment by ID
 */
export async function getInvestmentById(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Investment not found')
  }

  const investment = await Investment.findOne({ _id: id, userId: req.user._id }).populate(
    'categoryId',
    'name color icon sectionId'
  )

  if (!investment) {
    throw httpError(404, 'Investment not found')
  }

  res.json(attachInvestmentMetrics(investment))
}

/**
 * POST /api/investments - Create new investment
 */
export async function createInvestment(req, res) {
  const {
    name,
    type = 'fixed_income',
    institution = '',
    currency = 'MXN',
    categoryId,
    initialBalance = 0,
    estimatedAnnualRate,
    color = '#10b981',
    icon = 'ArrowTrendingUpIcon',
    notes = '',
    initialCutoffDate,
  } = req.body

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw httpError(400, 'Investment name is required')
  }

  let validCategoryId = null
  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw httpError(400, 'Invalid category ID')
    }
    const cat = await Category.findOne({ _id: categoryId, userId: req.user._id })
    if (cat) validCategoryId = cat._id
  }

  const numInitial = Math.max(0, Number(initialBalance) || 0)
  const numRate =
    estimatedAnnualRate !== undefined && estimatedAnnualRate !== null && estimatedAnnualRate !== ''
      ? Math.max(0, Number(estimatedAnnualRate))
      : null

  const records = []
  // If user provided an initial cutoff date and balance > 0, store as first baseline snapshot
  if (numInitial > 0 && initialCutoffDate) {
    const dateObj = new Date(initialCutoffDate)
    records.push({
      date: dateObj,
      monthKey: toMonthKey(dateObj),
      balance: numInitial,
      contributions: numInitial,
      withdrawals: 0,
      returnAmount: 0,
      returnRate: 0,
      notes: 'Initial balance snapshot',
    })
  }

  const investment = await Investment.create({
    name: name.trim(),
    type,
    institution: institution.trim(),
    currency: currency.trim() || 'MXN',
    categoryId: validCategoryId,
    initialBalance: numInitial,
    currentBalance: numInitial,
    estimatedAnnualRate: numRate,
    color: color || '#10b981',
    icon: icon || 'ArrowTrendingUpIcon',
    notes: notes.trim(),
    records,
    userId: req.user._id,
  })

  await investment.populate('categoryId', 'name color icon sectionId')
  res.status(201).json(attachInvestmentMetrics(investment))
}

/**
 * PATCH /api/investments/:id - Update investment metadata
 */
export async function updateInvestment(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Investment not found')
  }

  const {
    name,
    type,
    institution,
    currency,
    categoryId,
    color,
    icon,
    notes,
    status,
    initialBalance,
    estimatedAnnualRate,
  } = req.body

  const updates = {}
  if (name !== undefined) updates.name = name.trim()
  if (type !== undefined) updates.type = type
  if (institution !== undefined) updates.institution = institution.trim()
  if (currency !== undefined) updates.currency = currency.trim()
  if (color !== undefined) updates.color = color
  if (icon !== undefined) updates.icon = icon
  if (notes !== undefined) updates.notes = notes.trim()
  if (status !== undefined) updates.status = status
  if (initialBalance !== undefined) updates.initialBalance = Math.max(0, Number(initialBalance) || 0)
  if (estimatedAnnualRate !== undefined) {
    updates.estimatedAnnualRate =
      estimatedAnnualRate !== null && estimatedAnnualRate !== '' && !isNaN(Number(estimatedAnnualRate))
        ? Math.max(0, Number(estimatedAnnualRate))
        : null
  }

  if (categoryId !== undefined) {
    if (categoryId === null || categoryId === '') {
      updates.categoryId = null
    } else {
      if (!mongoose.isValidObjectId(categoryId)) {
        throw httpError(400, 'Invalid category ID')
      }
      const cat = await Category.findOne({ _id: categoryId, userId: req.user._id })
      if (!cat) throw httpError(404, 'Category not found')
      updates.categoryId = cat._id
    }
  }

  const investment = await Investment.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('categoryId', 'name color icon sectionId')

  if (!investment) {
    throw httpError(404, 'Investment not found')
  }

  res.json(attachInvestmentMetrics(investment))
}

/**
 * DELETE /api/investments/:id - Delete investment
 */
export async function deleteInvestment(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Investment not found')
  }

  const investment = await Investment.findOneAndDelete({ _id: id, userId: req.user._id })
  if (!investment) {
    throw httpError(404, 'Investment not found')
  }

  res.json({ message: 'Investment deleted successfully', id })
}

/**
 * POST /api/investments/:id/records - Add or update a monthly cutoff record
 */
export async function addOrUpdateRecord(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Investment not found')
  }

  const { date, balance, contributions = 0, withdrawals = 0, returnAmount, notes = '' } = req.body

  if (!date) {
    throw httpError(400, 'Record cutoff date is required')
  }
  if (balance === undefined || isNaN(Number(balance))) {
    throw httpError(400, 'Valid closing balance is required')
  }

  const dateObj = new Date(date)
  const monthKey = toMonthKey(dateObj)
  const numBalance = Math.max(0, Number(balance))
  const numContrib = Math.max(0, Number(contributions) || 0)
  const numWithdraw = Math.max(0, Number(withdrawals) || 0)

  const investment = await Investment.findOne({ _id: id, userId: req.user._id })
  if (!investment) {
    throw httpError(404, 'Investment not found')
  }

  // Check if a record already exists for this exact monthKey
  const existingIdx = investment.records.findIndex((r) => r.monthKey === monthKey)

  const newRecordData = {
    date: dateObj,
    monthKey,
    balance: numBalance,
    contributions: numContrib,
    withdrawals: numWithdraw,
    notes: (notes || '').trim(),
  }

  if (returnAmount !== undefined && returnAmount !== null && !isNaN(Number(returnAmount))) {
    newRecordData.returnAmount = Number(returnAmount)
  }

  if (existingIdx >= 0) {
    // Update existing record
    investment.records[existingIdx] = {
      ...investment.records[existingIdx].toObject(),
      ...newRecordData,
    }
  } else {
    // Push new record
    investment.records.push(newRecordData)
  }

  // Update currentBalance to the latest record's balance
  investment.records.sort((a, b) => new Date(a.date) - new Date(b.date))
  const lastRec = investment.records[investment.records.length - 1]
  investment.currentBalance = lastRec ? lastRec.balance : investment.initialBalance

  await investment.save()
  await investment.populate('categoryId', 'name color icon sectionId')

  res.json(attachInvestmentMetrics(investment))
}

/**
 * DELETE /api/investments/:id/records/:recordId - Remove a specific record
 */
export async function deleteRecord(req, res) {
  const { id, recordId } = req.params
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(recordId)) {
    throw httpError(404, 'Invalid ID')
  }

  const investment = await Investment.findOne({ _id: id, userId: req.user._id })
  if (!investment) {
    throw httpError(404, 'Investment not found')
  }

  investment.records = investment.records.filter((r) => r._id.toString() !== recordId)

  // Re-sort and update currentBalance
  investment.records.sort((a, b) => new Date(a.date) - new Date(b.date))
  const lastRec = investment.records[investment.records.length - 1]
  investment.currentBalance = lastRec ? lastRec.balance : investment.initialBalance

  await investment.save()
  await investment.populate('categoryId', 'name color icon sectionId')

  res.json(attachInvestmentMetrics(investment))
}

