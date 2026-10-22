import mongoose from 'mongoose'

const sectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
    },
    icon: {
      type: String,
      required: [true, 'Section icon is required'],
      default: 'FolderIcon',
    },
    color: {
      type: String,
      required: [true, 'Section color is required'],
      default: '#64748b',
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for section'],
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

export default mongoose.model('Section', sectionSchema)
