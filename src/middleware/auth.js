const jwt = require('jsonwebtoken');
const db = require('../db/database');
const HttpError = require('../utils/http-error');

function getToken(request) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('store_token='));

  if (!cookie) {
    return null;
  }

  return cookie.slice('store_token='.length);
}

function requireAuth(request, response, next) {
  const token = getToken(request);

  if (!token) {
    return next(new HttpError(401, 'Please log in to continue.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.sub);

    if (!user) {
      return next(new HttpError(401, 'Your account could not be found. Please log in again.'));
    }

    request.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'Your session has expired. Please log in again.'));
    }

    return next(error);
  }
}

module.exports = { getToken, requireAuth };
