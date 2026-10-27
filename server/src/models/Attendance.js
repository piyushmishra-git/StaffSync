const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Always a UTC-midnight date: one document per user per calendar day.
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'leave'],
      required: true,
    },
    workHours: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Concurrency guard: a duplicate key here means "already checked in today".
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
// Admin day-wide views.
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
