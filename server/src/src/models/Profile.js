const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    personal: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      dob: { type: Date },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      emergencyContact: { type: String, default: '' },
    },
    job: {
      designation: { type: String, default: '' },
      department: { type: String, default: '' },
      joiningDate: { type: Date },
      employmentType: {
        type: String,
        enum: ['full-time', 'part-time', 'contract', 'intern'],
        default: 'full-time',
      },
    },
    salary: {
      basic: { type: Number, default: 0, min: 0 },
      hra: { type: Number, default: 0, min: 0 },
      allowances: { type: Number, default: 0, min: 0 },
      deductions: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'INR' },
    },
    profilePictureUrl: { type: String, default: '' },
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Profile', profileSchema);
