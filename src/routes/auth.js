const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const HttpError = require('../utils/http-error');
const { getToken } = require('../middleware/auth');

const router = express.Router();
const cookieName = 'store_token';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setSessionCookie(response, user) {
  const token = jwt.sign(
    { sub: String(user.id) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
  response.cookie(cookieName, token, cookieOptions);
}

router.post('/register', (request, response, next) => {
  try {
    const { name, email, password } = request.body;

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      throw new HttpError(400, 'Name must be between 2 and 80 characters.');
    }

    if (typeof email !== 'string' || email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new HttpError(400, 'Enter a valid email address.');
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      throw new HttpError(400, 'Password must be between 8 and 72 characters.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existingUser) {
      throw new HttpError(409, 'An account with this email already exists.');
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name.trim(), cleanEmail, passwordHash);

    const user = { id: Number(result.lastInsertRowid), name: name.trim(), email: cleanEmail };
    setSessionCookie(response, user);
    response.status(201).json({ user });
  } catch (error) {
    next(error.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ? new HttpError(409, 'An account with this email already exists.')
      : error);
  }
});

router.post('/login', (request, response, next) => {
  try {
    const { email, password } = request.body;

    if (typeof email !== 'string' || typeof password !== 'string'
      || email.length > 254 || password.length > 72) {
      throw new HttpError(400, 'Enter your email and password.');
    }

    const userRecord = db.prepare(`
      SELECT id, name, email, password_hash FROM users WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!userRecord || !bcrypt.compareSync(password, userRecord.password_hash)) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }

    const user = { id: userRecord.id, name: userRecord.name, email: userRecord.email };
    setSessionCookie(response, user);
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (request, response) => {
  response.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  response.status(200).json({ message: 'You have been logged out.' });
});

router.get('/me', (request, response) => {
  const token = getToken(request);
  if (!token) {
    return response.json({ user: null });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.sub);
    return response.json({ user: user || null });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return response.json({ user: null });
    }
    return response.status(500).json({ error: 'Unable to check the current session.' });
  }
});

module.exports = router;
