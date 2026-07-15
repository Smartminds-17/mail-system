const rateLimit = require('express-rate-limit');

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many send requests. Try again later.' }
});

module.exports = { sendLimiter };
