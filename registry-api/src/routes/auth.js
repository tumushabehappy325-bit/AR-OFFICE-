const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../data/store');
const validate = require('../middleware/validate');
const HttpError = require('../utils/httpError');
const { loginSchema } = require('../schemas');

const router = express.Router();

// POST /api/auth/login  (public)
// Students log in with their registration number, staff and admin with their email.
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await store.findUserByUsername(username);
    // Older/manual Neon rows may contain the original password in password_hash.
    // Keep those accounts usable while preferring bcrypt for all new passwords.
    const storedPassword = user?.passwordHash;
    const isBcryptHash = typeof storedPassword === 'string' && /^\$2[aby]\$\d{2}\$/.test(storedPassword);
    const ok = user && (isBcryptHash
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword);
    if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');

    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({
      success: true,
      data: { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } },
    });
  } catch (err) { next(err); }
});

module.exports = router;
