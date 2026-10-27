const Notification = require('../models/Notification');
const User = require('../models/User');

async function notify(userId, { message, type = 'system', link }) {
  return Notification.create({ user: userId, message, type, link });
}

// Fan out a notification to every admin (e.g. new leave request).
async function notifyAdmins({ message, type = 'system', link }) {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  if (!admins.length) return [];
  return Notification.insertMany(
    admins.map((a) => ({ user: a._id, message, type, link }))
  );
}

async function listForUser(userId, limit = 15) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

async function markRead(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { returnDocument: 'after' }
  ).lean();
  return updated;
}

module.exports = { notify, notifyAdmins, listForUser, markRead };
