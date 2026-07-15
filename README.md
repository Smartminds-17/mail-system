# Smart Email Automation System

A powerful email automation system that allows you to send personalized bulk emails with ease. Upload CSV files, compose personalized messages, and send emails to hundreds of recipients in minutes.

## Features

- 📧 **Bulk Email Sending** - Send personalized emails to thousands of recipients
- 📊 **CSV Upload** - Easy CSV file upload with automatic data parsing
- 🔐 **User Authentication** - Secure login and registration system
- 📈 **Campaign Management** - Create and manage multiple email campaigns
- 📋 **Email Logs** - Track sent emails with detailed logs
- ⚡ **Fast & Reliable** - Quick processing and reliable email delivery
- 🎨 **Modern UI** - Clean, responsive dashboard interface

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MySQL
- **Frontend**: HTML, CSS, JavaScript (no frameworks)
- **Email**: Nodemailer with SMTP
- **Authentication**: JWT tokens
- **File Upload**: Multer

## Quick Start

### 1. Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- Gmail account (or other SMTP provider)

### 2. Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd smart-email-automation
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
mysql -u root -p < database.sql
```

4. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=email_automation
JWT_SECRET=your-super-secret-jwt-key
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Gmail Setup (if using Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this app password in your `.env` file

### 4. Run the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Visit `http://localhost:3000` in your browser.

## Usage

### Creating Your First Campaign

1. **Register** a new account or **Login** if you already have one
2. **Create a Campaign**:
   - Click "New Campaign"
   - Enter email subject and body
   - Use `{{Name}}` and `{{Email}}` for personalization
   - Upload CSV file with columns: `Name, Email`
3. **Send Campaign**:
   - Click "Send Now" to start sending emails
   - Monitor progress in real-time
4. **View Logs**:
   - Click "View Logs" to see detailed sending results

### CSV Format Example

```csv
Name,Email
John Doe,john@example.com
Jane Smith,jane@example.com
Bob Johnson,bob@example.com
```

### Email Template Example

```
Subject: Welcome to Our Service, {{Name}}!

Body:
Hi {{Name}},

Welcome to our amazing service! We're excited to have you on board.

Your email: {{Email}}

Best regards,
The Team
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Email Campaigns
- `GET /api/emails/campaigns` - Get user's campaigns
- `POST /api/emails/campaigns` - Create new campaign
- `POST /api/emails/campaigns/:id/send` - Send campaign
- `GET /api/emails/campaigns/:id/logs` - Get campaign logs

## Configuration

### SMTP Settings

The system supports multiple email providers:

**Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Outlook:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**Yahoo:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

## Deployment

### Heroku Deployment

1. Create a Heroku app
2. Set environment variables in Heroku dashboard
3. Deploy code
4. Set up MySQL add-on (ClearDB or similar)

### AWS Deployment

1. Launch EC2 instance
2. Install Node.js and MySQL
3. Configure security groups
4. Deploy application
5. Set up domain (optional)

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the code comments

## Roadmap

- [ ] Email scheduling (send later)
- [ ] Email templates (save frequently used emails)
- [ ] Analytics (open rates, click tracking)
- [ ] Team accounts (for agencies)
- [ ] API integrations (Mailchimp, SendGrid)
- [ ] Mobile app
- [ ] Multi-language support

---

**Made with ❤️ for students, freelancers, and small businesses**
