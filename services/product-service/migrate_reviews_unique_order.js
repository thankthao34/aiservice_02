#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.argv[2] || path.join(__dirname, 'db', 'products.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

const backupPath = `${dbPath}.backup.${Date.now()}`;
fs.copyFileSync(dbPath, backupPath);
console.log('Backup created at', backupPath);

const db = new sqlite3.Database(dbPath);

const sql = `PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS reviews_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  order_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(order_id)
);

-- keep rows without order_id as-is
INSERT INTO reviews_new (product_id, user_id, user_name, rating, comment, order_id, created_at)
SELECT product_id, user_id, user_name, rating, comment, order_id, created_at FROM reviews WHERE order_id IS NULL;

-- for rows with order_id, keep the latest row per order_id (max id)
INSERT INTO reviews_new (product_id, user_id, user_name, rating, comment, order_id, created_at)
SELECT r.product_id, r.user_id, r.user_name, r.rating, r.comment, r.order_id, r.created_at
FROM reviews r
JOIN (
  SELECT order_id, MAX(id) AS maxid FROM reviews WHERE order_id IS NOT NULL GROUP BY order_id
) m ON r.order_id = m.order_id AND r.id = m.maxid;

DROP TABLE reviews;
ALTER TABLE reviews_new RENAME TO reviews;

COMMIT;
PRAGMA foreign_keys=ON;`;

db.exec(sql, (err) => {
  if (err) {
    console.error('Migration failed:', err.message || err);
    console.error('Database backup preserved at', backupPath);
    process.exit(2);
  }
  console.log('Migration completed successfully. Backup at', backupPath);
  process.exit(0);
});
