CREATE DATABASE IF NOT EXISTS email_automation;
USE email_automation;

-- Drop tables if they exist (to avoid conflicts)
DROP TABLE IF EXISTS sms_logs;
DROP TABLE IF EXISTS sms_recipients;
DROP TABLE IF EXISTS sms_jobs;
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS email_recipients;
DROP TABLE IF EXISTS email_jobs;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email jobs table
CREATE TABLE email_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status ENUM('draft', 'scheduled', 'sending', 'sent', 'partially_failed', 'cancelled') NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email recipients table
CREATE TABLE email_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(150) NOT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  FOREIGN KEY (job_id) REFERENCES email_jobs(id) ON DELETE CASCADE
);

-- Email logs table for tracking
CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_id VARCHAR(255) UNIQUE NOT NULL,
  recipient_id INT UNIQUE NOT NULL,
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP NULL,
  FOREIGN KEY (recipient_id) REFERENCES email_recipients(id) ON DELETE CASCADE
);

-- SMS jobs table
CREATE TABLE sms_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SMS recipients table
CREATE TABLE sms_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  FOREIGN KEY (job_id) REFERENCES sms_jobs(id) ON DELETE CASCADE
);

-- SMS logs table for tracking
CREATE TABLE sms_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_sid VARCHAR(255) UNIQUE NOT NULL,
  recipient_id INT NOT NULL,
  status VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES sms_recipients(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_user_id ON email_jobs(user_id);
CREATE INDEX idx_job_id ON email_recipients(job_id);
CREATE INDEX idx_email_jobs_due ON email_jobs(status, scheduled_at);
CREATE INDEX idx_status ON email_recipients(status);
CREATE INDEX idx_tracking_id ON email_logs(tracking_id);
CREATE INDEX idx_recipient_id ON email_logs(recipient_id);

CREATE INDEX idx_sms_user_id ON sms_jobs(user_id);
CREATE INDEX idx_sms_job_id ON sms_recipients(job_id);
CREATE INDEX idx_sms_status ON sms_recipients(status);
CREATE INDEX idx_sms_message_sid ON sms_logs(message_sid);
CREATE INDEX idx_sms_recipient_id ON sms_logs(recipient_id);

-- Fresh databases already include the scheduling columns from migration 001.
CREATE TABLE schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO schema_migrations (name) VALUES ('001_email_scheduling.sql');
