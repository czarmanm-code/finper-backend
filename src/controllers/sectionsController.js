import mongoose from 'mongoose'
import Section from '../models/Section.js'
import Category from '../models/Category.js'
import { seedDefaultCategoriesForUser } from '../utils/seedDefaults.js'

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, `${fieldName} is required and cannot be empty`)
  }
}

export const DEFAULT_USER_SECTIONS = [
  { name: 'Income', icon: 'BanknotesIcon', color: '#10b981', order: 0 },
  { name: 'Fixed Expenses', icon: 'BuildingLibraryIcon', color: '#64748b', order: 1 },
  { name: 'Variable Expenses', icon: 'ShoppingCartIcon', color: '#0ea5e9', order: 2 },
  { name: 'Savings & Investments', icon: 'BuildingOfficeIcon', color: '#8b5cf6', order: 3 },
]

/**
 * Ensures default sections exist for a user and assigns unlinked categories.
 */
async function ensureUserSections(userId) {
  let sections = await Section.find({ userId }).sort('order')

  if (sections.length === 0) {
    const sectionsToInsert = DEFAULT_USER_SECTIONS.map((sec) => ({
      ...sec,
      userId,
    }))
    sections = await Section.insertMany(sectionsToInsert)
  }

  // Ensure default categories exist as well
  await seedDefaultCategoriesForUser(userId)

  // Map unlinked categories to appropriate sections
  const unlinkedCategories = await Category.find({
    userId,
    $or: [{ sectionId: { $exists: false } }, { sectionId: null }],
  })

  if (unlinkedCategories.length > 0) {
    const secIncome = sections.find((s) => s.name.toLowerCase().includes('income')) || sections[0]
    const secFixed =
      sections.find((s) => s.name.toLowerCase().includes('fixed') || s.name.toLowerCase().includes('fijo')) ||
      sections[1] ||
      sections[0]
    const secSavings =
      sections.find(
        (s) =>
          s.name.toLowerCase().includes('saving') ||
          s.name.toLowerCase().includes('invest') ||
          s.name.toLowerCase().includes('ahorro')
      ) ||
      sections[3] ||
      sections[0]
    const secVariable =
      sections.find(
        (s) => s.name.toLowerCase().includes('variable') || s.name.toLowerCase().includes('gasto')
      ) ||
      sections[2] ||
      sections[0]

    const bulkOps = unlinkedCategories.map((cat) => {
      let targetSectionId = secVariable._id
      const lowerName = cat.name.toLowerCase()

      if (cat.type === 'income') {
        targetSectionId = secIncome._id
      } else if (
        lowerName.includes('housing') ||
        lowerName.includes('rent') ||
        lowerName.includes('utilit') ||
        lowerName.includes('service')
      ) {
        targetSectionId = secFixed._id
      } else if (
        lowerName.includes('saving') ||
        lowerName.includes('invest') ||
        lowerName.includes('emergency')
      ) {
        targetSectionId = secSavings._id
      }

      return {
        updateOne: {
          filter: { _id: cat._id },
          update: { $set: { sectionId: targetSectionId } },
        },
      }
    })

    if (bulkOps.length > 0) {
      await Category.bulkWrite(bulkOps)
    }
  }

  return sections
}

/**
 * Get all sections with their nested categories for the authenticated user.
 */
export async function getSections(req, res) {
  const sections = await ensureUserSections(req.user._id)
  const categories = await Category.find({ userId: req.user._id }).sort('order')

  const categoriesBySection = new Map()
  for (const category of categories) {
    const key = category.sectionId ? category.sectionId.toString() : 'unassigned'
    if (!categoriesBySection.has(key)) {
      categoriesBySection.set(key, [])
    }
    categoriesBySection.get(key).push(category.toJSON())
  }

  const result = sections.map((section) => {
    const json = section.toJSON()
    json.categories = categoriesBySection.get(json.id) || []
    return json
  })

  res.json(result)
}

/**
 * Create a new custom section for the user.
 */
export async function createSection(req, res) {
  const { name, icon = 'FolderIcon', color = '#64748b' } = req.body

  assertNonEmptyString(name, 'name')
  assertNonEmptyString(icon, 'icon')
  assertNonEmptyString(color, 'color')

  const order = await Section.countDocuments({ userId: req.user._id })
  const section = await Section.create({
    name: name.trim(),
    icon,
    color,
    order,
    userId: req.user._id,
  })

  const json = section.toJSON()
  json.categories = []

  res.status(201).json(json)
}

/**
 * Update a user's section.
 */
export async function updateSection(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Section not found')
  }

  const { name, icon, color } = req.body
  const updates = {}

  if (name !== undefined) {
    assertNonEmptyString(name, 'name')
    updates.name = name.trim()
  }
  if (icon !== undefined) {
    assertNonEmptyString(icon, 'icon')
    updates.icon = icon
  }
  if (color !== undefined) {
    assertNonEmptyString(color, 'color')
    updates.color = color
  }

  const section = await Section.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  )

  if (!section) {
    throw httpError(404, 'Section not found')
  }

  res.json(section)
}

/**
 * Delete a user's section.
 */
export async function deleteSection(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Section not found')
  }

  const section = await Section.findOneAndDelete({ _id: id, userId: req.user._id })

  if (!section) {
    throw httpError(404, 'Section not found')
  }

  // Delete all categories belonging to this section
  await Category.deleteMany({ sectionId: id, userId: req.user._id })

  res.sendStatus(204)
}

/**
 * Reorder sections belonging to the user.
 */
export async function reorderSections(req, res) {
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

  await Section.bulkWrite(bulkOps)

  res.sendStatus(200)
}
