#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3')).verbose();

const ordersDbPath = path.join(__dirname, '..', '..', 'data', 'orders.db');
const productsDbPath = path.join(__dirname, '..', '..', 'data', 'products.db');

if (!fs.existsSync(ordersDbPath)) {
  console.error('Orders DB not found:', ordersDbPath);
  process.exit(1);
}
if (!fs.existsSync(productsDbPath)) {
  console.error('Products DB not found:', productsDbPath);
  process.exit(1);
}

const backupPath = `${productsDbPath}.backup.${Date.now()}`;
fs.copyFileSync(productsDbPath, backupPath);
console.log('Products DB backup created at', backupPath);

const ordersDb = new sqlite3.Database(ordersDbPath);
const productsDb = new sqlite3.Database(productsDbPath);

productsDb.serialize(() => {
  ordersDb.all('SELECT order_id, product_id FROM order_items', [], (orderErr, orderItems) => {
    if (orderErr) {
      console.error('Read order_items failed:', orderErr.message);
      process.exit(2);
    }

    productsDb.all('SELECT id AS review_id, order_id, product_id AS review_product_id FROM reviews WHERE order_id IS NOT NULL', [], (err, reviews) => {
      if (err) {
        console.error('Read reviews failed:', err.message);
        process.exit(2);
      }

      const orderItemMap = new Map();
      for (const item of orderItems) {
        if (!orderItemMap.has(Number(item.order_id))) {
          orderItemMap.set(Number(item.order_id), []);
        }
        orderItemMap.get(Number(item.order_id)).push(Number(item.product_id));
      }

      const rows = reviews
        .map((review) => {
          const productIds = orderItemMap.get(Number(review.order_id)) || [];
          const uniqueProductIds = Array.from(new Set(productIds));
          const targetId = uniqueProductIds.length === 1 ? uniqueProductIds[0] : null;
          return {
            review_id: review.review_id,
            order_id: review.order_id,
            review_product_id: review.review_product_id,
            item_product_id: targetId
          };
        })
        .filter((row) => row.item_product_id && Number(row.review_product_id) !== Number(row.item_product_id));

      let updated = 0;
      let skipped = 0;

      (function next(i) {
        if (i >= rows.length) {
          console.log('Review product_id fix complete. Updated=', updated, 'Skipped=', skipped);
          ordersDb.close();
          productsDb.close();
          return;
        }

        const row = rows[i];
        productsDb.run(
          'UPDATE reviews SET product_id = ? WHERE id = ?',
          [row.item_product_id, row.review_id],
          function updateErr(err2) {
            if (err2) {
              console.error('Update failed for review', row.review_id, err2.message);
              skipped += 1;
            } else {
              updated += 1;
            }
            next(i + 1);
          }
        );
      })(0);
    });
  });
});
