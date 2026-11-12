const jwt = require('jsonwebtoken');
const config = require('../config');
const HttpError = require('../utils/httpError');
const store = require('../data/store');

// Checks the Authorization: Bearer <token> header and attaches req.user
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header. Use: Bearer <token>');
    }
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new HttpError(401, 'INVALID_TOKEN', 'Token is invalid or has expired. Please log in again.');
    }
    const user = await store.findUserById(payload.sub);
    if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'User no longer exists.');
    req.user = { id: user.id, username: user.username, name: user.name, role: user.role, program: user.program, graduationYear: user.graduationYear };
    next();
  } catch (err) {
    next(err);
  }
}

// Allows only the listed roles, for example requireRole('staff', 'admin').
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'FORBIDDEN', `This action requires one of these roles: ${roles.join(', ')}.`));
  }
  next();
};

module.exports = { authenticate, requireRole };
