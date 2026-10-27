const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../../config/env');

// Production driver: objects are written to S3 and served via the bucket
// (or a CDN in front of it). Credentials come from the standard AWS env
// vars / instance role. Enable with STORAGE_DRIVER=s3.
let client;

function getClient() {
  if (!client) {
    client = new S3Client({ region: env.storage.s3.region });
  }
  return client;
}

async function save({ buffer, originalName, mime, folder }) {
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  const key = `${folder}/${crypto.randomBytes(16).toString('hex')}${ext}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.storage.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );
  return {
    url: `https://${env.storage.s3.bucket}.s3.${env.storage.s3.region}.amazonaws.com/${key}`,
  };
}

module.exports = { save };
