const Training = require('../models/Training');
const { ApiError } = require('../middleware/errorHandler');
const { startOfDayUTC } = require('../utils/dates');

function pick(body) {
  const data = {};
  for (const key of ['title', 'description', 'category', 'link']) {
    if (body[key] !== undefined) data[key] = String(body[key]).trim();
  }
  for (const key of ['startDate', 'endDate']) {
    if (body[key] !== undefined) {
      if (!body[key]) {
        data[key] = null;
      } else {
        const parsed = startOfDayUTC(body[key]);
        if (Number.isNaN(parsed.getTime())) throw new ApiError(400, `Invalid ${key}`);
        data[key] = parsed;
      }
    }
  }
  if (body.mandatory !== undefined) data.mandatory = Boolean(body.mandatory);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
}

async function listActive() {
  return Training.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('createdBy', 'employeeId email')
    .lean();
}

async function listAll() {
  return Training.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('createdBy', 'employeeId email')
    .lean();
}

async function create(actorId, body) {
  const data = pick(body);
  if (!data.title) throw new ApiError(400, 'Title is required');
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    throw new ApiError(400, 'Start date must be on or before the end date');
  }
  const training = await Training.create({ ...data, createdBy: actorId });
  return training.populate('createdBy', 'employeeId email');
}

async function update(id, body) {
  const data = pick(body);
  if (!Object.keys(data).length) throw new ApiError(400, 'No fields supplied');
  const existing = await Training.findById(id);
  if (!existing) throw new ApiError(404, 'Training not found');
  const start = data.startDate !== undefined ? data.startDate : existing.startDate;
  const end = data.endDate !== undefined ? data.endDate : existing.endDate;
  if (start && end && start > end) throw new ApiError(400, 'Start date must be on or before the end date');
  Object.assign(existing, data);
  await existing.save();
  return existing.populate('createdBy', 'employeeId email');
}

async function remove(id) {
  const training = await Training.findByIdAndDelete(id);
  if (!training) throw new ApiError(404, 'Training not found');
}

module.exports = { listActive, listAll, create, update, remove };
