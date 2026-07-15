const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { dbPromise } = require('../db');
const { verifyToken } = require('./auth');
const { loadConfig } = require('../config');
const { createSmsClient } = require('../integrations/sms');
const { personalize } = require('../services/personalization');
const { mapWithConcurrency } = require('../services/concurrency');
const { validateCampaign, validPhone } = require('../services/validation');
const { sendLimiter } = require('../middleware/rateLimits');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Get SMS campaigns
router.get('/campaigns', verifyToken, async (req, res) => {
  try {
    const db = await dbPromise;
    const [campaigns] = await db.query(
      'SELECT * FROM sms_jobs WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new SMS campaign
router.post('/campaigns', verifyToken, upload.single('csvFile'), async (req, res) => {
  try {
    const validation = validateCampaign(req.body, 'sms');
    if (validation.error) return res.status(400).json({ error: validation.error });
    const { subject, body } = validation.value;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Check if user exists
    const db = await dbPromise;
    const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0) {
      return res.status(400).json({ error: 'User does not exist' });
    }

    // Create SMS job
    const [jobResult] = await db.query(
      'INSERT INTO sms_jobs (user_id, subject, body) VALUES (?, ?, ?)',
      [userId, subject, body]
    );

    const jobId = jobResult.insertId;

    // Parse CSV and insert recipients
    const recipients = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        if (data.Phone && data.Name && validPhone(data.Phone)) {
          recipients.push([jobId, data.Name.trim().slice(0, 100), data.Phone.trim(), 'pending']);
        }
      })
      .on('end', async () => {
        if (recipients.length > 0) {
          const query = 'INSERT INTO sms_recipients (job_id, recipient_name, recipient_phone, status) VALUES ?';
          await db.query(query, [recipients]);
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.status(201).json({
          message: 'SMS campaign created successfully',
          jobId,
          recipientCount: recipients.length
        });
      });
  } catch (error) {
    console.error(error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send SMS campaign
router.post('/campaigns/:id/send', verifyToken, sendLimiter, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    // Get campaign details
    const db = await dbPromise;
    const [jobs] = await db.query(
      'SELECT * FROM sms_jobs WHERE id = ? AND user_id = ?',
      [jobId, userId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const job = jobs[0];

    // Get recipients
    const [recipients] = await db.query(
      'SELECT * FROM sms_recipients WHERE job_id = ? AND status = ?',
      [jobId, 'pending']
    );

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients to send to' });
    }

    const smsClient = createSmsClient();
    const config = loadConfig();
    let sentCount = 0;
    let failedCount = 0;

    await mapWithConcurrency(recipients, config.sendConcurrency, async (recipient) => {
      try {
        const message = await smsClient.send({
          body: personalize(job.body, { name: recipient.recipient_name }),
          to: recipient.recipient_phone
        });

        await db.query(
          'UPDATE sms_recipients SET status = ?, sent_at = NOW() WHERE id = ?',
          ['sent', recipient.id]
        );

        await db.query(
          'INSERT INTO sms_logs (message_sid, recipient_id, status) VALUES (?, ?, ?)',
          [message.sid, recipient.id, message.status]
        );

        sentCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.recipient_phone}:`, error);
        await db.query(
          'UPDATE sms_recipients SET status = ? WHERE id = ?',
          ['failed', recipient.id]
        );
        failedCount++;
      }
    });

    res.json({
      message: 'SMS campaign sent successfully',
      sent: sentCount,
      failed: failedCount,
      total: recipients.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get SMS campaign logs
router.get('/campaigns/:id/logs', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    const db = await dbPromise;
    const [logs] = await db.query(`
      SELECT sr.*, sl.status as log_status, sl.updated_at
      FROM sms_recipients sr
      LEFT JOIN sms_logs sl ON sr.id = sl.recipient_id
      JOIN sms_jobs sj ON sr.job_id = sj.id
      WHERE sr.job_id = ? AND sj.user_id = ?
      ORDER BY sr.sent_at DESC
    `, [jobId, userId]);

    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend SMS to specific recipient
router.post('/campaigns/:jobId/recipients/:recipientId/resend', verifyToken, sendLimiter, async (req, res) => {
  try {
    const { jobId, recipientId } = req.params;
    const userId = req.user.userId;

    const db = await dbPromise;

    // Verify ownership
    const [recipient] = await db.query(`
      SELECT sr.*, sj.subject, sj.body
      FROM sms_recipients sr
      JOIN sms_jobs sj ON sr.job_id = sj.id
      WHERE sr.id = ? AND sj.user_id = ? AND sj.id = ?
    `, [recipientId, userId, jobId]);

    if (recipient.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const rec = recipient[0];

    const message = await createSmsClient().send({
      body: personalize(rec.body, { name: rec.recipient_name }),
      to: rec.recipient_phone
    });

    // Update status
    await db.query(
      'UPDATE sms_recipients SET status = ?, sent_at = NOW() WHERE id = ?',
      ['sent', recipientId]
    );

    // Update or insert log
    await db.query(
      'INSERT INTO sms_logs (message_sid, recipient_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE message_sid = ?',
      [message.sid, recipientId, message.status, message.sid]
    );

    res.json({ message: 'SMS resent successfully' });
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
      DELETE sr FROM sms_recipients sr
      JOIN sms_jobs sj ON sr.job_id = sj.id
      WHERE sr.id = ? AND sj.user_id = ? AND sj.id = ?
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

// Delete SMS campaign
router.delete('/campaigns/:id', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.userId;

    const db = await dbPromise;

    // Verify ownership
    const [result] = await db.query(
      'DELETE FROM sms_jobs WHERE id = ? AND user_id = ?',
      [jobId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'SMS campaign deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
