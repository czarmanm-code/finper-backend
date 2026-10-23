import mongoose from 'mongoose'

const loanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Loan name is required'],
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
      index: true,
    },
    startingBalance: {
      type: Number,
      required: [true, 'Starting balance is required'],
      min: [0, 'Starting balance cannot be negative'],
    },
    totalAmount: {
      type: Number,
      min: [0, 'Total amount cannot be negative'],
      default: function () {
        return this.startingBalance
      },
    },
    expectedPayment: {
      type: Number,
      required: [true, 'Expected payment amount is required'],
      min: [0, 'Expected payment cannot be negative'],
    },
    paymentFrequency: {
      type: String,
      enum: {
        values: ['monthly', 'biweekly', 'weekly', 'quarterly', 'semiannual', 'annual'],
        message: 'Payment frequency must be monthly, biweekly, weekly, quarterly, semiannual, or annual',
      },
      default: 'monthly',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'paid_off', 'archived'],
        message: 'Status must be active, paid_off, or archived',
      },
      default: 'active',
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

export default mongoose.model('Loan', loanSchema)

