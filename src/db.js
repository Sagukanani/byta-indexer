const Database = require("better-sqlite3");

const db = new Database("byta.db");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  referrer TEXT,
  side TEXT,
  level INTEGER
);
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_referrer
ON users(referrer);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;
