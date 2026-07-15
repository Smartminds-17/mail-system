require('dotenv').config();

function parsePort(value, fallback) {
  const port = Number(value || fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function parsePositiveInteger(value, fallback, name) {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return number;
}

function loadConfig(env = process.env) {
  return {
    environment: env.NODE_ENV || 'development',
    port: parsePort(env.PORT, 3000),
    publicBaseUrl: env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3000}`,
    corsOrigin: env.CORS_ORIGIN || `http://localhost:${env.PORT || 3000}`,
    sendConcurrency: parsePositiveInteger(env.SEND_CONCURRENCY, 3, 'SEND_CONCURRENCY'),
    jwtSecret: env.JWT_SECRET,
    database: {
      host: env.DB_HOST || 'localhost',
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || '',
      name: env.DB_NAME || 'email_automation'
    },
    smtp: {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: parsePort(env.SMTP_PORT, 587),
      user: env.SMTP_USER,
      password: env.SMTP_PASS
    },
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      phoneNumber: env.TWILIO_PHONE_NUMBER,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID
    }
  };
}

function validateCoreConfig(config) {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  if (config.environment === 'production' && config.corsOrigin.includes('localhost')) {
    throw new Error('CORS_ORIGIN must be a production origin when NODE_ENV=production');
  }
  return config;
}

module.exports = { loadConfig, validateCoreConfig };
