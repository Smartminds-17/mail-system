const { randomUUID } = require('node:crypto');
const { loadConfig } = require('../config');
const { createEmailClient } = require('../integrations/email');
const { personalize } = require('./personalization');
const { mapWithConcurrency } = require('./concurrency');
const { preflightRecipients } = require('./emailPreflight');
const { campaignSummary } = require('./campaignSummary');

async function deliverCampaign(db, jobId) {
  const [[job]] = await db.query('SELECT * FROM email_jobs WHERE id = ?', [jobId]);
  if (!job) throw new Error('Campaign not found');
  const [recipients] = await db.query(
    "SELECT * FROM email_recipients WHERE job_id = ? AND status = 'pending'", [jobId]
  );
  const config = loadConfig();
  const preflight = await preflightRecipients(recipients);
  const sendable = preflight.filter((item) => item.sendable).map((item) => item.recipient);
  const skipped = preflight.filter((item) => !item.sendable);
  await mapWithConcurrency(skipped, config.sendConcurrency, ({ recipient }) =>
    db.query("UPDATE email_recipients SET status = 'failed' WHERE id = ?", [recipient.id]));
  const client = sendable.length ? createEmailClient() : null;
  let sent = 0;
  let failed = 0;
  await mapWithConcurrency(sendable, config.sendConcurrency, async (recipient) => {
    try {
      const trackingId = randomUUID();
      const html = personalize(job.body, {
        name: recipient.recipient_name, email: recipient.recipient_email
      }) + `<img src="${config.publicBaseUrl}/track/open/${trackingId}" width="1" height="1" alt="" />`;
      await client.send({ to: recipient.recipient_email, subject: job.subject, html });
      await db.query("UPDATE email_recipients SET status = 'sent', sent_at = NOW() WHERE id = ?", [recipient.id]);
      await db.query('INSERT INTO email_logs (tracking_id, recipient_id, opened, opened_at) VALUES (?, ?, false, NULL)', [trackingId, recipient.id]);
      sent++;
    } catch (error) {
      await db.query("UPDATE email_recipients SET status = 'failed' WHERE id = ?", [recipient.id]);
      failed++;
    }
  });
  const status = failed || skipped.length ? 'partially_failed' : 'sent';
  await db.query('UPDATE email_jobs SET status = ?, completed_at = NOW() WHERE id = ?', [status, jobId]);
  return {
    message: campaignSummary({ total: recipients.length, sent, failed, skipped: skipped.length }),
    sent, failed, skipped: skipped.length, total: recipients.length
  };
}

module.exports = { deliverCampaign };
