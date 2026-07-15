const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, validateCoreConfig } = require('../config');
const { escapeHtml, personalize } = require('../services/personalization');
const { validateRegistration, validateCampaign, validPhone } = require('../services/validation');
const { mapWithConcurrency } = require('../services/concurrency');
const { inspectDomain, preflightRecipients } = require('../services/emailPreflight');
const { campaignSummary } = require('../services/campaignSummary');
const { analyzeRecipientRows } = require('../services/csvRecipients');
const { canTransition, parseSchedule, runDueCampaigns } = require('../services/scheduling');

test('escapes recipient data before inserting it into email HTML', () => {
  assert.equal(personalize('Hello {{Name}}', { name: '<script>alert(1)</script>' }), 'Hello &lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('A&B'), 'A&amp;B');
});

test('normalizes a valid registration', () => {
  const result = validateRegistration({ name: ' Jay ', email: 'JAY@example.com ', password: 'long-password' });
  assert.deepEqual(result.value, { name: 'Jay', email: 'jay@example.com', password: 'long-password' });
});

test('rejects weak registration passwords and oversized SMS messages', () => {
  assert.match(validateRegistration({ name: 'Jay', email: 'jay@example.com', password: 'short' }).error, /Password/);
  assert.match(validateCampaign({ subject: 'Test', body: 'x'.repeat(1601) }, 'sms').error, /1600/);
});

test('accepts only E.164 recipient phone numbers', () => {
  assert.equal(validPhone('+255712345678'), true);
  assert.equal(validPhone('0712345678'), false);
});

test('rejects weak secrets and localhost CORS in production', () => {
  assert.throws(() => validateCoreConfig(loadConfig({ JWT_SECRET: 'short' })), /32 characters/);
  assert.throws(() => validateCoreConfig(loadConfig({
    NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), CORS_ORIGIN: 'http://localhost:3000'
  })), /production origin/);
});

test('processes every item while respecting the concurrency limit', async () => {
  let active = 0;
  let maximumActive = 0;
  const values = [1, 2, 3, 4, 5, 6];

  const results = await mapWithConcurrency(values, 2, async (value) => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });

  assert.deepEqual(results, [2, 4, 6, 8, 10, 12]);
  assert.equal(maximumActive, 2);
});

test('rejects invalid concurrency values', async () => {
  await assert.rejects(mapWithConcurrency([1], 0, async (value) => value), /positive integer/);
});

test('blocks placeholder email domains without making a DNS request', async () => {
  let calls = 0;
  const result = await inspectDomain('example.com', async () => {
    calls++;
    return [{ exchange: 'mail.example.com', priority: 10 }];
  });

  assert.deepEqual(result, { sendable: false, reason: 'placeholder_domain' });
  assert.equal(calls, 0);
});

test('classifies a domain with no mail server as unsendable', async () => {
  const error = Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
  const result = await inspectDomain('missing.test', async () => { throw error; });
  assert.deepEqual(result, { sendable: false, reason: 'no_mail_server' });
});

test('checks each unique recipient domain only once', async () => {
  let calls = 0;
  const recipients = [
    { recipient_email: 'one@valid.test' },
    { recipient_email: 'two@valid.test' }
  ];
  const results = await preflightRecipients(recipients, async () => {
    calls++;
    return [{ exchange: 'mail.valid.test', priority: 10 }];
  });

  assert.equal(calls, 1);
  assert.equal(results.every((result) => result.sendable), true);
});

test('builds a truthful campaign result summary', () => {
  assert.equal(
    campaignSummary({ total: 5, sent: 3, failed: 1, skipped: 1 }),
    '5 recipients processed, 3 accepted for sending, 1 invalid address skipped, 1 provider failure. Accepted messages can still bounce later.'
  );
});

test('reports invalid and duplicate CSV recipients without importing them', () => {
  const analysis = analyzeRecipientRows([
    { Name: ' Alice ', Email: 'ALICE@example.org' },
    { Name: 'Alice Again', Email: 'alice@example.org' },
    { Name: '', Email: 'missing-name@example.org' },
    { Name: 'Bad Email', Email: 'not-an-email' }
  ]);

  assert.deepEqual(analysis.recipients, [{ name: 'Alice', email: 'alice@example.org' }]);
  assert.equal(analysis.report.totalRows, 4);
  assert.equal(analysis.report.validRows, 1);
  assert.equal(analysis.report.invalidRows, 2);
  assert.equal(analysis.report.duplicates, 1);
});

test('limits validation issue details while preserving complete counts', () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ Name: `Person ${index}`, Email: 'invalid' }));
  const report = analyzeRecipientRows(rows).report;
  assert.equal(report.invalidRows, 25);
  assert.equal(report.issues.length, 20);
  assert.equal(report.truncatedIssues, 5);
});

test('validates scheduling times and lifecycle transitions', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  assert.match(parseSchedule('2026-07-15T09:00:00Z', now).error, /future/);
  assert.equal(parseSchedule('2026-07-15T11:00:00Z', now).value.toISOString(), '2026-07-15T11:00:00.000Z');
  assert.equal(canTransition('draft', 'scheduled'), true);
  assert.equal(canTransition('sent', 'scheduled'), false);
});

test('scheduler claims each due campaign before delivery', async () => {
  const delivered = [];
  const db = { async query(sql) {
    if (sql.startsWith('SELECT id')) return [[{ id: 7 }]];
    return [{ affectedRows: 1 }];
  } };
  const processed = await runDueCampaigns(db, async (_db, id) => delivered.push(id));
  assert.equal(processed, 1);
  assert.deepEqual(delivered, [7]);
});
