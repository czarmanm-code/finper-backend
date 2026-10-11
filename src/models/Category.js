import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Category type is required'],
      enum: {
        values: ['income', 'expense'],
        message: 'Category type must be either income or expense',
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: false,
    },
    icon: {
      type: String,
      default: 'tag',
    },
    color: {
      type: String,
      default: '#3b82f6',
    },
    order: {
      type: Number,
      default: 0,
    },
    plannedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString()
        ret.userId = ret.userId ? ret.userId.toString() : ret.userId
        if (ret.sectionId) ret.sectionId = ret.sectionId.toString()
        delete ret._id
        delete ret.__v
      },
    },
  }
)

categorySchema.index({ userId: 1, name: 1, type: 1 })

export default mongoose.model('Category', categorySchema)
