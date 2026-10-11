import mongoose from 'mongoose'
import SavingGoal from '../models/SavingGoal.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

/**
 * Get all saving goals for the authenticated user.
 */
export async function getSavingGoals(req, res) {
  const goals = await SavingGoal.find({ userId: req.user._id }).sort({ createdAt: -1 })
  res.json(goals)
}

/**
 * Get a single saving goal by ID.
 */
export async function getSavingGoalById(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Saving goal not found')
  }

  const goal = await SavingGoal.findOne({ _id: id, userId: req.user._id })
  if (!goal) {
    throw httpError(404, 'Saving goal not found')
  }

  res.json(goal)
}

/**
 * Create a new saving goal scoped to the user.
 */
export async function createSavingGoal(req, res) {
  const { name, targetAmount, currentAmount = 0, monthlyYieldRate = 0 } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Goal name is required')
  }

  if (typeof targetAmount !== 'number' || targetAmount <= 0) {
    throw httpError(400, 'targetAmount must be a positive number')
  }

  if (typeof currentAmount !== 'number' || currentAmount < 0) {
    throw httpError(400, 'currentAmount cannot be negative')
  }

  if (typeof monthlyYieldRate !== 'number' || monthlyYieldRate < 0) {
    throw httpError(400, 'monthlyYieldRate cannot be negative')
  }

  const goal = await SavingGoal.create({
    name: name.trim(),
    targetAmount,
    currentAmount,
    monthlyYieldRate,
    userId: req.user._id,
  })

  res.status(201).json(goal)
}

/**
 * Update a saving goal.
 */
export async function updateSavingGoal(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Saving goal not found')
  }

  const { name, targetAmount, currentAmount, monthlyYieldRate } = req.body
  const updates = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw httpError(400, 'Goal name cannot be empty')
    }
    updates.name = name.trim()
  }

  if (targetAmount !== undefined) {
    if (typeof targetAmount !== 'number' || targetAmount <= 0) {
      throw httpError(400, 'targetAmount must be a positive number')
    }
    updates.targetAmount = targetAmount
  }

  if (currentAmount !== undefined) {
    if (typeof currentAmount !== 'number' || currentAmount < 0) {
      throw httpError(400, 'currentAmount cannot be negative')
    }
    updates.currentAmount = currentAmount
  }

  if (monthlyYieldRate !== undefined) {
    if (typeof monthlyYieldRate !== 'number' || monthlyYieldRate < 0) {
      throw httpError(400, 'monthlyYieldRate cannot be negative')
    }
    updates.monthlyYieldRate = monthlyYieldRate
  }

  const goal = await SavingGoal.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  )

  if (!goal) {
    throw httpError(404, 'Saving goal not found')
  }

  res.json(goal)
}

/**
 * Delete a saving goal.
 */
export async function deleteSavingGoal(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Saving goal not found')
  }

  const goal = await SavingGoal.findOneAndDelete({ _id: id, userId: req.user._id })

  if (!goal) {
    throw httpError(404, 'Saving goal not found')
  }

  res.sendStatus(204)
}

