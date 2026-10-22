import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Section from '../models/Section.js'
import { seedDefaultCategoriesForUser } from '../utils/seedDefaults.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

/**
 * Get all categories for the authenticated user (optionally filtered by type).
 */
export async function getCategories(req, res) {
  // Ensure default categories exist if completely empty
  await seedDefaultCategoriesForUser(req.user._id)

  const filter = { userId: req.user._id }
  if (req.query.type) {
    filter.type = req.query.type
  }

  const categories = await Category.find(filter).sort('order')
  res.json(categories)
}

/**
 * Create a new category strictly isolated to the authenticated user.
 */
export async function createCategory(req, res) {
  let { name, type, icon = 'TagIcon', color = '#3b82f6', sectionId, plannedAmount = 0 } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Category name is required')
  }

  // Derive type from section if not provided explicitly
  if (!type && sectionId && mongoose.isValidObjectId(sectionId)) {
    const section = await Section.findOne({ _id: sectionId, userId: req.user._id })
    if (section) {
      const lowerSec = section.name.toLowerCase()
      type =
        lowerSec.includes('income') || lowerSec.includes('salary') || lowerSec.includes('ingreso')
          ? 'income'
          : 'expense'
    }
  }

  if (!type || !['income', 'expense'].includes(type)) {
    type = 'expense'
  }

  const order = await Category.countDocuments({ userId: req.user._id })

  const category = await Category.create({
    name: name.trim(),
    type,
    icon,
    color,
    order,
    plannedAmount: Math.max(0, Number(plannedAmount) || 0),
    sectionId: sectionId && mongoose.isValidObjectId(sectionId) ? sectionId : undefined,
    userId: req.user._id,
  })

  res.status(201).json(category)
}

/**
 * Update a user's category (ensuring isolation).
 */
export async function updateCategory(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Category not found')
  }

  const { name, type, icon, color, plannedAmount, sectionId } = req.body
  const updates = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw httpError(400, 'Category name cannot be empty')
    }
    updates.name = name.trim()
  }

  if (type !== undefined) {
    if (!['income', 'expense'].includes(type)) {
      throw httpError(400, 'Category type must be either income or expense')
    }
    updates.type = type
  }

  if (icon !== undefined) updates.icon = icon
  if (color !== undefined) updates.color = color
  if (plannedAmount !== undefined) updates.plannedAmount = Math.max(0, Number(plannedAmount) || 0)
  if (sectionId !== undefined) {
    updates.sectionId = sectionId && mongoose.isValidObjectId(sectionId) ? sectionId : undefined
  }

  const category = await Category.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  )

  if (!category) {
    throw httpError(404, 'Category not found')
  }

  res.json(category)
}

/**
 * Delete a user's category.
 */
export async function deleteCategory(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Category not found')
  }

  const category = await Category.findOneAndDelete({ _id: id, userId: req.user._id })

  if (!category) {
    throw httpError(404, 'Category not found')
  }

  res.sendStatus(204)
}

/**
 * Reorder categories belonging to the authenticated user.
 */
export async function reorderCategories(req, res) {
  const { orderedIds } = req.body

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw httpError(400, 'orderedIds is required and must be a non-empty array')
  }

  if (!orderedIds.every((id) => mongoose.isValidObjectId(id))) {
    throw httpError(400, 'orderedIds contains an invalid id')
  }

  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, userId: req.user._id },
      update: { order: index },
    },
  }))

  await Category.bulkWrite(bulkOps)

  res.sendStatus(200)
}
