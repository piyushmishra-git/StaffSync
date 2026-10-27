// Strips MongoDB operator injection and prototype-pollution vectors from
// request data. Bodies are cleaned recursively; query strings only keep
// primitive values so `?search[$ne]=x` can never reach a Mongo filter.
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeKey(key) {
  return !BLOCKED_KEYS.has(key) && !key.startsWith('$') && !key.includes('.');
}

function cleanBody(value) {
  if (Array.isArray(value)) return value.map(cleanBody);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (!isSafeKey(key)) continue;
      out[key] = cleanBody(v);
    }
    return out;
  }
  return value;
}

function cleanQueryValue(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter(
      (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    );
  }
  return undefined;
}

function cleanQuery(query) {
  if (!query || typeof query !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(query)) {
    if (!isSafeKey(key)) continue;
    const cleaned = cleanQueryValue(value);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanBody(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = cleanQuery(req.query);
  }
  next();
}

module.exports = sanitizeRequest;
module.exports.cleanBody = cleanBody;
module.exports.cleanQuery = cleanQuery;
