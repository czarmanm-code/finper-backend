import mongoose from 'mongoose'

const savingGoalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Goal name is required'],
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [0, 'Target amount cannot be negative'],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Current amount cannot be negative'],
    },
    monthlyYieldRate: {
      type: Number,
      default: 0,
      min: [0, 'Yield rate cannot be negative'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString()
        ret.userId = ret.userId ? ret.userId.toString() : ret.userId
        delete ret._id
        delete ret.__v
      },
    },
  }
)

savingGoalSchema.index({ userId: 1, name: 1 })

export default mongoose.model('SavingGoal', savingGoalSchema)

