const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    category: { type: String, default: 'General', trim: true, maxlength: 60 },
    startDate: { type: Date },
    endDate: { type: Date },
    link: { type: String, default: '', trim: true, maxlength: 500 },
    mandatory: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainingSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Training', trainingSchema);
