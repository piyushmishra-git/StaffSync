const { ApiError } = require('../middleware/errorHandler');

const SALARY_FIELDS = ['basic', 'hra', 'allowances', 'deductions'];

// Single source of truth for salary validation so the profile editor and the
// payroll editor reject exactly the same inputs.
function parseSalaryFields(input = {}, { requireAny = false } = {}) {
  const set = {};
  for (const field of SALARY_FIELDS) {
    if (input[field] === undefined) continue;
    const raw = input[field];
    const value = Number(raw);
    if (raw === '' || raw === null || !Number.isFinite(value) || value < 0) {
      throw new ApiError(400, `${field} must be a non-negative number`);
    }
    set[field] = value;
  }
  if (input.currency !== undefined) {
    const currency = String(input.currency).trim().toUpperCase();
    if (!/^[A-Z]{3,8}$/.test(currency)) {
      throw new ApiError(400, 'currency must be a 3-8 letter code');
    }
    set.currency = currency;
  }
  if (requireAny && Object.keys(set).length === 0) {
    throw new ApiError(400, 'No salary fields supplied');
  }
  return set;
}

module.exports = { SALARY_FIELDS, parseSalaryFields };
