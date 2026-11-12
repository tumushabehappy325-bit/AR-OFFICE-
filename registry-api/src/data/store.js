/**
 * DATA LAYER SELECTOR
 * -------------------
 * The routes always import this file. It decides where the data lives:
 *   - DATABASE_URL set in .env  -> PostgreSQL (live database)
 *   - nothing set               -> in-memory arrays (zero setup, resets on restart)
 */
const config = require('../config');
const createPgStore = require('./pgStore');

let store;
// Use Neon/PostgreSQL when configured; otherwise select the local or test store.
if (config.databaseUrl) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  store = createPgStore(new Pool({
    connectionString: config.databaseUrl,
    ssl: local ? false : { rejectUnauthorized: false },
  }));
} else if (process.env.USE_PGMEM === 'true') {
  // Test only: a pure JavaScript PostgreSQL, used to check the SQL without a real server
  const { newDb } = require('pg-mem');
  const { Pool } = newDb().adapters.createPg();
  store = createPgStore(new Pool());
} else {
  store = require('./memoryStore');
}

module.exports = store;
