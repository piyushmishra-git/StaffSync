const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads');

async function save({ buffer, originalName, folder }) {
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return { url: `/uploads/${folder}/${name}` };
}

module.exports = { save, UPLOAD_ROOT };
