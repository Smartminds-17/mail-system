const dns = require('node:dns').promises;
const { mapWithConcurrency } = require('./concurrency');

const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const DEFINITIVE_DNS_ERRORS = new Set(['ENODATA', 'ENOTFOUND', 'ENXDOMAIN']);

function emailDomain(email) {
  return String(email).trim().toLowerCase().split('@').pop();
}

function isReservedDomain(domain) {
  return [...RESERVED_DOMAINS].some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`));
}

async function inspectDomain(domain, resolveMx = dns.resolveMx) {
  if (isReservedDomain(domain)) {
    return { sendable: false, reason: 'placeholder_domain' };
  }

  try {
    const records = await resolveMx(domain);
    return records.length > 0
      ? { sendable: true, reason: 'mx_found' }
      : { sendable: false, reason: 'no_mail_server' };
  } catch (error) {
    if (DEFINITIVE_DNS_ERRORS.has(error.code)) {
      return { sendable: false, reason: 'no_mail_server' };
    }
    // A temporary DNS failure should not permanently reject a real address.
    return { sendable: true, reason: 'dns_check_unavailable' };
  }
}

async function preflightRecipients(recipients, resolveMx = dns.resolveMx, concurrency = 10) {
  const domains = [...new Set(recipients.map((recipient) => emailDomain(recipient.recipient_email)))];
  const checks = await mapWithConcurrency(
    domains,
    concurrency,
    async (domain) => [domain, await inspectDomain(domain, resolveMx)]
  );
  const byDomain = new Map(checks);

  return recipients.map((recipient) => ({
    recipient,
    ...byDomain.get(emailDomain(recipient.recipient_email))
  }));
}

module.exports = { emailDomain, inspectDomain, isReservedDomain, preflightRecipients };
