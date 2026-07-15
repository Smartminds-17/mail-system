const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateRegistration(input) {
  const name = cleanText(input.name);
  const email = cleanText(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  if (name.length < 2 || name.length > 100) return { error: 'Name must be between 2 and 100 characters' };
  if (!EMAIL_PATTERN.test(email) || email.length > 150) return { error: 'Enter a valid email address' };
  if (password.length < 8 || password.length > 128) return { error: 'Password must be between 8 and 128 characters' };
  return { value: { name, email, password } };
}

function validateLogin(input) {
  const email = cleanText(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  if (!EMAIL_PATTERN.test(email) || !password) return { error: 'Email and password are required' };
  return { value: { email, password } };
}

function validateCampaign(input, type = 'email') {
  const subject = cleanText(input.subject);
  const body = cleanText(input.body);
  const bodyLimit = type === 'sms' ? 1600 : 100000;
  if (!subject || subject.length > 200) return { error: 'Subject is required and must not exceed 200 characters' };
  if (!body || body.length > bodyLimit) return { error: `Message is required and must not exceed ${bodyLimit} characters` };
  return { value: { subject, body } };
}

function validEmail(value) { return EMAIL_PATTERN.test(cleanText(value)); }
function validPhone(value) { return PHONE_PATTERN.test(cleanText(value)); }

module.exports = { validateRegistration, validateLogin, validateCampaign, validEmail, validPhone };
