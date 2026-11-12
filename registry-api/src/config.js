require('dotenv').config();

// Read server settings once so the rest of the app uses a single config source.
module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  databaseUrl: process.env.DATABASE_URL || '',
};
