const csv = require('csv-parser');
const fs = require('node:fs');
const { validEmail } = require('./validation');

const MAX_RECIPIENTS = 10000;

function analyzeRecipientRows(rows) {
  const recipients = [];
  const issues = [];
  const seenEmails = new Set();
  let duplicates = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = typeof row.Name === 'string' ? row.Name.trim() : '';
    const email = typeof row.Email === 'string' ? row.Email.trim().toLowerCase() : '';

    if (!name) {
      issues.push({ row: rowNumber, email, reason: 'Name is required' });
      return;
    }
    if (!validEmail(email)) {
      issues.push({ row: rowNumber, email, reason: 'Email address is invalid' });
      return;
    }
    if (seenEmails.has(email)) {
      duplicates++;
      issues.push({ row: rowNumber, email, reason: 'Duplicate email address' });
      return;
    }

    seenEmails.add(email);
    recipients.push({ name: name.slice(0, 100), email });
  });

  return {
    recipients,
    report: {
      totalRows: rows.length,
      validRows: recipients.length,
      invalidRows: issues.length - duplicates,
      duplicates,
      issues: issues.slice(0, 20),
      truncatedIssues: Math.max(0, issues.length - 20)
    }
  };
}

function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath).pipe(csv());

    stream.on('data', (row) => {
      if (rows.length >= MAX_RECIPIENTS) {
        stream.destroy(new Error(`CSV cannot exceed ${MAX_RECIPIENTS} recipients`));
        return;
      }
      rows.push(row);
    });
    stream.on('end', () => resolve(rows));
    stream.on('error', reject);
  });
}

module.exports = { MAX_RECIPIENTS, analyzeRecipientRows, readCsvRows };
