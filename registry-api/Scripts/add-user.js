/**
 * Add a user, or reset a password, in the live database.
 *
 * Add a student:
 *   node scripts/add-user.js add "2022/BCS/101" "Jane Doe" student "Pass@1234" "BSc Computer Science" 2025
 * Add staff or admin (program and year are optional):
 *   node scripts/add-user.js add "clerk@must.ac.ug" "John Clerk" staff "Pass@1234"
 * Reset a password:
 *   node scripts/add-user.js reset "2022/BCS/101" "NewPass@1234"
 *
 * Passwords are hashed with bcrypt before storage.
 * Uses DATABASE_URL from your .env file.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const ROLES = ['student', 'staff', 'admin'];

// Validate account details and store only a bcrypt password hash.
async function addUser(pool, { username, name, role, password, program, graduationYear }) {
  if (!username || !name || !role || !password) throw new Error('username, name, role and password are all required.');
  if (!ROLES.includes(role)) throw new Error(`role must be one of: ${ROLES.join(', ')} (lowercase).`);
  if (password.length < 8) throw new Error('password must be at least 8 characters.');
  if (role === 'student' && (!program || !graduationYear)) {
    throw new Error('students need a program and a graduation year (shown when their documents are verified).');
  }
  const year = graduationYear ? Number(graduationYear) : null;
  if (graduationYear && !Number.isInteger(year)) throw new Error('graduation year must be a number like 2025.');

  const hash = await bcrypt.hash(password, 8);
  try {
    await pool.query(
      'INSERT INTO users (id, username, name, role, program, graduation_year, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), username, name, role, program || null, year, hash]
    );
  } catch (err) {
    if (err.code === '23505') throw new Error(`A user with username "${username}" already exists. Use the reset command to change the password.`);
    throw err;
  }
}

async function resetPassword(pool, username, password) {
  if (!username || !password) throw new Error('username and new password are required.');
  if (password.length < 8) throw new Error('password must be at least 8 characters.');
  const hash = await bcrypt.hash(password, 8);
  const res = await pool.query('UPDATE users SET password_hash = $1 WHERE lower(username) = lower($2)', [hash, username]);
  if (res.rowCount === 0) throw new Error(`No user found with username "${username}".`);
}

async function main() {
  // Parse the command line before opening the database connection.
  const [command, ...args] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is empty in .env. This script only works with the live database.');
    process.exit(1);
  }
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
  try {
    if (command === 'add') {
      const [username, name, role, password, program, graduationYear] = args;
      await addUser(pool, { username, name, role, password, program, graduationYear });
      console.log(`Added ${role} "${username}". They can log in now.`);
    } else if (command === 'reset') {
      await resetPassword(pool, args[0], args[1]);
      console.log(`Password updated for "${args[0]}".`);
    } else {
      console.log('Usage:\n  node scripts/add-user.js add <username> <name> <role> <password> [program] [graduationYear]\n  node scripts/add-user.js reset <username> <newPassword>');
    }
  } catch (err) {
    const message = [err?.message, err?.cause?.message, err?.code]
      .find((value) => typeof value === 'string' && value.trim());
    console.error('Failed:', message || String(err) || 'Unknown error');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) main();
module.exports = { addUser, resetPassword };
