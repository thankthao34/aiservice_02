const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/products.db');

const images = {
  phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  accessory: 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop'
};

console.log('Updating database directly...');

db.serialize(() => {
  db.run("UPDATE products SET image_url = ? WHERE category = 'phone'", [images.phone]);
  db.run("UPDATE products SET image_url = ? WHERE category = 'laptop'", [images.laptop]);
  db.run("UPDATE products SET image_url = ? WHERE category = 'accessory'", [images.accessory]);
  
  db.all('SELECT COUNT(*) as cnt FROM products', (err, rows) => {
    console.log('✅ Updated ' + rows[0].cnt + ' products');
    db.close();
  });
});
