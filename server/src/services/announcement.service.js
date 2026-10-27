const Announcement = require('../models/Announcement');
const { ApiError } = require('../middleware/errorHandler');

function pick(body, { allowActive = true } = {}) {
  const data = {};
  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.body !== undefined) data.body = String(body.body).trim();
  if (allowActive && body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
}

async function listActive({ limit = 30 } = {}) {
  return Announcement.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 30)
    .populate('createdBy', 'employeeId email')
    .lean();
}

async function listAll() {
  return Announcement.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('createdBy', 'employeeId email')
    .lean();
}

async function create(actorId, body) {
  const data = pick(body);
  if (!data.title || !data.body) throw new ApiError(400, 'Title and body are required');
  const announcement = await Announcement.create({ ...data, createdBy: actorId });
  return announcement.populate('createdBy', 'employeeId email');
}

async function update(id, body) {
  const data = pick(body);
  if (!Object.keys(data).length) throw new ApiError(400, 'No fields supplied');
  if (data.title === '' || data.body === '') {
    throw new ApiError(400, 'Title and body cannot be empty');
  }
  const announcement = await Announcement.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true })
    .populate('createdBy', 'employeeId email');
  if (!announcement) throw new ApiError(404, 'Announcement not found');
  return announcement;
}

async function remove(id) {
  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');
}

module.exports = { listActive, listAll, create, update, remove };
