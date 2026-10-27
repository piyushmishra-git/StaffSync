const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const env = require('./env');

let memoryServer = null;

async function connectDb() {
  let uri = env.mongoUri;

  if (env.useMemoryDb) {
    // Embedded MongoDB with persistent storage - no local install required.
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const dbPath = path.join(__dirname, '..', '..', '.mongo-data');
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger' },
    });
    uri = `${memoryServer.getUri()}hr-system`;
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected (${env.useMemoryDb ? 'embedded' : 'external'})`);
}

async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDb, disconnectDb };
