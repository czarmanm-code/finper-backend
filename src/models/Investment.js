import mongoose from 'mongoose'

const monthlyRecordSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Record cutoff date is required'],
    },
    monthKey: {
      type: String, // e.g. "2026-10"
      required: true,
    },
    balance: {
      type: Number,
      required: [true, 'Balance is required'],
      min: [0, 'Balance cannot be negative'],
    },
    contributions: {
      type: Number,
      default: 0,
      min: [0, 'Contributions cannot be negative'],
    },
    withdrawals: {
      type: Number,
      default: 0,
      min: [0, 'Withdrawals cannot be negative'],
    },
    returnAmount: {
      type: Number, // Can be positive (gain) or negative (loss)
      default: 0,
    },
    returnRate: {
      type: Number, // Percentage return, e.g. +2.4 or -1.5
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString()
        delete ret._id
      },
    },
  }
)

const investmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Investment name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['fixed_income', 'variable_income', 'cash_equivalent', 'retirement', 'other'],
        message: 'Type must be fixed_income, variable_income, cash_equivalent, retirement, or other',
      },
      default: 'fixed_income',
    },
    institution: {
      type: String,
      trim: true,
      default: '',
    },
    currency: {
      type: String,
      default: 'MXN',
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
      index: true,
    },
    initialBalance: {
      type: Number,
      default: 0,
      min: [0, 'Initial balance cannot be negative'],
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: [0, 'Current balance cannot be negative'],
    },
    estimatedAnnualRate: {
      type: Number,
      default: null, // If null, fall back to asset class benchmark
      min: [0, 'Estimated annual rate cannot be negative'],
      max: [1000, 'Estimated annual rate must be realistic'],
    },
    color: {
      type: String,
      default: '#10b981',
    },
    icon: {
      type: String,
      default: 'ArrowTrendingUpIcon',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'archived'],
        message: 'Status must be active or archived',
      },
      default: 'active',
    },
    records: [monthlyRecordSchema],
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
        if (ret.categoryId) {
          if (ret.categoryId instanceof mongoose.Types.ObjectId) {
            ret.categoryId = ret.categoryId.toString()
          } else if (typeof ret.categoryId === 'object' && ret.categoryId._id) {
            ret.categoryId.id = ret.categoryId._id.toString()
          }
        }
        ret.userId = ret.userId ? ret.userId.toString() : ret.userId
        delete ret._id
        delete ret.__v
      },
    },
  }
)

investmentSchema.index({ userId: 1, status: 1 })

export default mongoose.model('Investment', investmentSchema)

