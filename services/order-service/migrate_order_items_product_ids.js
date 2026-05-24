#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require(path.join(__dirname, '..', 'product-service', 'node_modules', 'sqlite3')).verbose();

const ordersDbPath = process.argv[2] || path.join(__dirname, '..', '..', 'data', 'orders.db');
const productsDbPath = process.argv[3] || path.join(__dirname, '..', '..', 'data', 'products.db');

if (!fs.existsSync(ordersDbPath)) {
  console.error('Orders DB not found:', ordersDbPath);
  process.exit(1);
}
if (!fs.existsSync(productsDbPath)) {
  console.error('Products DB not found:', productsDbPath);
  process.exit(1);
}

const backupPath = `${ordersDbPath}.backup.${Date.now()}`;
fs.copyFileSync(ordersDbPath, backupPath);
console.log('Orders DB backup created at', backupPath);

const ordersDb = new sqlite3.Database(ordersDbPath);
const productsDb = new sqlite3.Database(productsDbPath);

function normalize(s){ return String(s || '').trim().toLowerCase(); }

ordersDb.serialize(() => {
  ordersDb.all('SELECT id, order_id, product_id, product_name FROM order_items', [], (err, rows) => {
    if (err) { console.error('Read order_items failed', err.message); process.exit(2); }
    let updated = 0;
    let skipped = 0;
    (function next(i){
      if (i >= rows.length) {
        console.log('Migration finished. Updated=', updated, 'Skipped=', skipped);
        productsDb.close(); ordersDb.close();
        return;
      }
      const r = rows[i];
      const nm = normalize(r.product_name || '');
      if (!nm) { skipped++; return next(i+1); }

      productsDb.all('SELECT id, name FROM products', [], (pe, plist) => {
        if (pe) { console.error('Read products failed', pe.message); skipped++; return next(i+1); }
        const matches = plist.filter(p => normalize(p.name) === nm);
        if (matches.length === 1) {
          const newId = matches[0].id;
          if (Number(r.product_id) !== Number(newId)) {
            ordersDb.run('UPDATE order_items SET product_id = ? WHERE id = ?', [newId, r.id], function(upErr){
              if (upErr) { console.error('Update failed for order_item', r.id, upErr.message); skipped++; }
              else { updated++; }
              return next(i+1);
            });
          } else {
            // already correct
            return next(i+1);
          }
        } else {
          // No exact single match; try fuzzy contains match
          const fuzzy = plist.filter(p => normalize(p.name).includes(nm) || nm.includes(normalize(p.name)));
          if (fuzzy.length === 1) {
            const newId = fuzzy[0].id;
            if (Number(r.product_id) !== Number(newId)) {
              ordersDb.run('UPDATE order_items SET product_id = ? WHERE id = ?', [newId, r.id], function(upErr){
                if (upErr) { console.error('Update failed for order_item', r.id, upErr.message); skipped++; }
                else { updated++; }
                return next(i+1);
              });
            } else return next(i+1);
          } else {
            console.warn('Skipping order_item id', r.id, 'product_name', r.product_name, 'matches', matches.length, 'fuzzy', fuzzy.length);
            skipped++;
            return next(i+1);
          }
        }
      });
    })(0);
  });
});
