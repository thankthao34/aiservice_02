#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const src = path.join(__dirname, 'db', 'products.db');
const dst = path.join(__dirname, '..', '..', 'data', 'products.db');

if (!fs.existsSync(src)) {
  console.error('Source DB not found:', src);
  process.exit(1);
}
if (!fs.existsSync(dst)) {
  console.error('Target DB not found:', dst);
  process.exit(1);
}

const srcDb = new sqlite3.Database(src);
const dstDb = new sqlite3.Database(dst);

dstDb.serialize(() => {
  dstDb.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    order_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  srcDb.all('SELECT id, product_id, user_id, user_name, rating, comment, order_id, created_at FROM reviews', (err, rows) => {
    if (err) {
      console.error('Read source reviews failed', err.message);
      process.exit(2);
    }

    const insert = dstDb.prepare('INSERT INTO reviews (product_id, user_id, user_name, rating, comment, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    let copied = 0;
    (function next(i){
      if (i >= rows.length) {
        insert.finalize(() => {
          console.log('Sync complete. Copied', copied, 'rows.');
          srcDb.close(); dstDb.close();
        });
        return;
      }
      const r = rows[i];
      if (!r.order_id) {
        // Skip or insert if not exist by exact match
        dstDb.get('SELECT id FROM reviews WHERE product_id = ? AND user_id = ? AND comment = ? LIMIT 1', [r.product_id, r.user_id, r.comment], (e, existing) => {
          if (e) return next(i+1);
          if (!existing) {
            insert.run([r.product_id, r.user_id, r.user_name, r.rating, r.comment, r.order_id, r.created_at], () => { copied++; next(i+1); });
          } else next(i+1);
        });
      } else {
        dstDb.get('SELECT id FROM reviews WHERE order_id = ? LIMIT 1', [r.order_id], (e, existing) => {
          if (e) return next(i+1);
          if (!existing) {
            insert.run([r.product_id, r.user_id, r.user_name, r.rating, r.comment, r.order_id, r.created_at], () => { copied++; next(i+1); });
          } else next(i+1);
        });
      }
    })(0);
  });
});
