ALTER TABLE email_jobs
  ADD COLUMN status ENUM('draft', 'scheduled', 'sending', 'sent', 'partially_failed', 'cancelled') NOT NULL DEFAULT 'draft' AFTER body,
  ADD COLUMN scheduled_at DATETIME NULL AFTER status,
  ADD COLUMN started_at DATETIME NULL AFTER scheduled_at,
  ADD COLUMN completed_at DATETIME NULL AFTER started_at,
  ADD INDEX idx_email_jobs_due (status, scheduled_at);
