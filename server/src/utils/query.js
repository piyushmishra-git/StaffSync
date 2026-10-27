// Escape user input before passing it to $regex. Without this, a crafted
// search term can become a pathological regex (ReDoS) or match unintended rows.
function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function pagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  return {
    page: toPositiveInt(query.page, 1, 100000),
    limit: toPositiveInt(query.limit, defaultLimit, maxLimit),
  };
}

module.exports = { escapeRegex, toPositiveInt, pagination };
