const nodemailer = require('nodemailer');
const { loadConfig } = require('../config');

function createEmailClient(config = loadConfig()) {
  if (!config.smtp.user || !config.smtp.password) throw new Error('SMTP is not configured');
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: config.smtp.user, pass: config.smtp.password }
  });
  return {
    send({ to, subject, html }) {
      return transporter.sendMail({ from: config.smtp.user, to, subject, html });
    }
  };
}

module.exports = { createEmailClient };
