import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: ['income', 'expense'],
        message: 'Type must be either income or expense',
      },
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: null,
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
        ret.categoryId = ret.categoryId ? ret.categoryId.toString() : ret.categoryId
        ret.userId = ret.userId ? ret.userId.toString() : ret.userId
        delete ret._id
        delete ret.__v
      },
    },
  }
)

transactionSchema.index({ userId: 1, date: -1 })

export default mongoose.model('Transaction', transactionSchema)

