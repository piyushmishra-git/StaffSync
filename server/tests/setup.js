const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(`${mongod.getUri()}hr-test`);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
