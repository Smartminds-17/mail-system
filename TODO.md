# Mail System Features TODO

## Plan Summary
Implement a comprehensive mail system with dashboards for emails, SMS, analytics, navigation, and message creation modal.

## Features to Implement

### Main Dashboard for Emails
- [x] Display the single email sent to multiple recipients (campaigns list).
- [x] Show overview of message subject (in campaign cards).
- List all recipients with:
  - [x] Selection menu (option) - checkboxes for bulk actions
  - [x] Name of recipient (in logs view)
  - [x] Email (in logs view)
  - [x] Status (sent/failed) (in logs view)
  - [x] Status (read/not read) - based on opened/not opened (add to logs view)
  - [x] 3 dotted menu for options: resend, delete (and other possible actions) - per recipient actions

### Main Dashboard for SMS
- [x] Display the single SMS sent to multiple recipients (campaigns list).
- [x] Show overview of message subject (in campaign cards).
- List all recipients with:
  - [ ] Selection menu (option) - checkboxes for bulk actions
  - [x] Name of recipient (in logs view)
  - [x] Phone number (in logs view)
  - [x] Status (sent/failed) (in logs view)
  - [ ] Delivered status (if possible later)

### Main Dashboard for Analytics Graphs (Emails Only)
- Top 2-3 boxes:
  - [x] Box 1: Total emails sent by user
  - [x] Box 2: How many opened
  - [x] Box 3: Open rate (optional)
- [x] Graph: Email sent against opened (line chart over time)

### Page Structure
- [x] Decide on page layout: Analytics and emails on one page with SMS separate, or switching button in email page.
- [x] Implement separate pages or tabs for Email/SMS/Analytics.

### Buttons
- [x] Logout button
- [x] Create new email/SMS button (on top) - "New Campaign" for emails; need for SMS

### Main Navigation (Sidebar)
- [x] Dashboard
- [x] Analytics
- [x] SMS
- [ ] Account settings (discuss later)
- [ ] Settings

### Creating a New Message or Email (Modal)
- [x] Subject field
- [x] Main message
- [x] Upload section: Upload CSV file with sections for name, email (note: task says "css file" - likely typo for CSV; add phone number support later)
- [x] Button to create mail after uploading
- [x] Cancel button

### Additional Missing Features
- [x] Extend CSV upload to include phone number column for SMS recipients (CSV supports Name, Phone).
- [x] Integrate Twilio API for SMS sending (awaiting phone number for 'From').
- [x] Add read status to email recipient logs (pull from email_logs.opened).
- [x] Add bulk selection and actions (resend, delete) to recipient lists.
- [x] Implement sidebar navigation with links to Dashboard, Analytics, SMS, etc.
- [x] Create separate SMS dashboard page with similar structure to emails.
- [ ] Add SMS analytics if needed (task focuses on emails).
- [ ] Update database with SMS tables (run SQL in phpMyAdmin or XAMPP).
- [x] Add delete campaign functionality.

## Previous Email Tracking Implementation (Completed)
1. **Database Updates** ✅
   - Updated `database.sql` to add the `email_logs` table with columns: `id`, `tracking_id` (VARCHAR, unique), `opened` (BOOLEAN), `opened_at` (TIMESTAMP), `recipient_id` (foreign key to email_recipients).

2. **Backend Tracking Endpoint** ✅
   - Added a new GET route in `server.js` at `/track/open/:id` to handle tracking pixel requests, update the database when an email is opened, and return a 1x1 transparent PNG image.

3. **Email Sending Integration** ✅
   - Modified the send function in `routes/emails.js` to:
     - Generate a unique UUID for each recipient.
     - Embed a tracking pixel in the email body: `<img src="http://localhost:3000/track/open/<trackingId>" width="1" height="1" />`.
     - Insert a record into `email_logs` with the tracking ID and initial `opened = false`.

4. **Analytics Route** ✅
   - Added a new GET route in `routes/emails.js` (e.g., `/analytics`) to aggregate data: total emails sent, total opens, open rate, and data for time-based graphs.

5. **Frontend Dependencies** ✅
   - Updated `package.json` to add `chart.js` and `uuid` dependencies.

6. **Frontend Analytics UI** ✅
   - Updated `public/dashboard.html` to include a new analytics section with placeholders for charts.
   - Updated `public/script.js` to fetch analytics data and render line charts (emails sent vs opens over time) and pie charts (opened vs unopened) using Chart.js.

7. **Testing and Setup** ✅
   - Run database setup to apply schema changes.
   - Test sending a campaign with tracking pixels.
   - Verify the analytics dashboard loads and displays charts.
