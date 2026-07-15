const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbPromise } = require('../db');
const { loadConfig } = require('../config');
const { validateRegistration, validateLogin } = require('../services/validation');

const router = express.Router();

function getJwtSecret() {
  const secret = loadConfig().jwtSecret;
  if (!secret) throw new Error('JWT_SECRET is required');
  return secret;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const validation = validateRegistration(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const { name, email, password } = validation.value;

    // Get the database connection
    const db = await dbPromise;

    // Check if user exists
    const [existingUser] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: result.insertId },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const validation = validateLogin(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const { email, password } = validation.value;

    // Get the database connection
    const db = await dbPromise;

    // Check if user exists
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const verified = jwt.verify(token, getJwtSecret());
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { router, verifyToken, getJwtSecret };
