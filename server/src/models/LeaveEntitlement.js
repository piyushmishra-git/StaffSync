const mongoose = require('mongoose');

const leaveEntitlementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true, min: 2000, max: 2200 },
    type: { type: String, enum: ['paid', 'sick'], required: true },
    days: { type: Number, required: true, min: 0, max: 366 },
  },
  { timestamps: true }
);

leaveEntitlementSchema.index({ user: 1, year: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('LeaveEntitlement', leaveEntitlementSchema);
