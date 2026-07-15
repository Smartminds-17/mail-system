const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { loadConfig, validateCoreConfig } = require('./config');

const app = express();
const config = loadConfig();
const PORT = config.port;

// Middleware
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' }
});

// Database connection
const { db, dbPromise, checkDatabaseConnection } = require('./db');

// Routes
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');
const smsRoutes = require('./routes/sms');

app.use('/api/auth', authLimiter, authRoutes.router);
app.use('/api/emails', emailRoutes);
app.use('/api/sms', smsRoutes);

// Tracking endpoint for email opens
app.get("/track/open/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = await dbPromise;
    await db.query("UPDATE email_logs SET opened = true, opened_at = NOW() WHERE tracking_id = ?", [id]);

    // Send a 1x1 pixel transparent image
    const img = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAukB9pQxKpsAAAAASUVORK5CYII=",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": img.length
    });
    res.end(img);
  } catch (error) {
    console.error('Error updating email log:', error);
    res.status(500).end();
  }
});

// Serve frontend
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/sms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sms.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  try {
    validateCoreConfig(config);
    await checkDatabaseConnection();
    console.log('Connected to MySQL database');

    return app.listen(PORT, () => {
      console.log(`Server running on port http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start: MySQL connection failed. Check that MySQL is running and the DB_* settings are correct.');
    console.error(error.message);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, db, dbPromise, startServer };
