const Database = require("better-sqlite3");

// creates byta.db in project root
const db = new Database("byta.db");

// users table: referral tree
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  referrer TEXT,
  side TEXT,
  level INTEGER
);
`);

// index for fast lookups by referrer
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_referrer
ON users(referrer);
`);

module.exports = db;
