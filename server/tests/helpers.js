const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

let counter = 0;

async function createUser({
  role = 'employee',
  password = 'Passw0rd1',
  verified = true,
  manager = null,
  isActive = true,
  employeeId,
} = {}) {
  counter += 1;
  const user = new User({
    employeeId: employeeId || `T${String(counter).padStart(3, '0')}`,
    email: `t${counter}@test.local`,
    role,
    manager,
    isActive,
  });
  await user.setPassword(password);
  user.isEmailVerified = verified;
  await user.save();
  return { user, password };
}

async function tokenFor(user, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password });
  if (!res.body.accessToken) {
    throw new Error(`Test login failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

async function loginAs(spec = {}) {
  const { user, password } = await createUser(spec);
  const token = await tokenFor(user, password);
  return { user, token };
}

module.exports = { app, request, createUser, loginAs, tokenFor };
