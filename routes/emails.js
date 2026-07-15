const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('node:crypto');
const { dbPromise } = require('../db');
const { verifyToken } = require('./auth');
const { loadConfig } = require('../config');
const { createEmailClient } = require('../integrations/email');
const { personalize } = require('../services/personalization');
const { mapWithConcurrency } = require('../services/concurrency');
const { preflightRecipients } = require('../services/emailPreflight');
const { campaignSummary } = require('../services/campaignSummary');
const { analyzeRecipientRows, readCsvRows } = require('../services/csvRecipients');
const { validateCampaign } = require('../services/validation');
const { sendLimiter } = require('../middleware/rateLimits');
const { parseSchedule } = require('../services/scheduling');

const router = express.Router();

router.post('/campaigns/:id/schedule', verifyToken, async (req, res) => {
  const parsed = parseSchedule(req.body.scheduledAt);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const db = await dbPromise;
  const [result] = await db.query(
    "UPDATE email_jobs SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND user_id = ? AND status IN ('draft','scheduled')",
    [parsed.value, req.params.id, req.user.userId]
  );
  if (!result.affectedRows) return res.status(409).json({ error: 'Campaign cannot be scheduled from its current state' });
  res.json({ message: 'Campaign scheduled', scheduledAt: parsed.value.toISOString() });
});

router.post('/campaigns/:id/cancel', verifyToken, async (req, res) => {
  const db = await dbPromise;
  const [result] = await db.query(
    "UPDATE email_jobs SET status = 'cancelled', scheduled_at = NULL WHERE id = ? AND user_id = ? AND status IN ('draft','scheduled')",
    [req.params.id, req.user.userId]
  );
  if (!result.affectedRows) return res.status(409).json({ error: 'Campaign cannot be cancelled from its current state' });
  res.json({ message: 'Campaign cancelled' });
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

async function removeUpload(file) {
  if (file) await fs.promises.unlink(file.path).catch(() => {});
}

router.post('/campaigns/analyze', verifyToken, upload.single('csvFile'), async (req, res) => {
  try {
    const validation = validateCampaign(req.body, 'email');
    if (validation.error) return res.status(400).json({ error: validation.error });
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

    const rows = await readCsvRows(req.file.path);
    const analysis = analyzeRecipientRows(rows);
    const sample = analysis.recipients[0];

    res.json({
      ...analysis.report,
      preview: sample ? {
        recipient: sample,
        subject: validation.value.subject,
        html: personalize(validation.value.body, sample)
      } : null
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Unable to analyze CSV file' });
  } finally {
    await removeUpload(req.file);
  }
});

router.post('/campaigns/test-send', verifyToken, sendLimiter, async (req, res) => {
  try {
    const validation = validateCampaign(req.body, 'email');
    if (validation.error) return res.status(400).json({ error: validation.error });

    const db = await dbPromise;
    const [users] = await db.query('SELECT name, email FROM users WHERE id = ?', [req.user.userId]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    await createEmailClient().send({
      to: user.email,
      subject: `[Test] ${validation.value.subject}`,
      html: personalize(validation.value.body, user)
    });

    res.json({ message: `Test email sent to ${user.email}` });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Test email could not be sent. Check the SMTP configuration.' });
  }
});

// Get email campaigns
router.get('/campaigns', verifyToken, async (req, res) => {
  try {
    const db = await dbPromise;
    const [campaigns] = await db.query(
      'SELECT * FROM email_jobs WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new email campaign
router.post('/campaigns', verifyToken, upload.single('csvFile'), async (req, res) => {
  try {
    const validation = validateCampaign(req.body, 'email');
    if (validation.error) return res.status(400).json({ error: validation.error });
    const { subject, body } = validation.value;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const rows = await readCsvRows(req.file.path);
    const analysis = analyzeRecipientRows(rows);
    if (!analysis.recipients.length) {
      return res.status(400).json({ error: 'CSV contains no valid recipients', report: analysis.report });
    }

    // Check if user exists
    const db = await dbPromise;
    const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0) {
      return res.status(400).json({ error: 'User does not exist' });
    }

    const connection = await db.getConnection();
    let jobId;
    try {
      await connection.beginTransaction();
      const [jobResult] = await connection.query(
        'INSERT INTO email_jobs (user_id, subject, body) VALUES (?, ?, ?)',
        [userId, subject, body]
      );
      jobId = jobResult.insertId;

      const recipients = analysis.recipients.map((recipient) => [
        jobId, recipient.name, recipient.email, 'pending'
      ]);
      await connection.query(
        'INSERT INTO email_recipients (job_id, recipient_name, recipient_email, status) VALUES ?',
        [recipients]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.status(201).json({
      message: 'Campaign created successfully',
      jobId,
      recipientCount: analysis.recipients.length,
      validationReport: analysis.report
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await removeUpload(req.file);
  }
});

// Send email campaign
router.post('/campaigns/:id/send', verifyToken, sendLimiter, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    // Get campaign details
    const db = await dbPromise;
    const [jobs] = await db.query(
      'SELECT * FROM email_jobs WHERE id = ? AND user_id = ?',
      [jobId, userId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const job = jobs[0];
    if (!['draft', 'scheduled'].includes(job.status || 'draft')) {
      return res.status(409).json({ error: 'Campaign cannot be sent from its current state' });
    }
    const [claim] = await db.query(
      "UPDATE email_jobs SET status = 'sending', started_at = NOW() WHERE id = ? AND user_id = ? AND status IN ('draft','scheduled')",
      [jobId, userId]
    );
    if (!claim.affectedRows) return res.status(409).json({ error: 'Campaign is already being processed' });

    // Get recipients
    const [recipients] = await db.query(
      'SELECT * FROM email_recipients WHERE job_id = ? AND status = ?',
      [jobId, 'pending']
    );

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients to send to' });
    }

    const config = loadConfig();
    const preflight = await preflightRecipients(recipients);
    const sendable = preflight.filter((result) => result.sendable).map((result) => result.recipient);
    const skipped = preflight.filter((result) => !result.sendable);

    await mapWithConcurrency(skipped, config.sendConcurrency, ({ recipient }) => db.query(
      'UPDATE email_recipients SET status = ? WHERE id = ?',
      ['failed', recipient.id]
    ));

    const emailClient = sendable.length ? createEmailClient() : null;

    let sentCount = 0;
    let failedCount = 0;

    await mapWithConcurrency(sendable, config.sendConcurrency, async (recipient) => {
      try {
        const trackingId = randomUUID();
        const personalizedBody = personalize(job.body, {
          name: recipient.recipient_name,
          email: recipient.recipient_email
        }) + `<img src="${config.publicBaseUrl}/track/open/${trackingId}" width="1" height="1" alt="" />`;

        await emailClient.send({
          to: recipient.recipient_email,
          subject: job.subject,
          html: personalizedBody
        });

        await db.query(
          'UPDATE email_recipients SET status = ?, sent_at = NOW() WHERE id = ?',
          ['sent', recipient.id]
        );

        await db.query(
          'INSERT INTO email_logs (tracking_id, recipient_id, opened, opened_at) VALUES (?, ?, false, NULL)',
          [trackingId, recipient.id]
        );

        sentCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.recipient_email}:`, error);
        await db.query(
          'UPDATE email_recipients SET status = ? WHERE id = ?',
          ['failed', recipient.id]
        );
        failedCount++;
      }
    });

    await db.query(
      'UPDATE email_jobs SET status = ?, completed_at = NOW() WHERE id = ?',
      [failedCount || skipped.length ? 'partially_failed' : 'sent', jobId]
    );

    res.json({
      message: campaignSummary({
        total: recipients.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skipped.length
      }),
      sent: sentCount,
      failed: failedCount,
      skipped: skipped.length,
      skippedReasons: skipped.reduce((counts, result) => {
        counts[result.reason] = (counts[result.reason] || 0) + 1;
        return counts;
      }, {}),
      total: recipients.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get campaign logs
router.get('/campaigns/:id/logs', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    const db = await dbPromise;
    const [logs] = await db.query(`
      SELECT er.*, el.opened, el.opened_at
      FROM email_recipients er
      LEFT JOIN email_logs el ON er.id = el.recipient_id
      JOIN email_jobs ej ON er.job_id = ej.id
      WHERE er.job_id = ? AND ej.user_id = ?
      ORDER BY er.sent_at DESC
    `, [jobId, userId]);

    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend email to specific recipient
router.post('/campaigns/:jobId/recipients/:recipientId/resend', verifyToken, sendLimiter, async (req, res) => {
  try {
    const { jobId, recipientId } = req.params;
    const userId = req.user.userId;

    const db = await dbPromise;

    // Verify ownership
    const [recipient] = await db.query(`
      SELECT er.*, ej.subject, ej.body
      FROM email_recipients er
      JOIN email_jobs ej ON er.job_id = ej.id
      WHERE er.id = ? AND ej.user_id = ? AND ej.id = ?
    `, [recipientId, userId, jobId]);

    if (recipient.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const rec = recipient[0];

    const [preflight] = await preflightRecipients([rec]);
    if (!preflight.sendable) {
      return res.status(400).json({
        error: 'This email address cannot receive mail',
        reason: preflight.reason
      });
    }

    const emailClient = createEmailClient();
    const config = loadConfig();

    const trackingId = randomUUID();
    const personalizedBody = personalize(rec.body, {
      name: rec.recipient_name,
      email: rec.recipient_email
    }) + `<img src="${config.publicBaseUrl}/track/open/${trackingId}" width="1" height="1" alt="" />`;

    await emailClient.send({
      to: rec.recipient_email,
      subject: rec.subject,
      html: personalizedBody
    });

    // Update status
    await db.query(
      'UPDATE email_recipients SET status = ?, sent_at = NOW() WHERE id = ?',
      ['sent', recipientId]
    );

    // Update or insert log
    await db.query(
      'INSERT INTO email_logs (tracking_id, recipient_id, opened, opened_at) VALUES (?, ?, false, NULL) ON DUPLICATE KEY UPDATE tracking_id = ?',
      [trackingId, recipientId, trackingId]
    );

    res.json({ message: 'Email resent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete recipient
router.delete('/campaigns/:jobId/recipients/:recipientId', verifyToken, async (req, res) => {
  try {
    const { jobId, recipientId } = req.params;
    const userId = req.user.userId;

    const db = await dbPromise;

    // Verify ownership
    const [result] = await db.query(`
      DELETE er FROM email_recipients er
      JOIN email_jobs ej ON er.job_id = ej.id
      WHERE er.id = ? AND ej.user_id = ? AND ej.id = ?
    `, [recipientId, userId, jobId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analytics route
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const db = await dbPromise;
    const userId = req.user.userId;

    // Get total sent and opened
    const [stats] = await db.query(`
      SELECT
        COUNT(*) AS total_sent,
        SUM(CASE WHEN opened THEN 1 ELSE 0 END) AS total_opened
      FROM email_logs el
      JOIN email_recipients er ON el.recipient_id = er.id
      JOIN email_jobs ej ON er.job_id = ej.id
      WHERE ej.user_id = ?
    `, [userId]);

    const totalSent = stats[0].total_sent || 0;
    const totalOpened = stats[0].total_opened || 0;
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

    // Get data for time-based graph (last 30 days)
    const [timeData] = await db.query(`
      SELECT
        DATE(er.sent_at) AS date,
        COUNT(*) AS sent,
        SUM(CASE WHEN el.opened THEN 1 ELSE 0 END) AS opened
      FROM email_recipients er
      LEFT JOIN email_logs el ON er.id = el.recipient_id
      JOIN email_jobs ej ON er.job_id = ej.id
      WHERE ej.user_id = ? AND er.sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(er.sent_at)
      ORDER BY date
    `, [userId]);

    res.json({
      totalSent,
      totalOpened,
      openRate: Math.round(openRate * 100) / 100,
      timeData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete campaign
router.delete('/campaigns/:id', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    const db = await dbPromise;

    // Verify ownership
    const [result] = await db.query(
      'DELETE FROM email_jobs WHERE id = ? AND user_id = ?',
      [jobId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
