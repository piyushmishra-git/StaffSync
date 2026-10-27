const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['employee', 'manager', 'admin'], default: 'employee' },
    // The employee's direct manager. Team-scoped access is derived from this.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    refreshTokenHashes: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.index({ manager: 1 });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    employeeId: this.employeeId,
    email: this.email,
    role: this.role,
    manager: this.manager || null,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
