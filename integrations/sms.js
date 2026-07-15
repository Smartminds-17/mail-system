const twilio = require('twilio');
const { loadConfig } = require('../config');

function createSmsClient(config = loadConfig()) {
  const settings = config.twilio;
  if (!settings.accountSid || !settings.authToken) throw new Error('Twilio is not configured');
  if (!settings.messagingServiceSid && !settings.phoneNumber) throw new Error('A Twilio sender is required');
  const client = twilio(settings.accountSid, settings.authToken, { timeout: 10000 });
  return {
    send({ to, body }) {
      const message = { to, body };
      if (settings.messagingServiceSid) message.messagingServiceSid = settings.messagingServiceSid;
      else message.from = settings.phoneNumber;
      return client.messages.create(message);
    }
  };
}

module.exports = { createSmsClient };
