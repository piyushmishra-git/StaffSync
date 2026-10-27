const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // UTC-midnight date, matching attendance/leave day keys.
    date: { type: Date, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Holiday', holidaySchema);