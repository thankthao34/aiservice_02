const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'data', 'products.db');
const db = new sqlite3.Database(dbPath);

const sql = `SELECT id, name FROM products WHERE id = 25 OR name LIKE '%Logitech MX Keys%';`;
db.all(sql, [], (err, rows) => {
  if (err) { console.error('ERR', err); process.exit(2); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
