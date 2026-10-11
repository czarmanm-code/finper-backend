import mongoose from 'mongoose'
import Section from '../models/Section.js'
import Category from '../models/Category.js'

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

export async function getSections(req, res) {
  const sections = await Section.find().sort('order')
  const categories = await Category.find().sort('order')

  const categoriesBySection = new Map()
  for (const category of categories) {
    const key = category.sectionId.toString()
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

export async function createSection(req, res) {
  const { name, icon, color } = req.body

  assertNonEmptyString(name, 'name')
  assertNonEmptyString(icon, 'icon')
  assertNonEmptyString(color, 'color')

  const order = await Section.countDocuments()
  const section = await Section.create({ name, icon, color, order })

  const json = section.toJSON()
  json.categories = []

  res.status(201).json(json)
}

export async function updateSection(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Section not found')
  }

  const { name, icon, color } = req.body
  const updates = {}

  if (name !== undefined) {
    assertNonEmptyString(name, 'name')
    updates.name = name
  }
  if (icon !== undefined) {
    assertNonEmptyString(icon, 'icon')
    updates.icon = icon
  }
  if (color !== undefined) {
    assertNonEmptyString(color, 'color')
    updates.color = color
  }

  const section = await Section.findByIdAndUpdate(id, updates, { new: true, runValidators: true })

  if (!section) {
    throw httpError(404, 'Section not found')
  }

  res.json(section)
}

export async function deleteSection(req, res) {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, 'Section not found')
  }

  const section = await Section.findByIdAndDelete(id)

  if (!section) {
    throw httpError(404, 'Section not found')
  }

  await Category.deleteMany({ sectionId: id })

  res.sendStatus(204)
}

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
      filter: { _id: id },
      update: { order: index },
    },
  }))

  await Section.bulkWrite(bulkOps)

  res.sendStatus(200)
}

export async function createCategory(req, res) {
  const { sectionId } = req.params
  const { name, icon, color } = req.body

  if (!mongoose.isValidObjectId(sectionId)) {
    throw httpError(404, 'Section not found')
  }

  const section = await Section.findById(sectionId)
  if (!section) {
    throw httpError(404, 'Section not found')
  }

  assertNonEmptyString(name, 'name')
  assertNonEmptyString(icon, 'icon')
  assertNonEmptyString(color, 'color')

  const order = await Category.countDocuments({ sectionId })
  const category = await Category.create({ sectionId, name, icon, color, order })

  res.status(201).json(category)
}
