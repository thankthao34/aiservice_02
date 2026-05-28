// Quick update: Set all product image_urls to direct Unsplash links
// Run once and check results

const sqlite3 = require('sqlite3');

const DB_PATH = './db/products.db';

const imageMap = {
  phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  accessory: 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
};

const db = new sqlite3.Database(DB_PATH);

// Update: each category gets its category image
db.all('SELECT id, category FROM products', (err, products) => {
  if (err) {
    console.log('Error:', err);
    db.close();
    return;
  }

  let count = 0;
  products.forEach(p => {
    const url = imageMap[p.category] || imageMap.accessory;
    db.run('UPDATE products SET image_url = ? WHERE id = ?', [url, p.id], () => {
      count++;
      if (count % 50 === 0) {
        console.log(`✅ Updated ${count}/${products.length}`);
      }
    });
  });

  setTimeout(() => {
    console.log(`\n✅ All ${products.length} products updated!`);
    
    // Show sample
    db.all('SELECT id, name, image_url FROM products LIMIT 3', (err2, sample) => {
      console.log('\nSample:');
      sample.forEach(p => {
        const img = p.image_url.substring(p.image_url.length - 40);
        console.log(`  ${p.name.padEnd(30)} → ${img}`);
      });
      db.close();
    });
  }, 2000);
});
