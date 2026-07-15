const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret';

const { verifyToken, getJwtSecret } = require('../routes/auth');

function runMiddleware(authorization) {
  return new Promise((resolve) => {
    const req = { headers: { authorization } };
    const response = { statusCode: 200, body: null };
    const res = {
      status(code) {
        response.statusCode = code;
        return this;
      },
      json(body) {
        response.body = body;
        resolve({ req, response, calledNext: false });
      }
    };

    verifyToken(req, res, () => resolve({ req, response, calledNext: true }));
  });
}

test('rejects requests without an authorization token', async () => {
  const result = await runMiddleware(undefined);

  assert.equal(result.calledNext, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: 'Access denied' });
});

test('rejects an invalid token', async () => {
  const result = await runMiddleware('Bearer invalid-token');

  assert.equal(result.calledNext, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: 'Invalid or expired token' });
});

test('accepts a valid token and exposes its claims', async () => {
  const token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET);
  const result = await runMiddleware(`Bearer ${token}`);

  assert.equal(result.calledNext, true);
  assert.equal(result.req.user.userId, 42);
});

test('does not use an insecure fallback when JWT_SECRET is missing', () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  assert.throws(() => getJwtSecret(), /JWT_SECRET is required/);

  process.env.JWT_SECRET = originalSecret;
});
