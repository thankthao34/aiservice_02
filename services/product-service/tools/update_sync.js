// Synchronous update - no async/await, just direct SQLite writes
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './db/products.db';
const db = new sqlite3.Database(DB_PATH);

const imageByCategory = {
  phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  accessory: 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
};

console.log('\n✅ Updating all product images...\n');

// Get all products
db.all(`SELECT id, name, category FROM products`, (err, products) => {
  if (err || !products) {
    console.error('❌ Error:', err);
    process.exit(1);
  }

  console.log(`📊 Found ${products.length} products\n`);

  let updated = 0;

  // Update each product
  products.forEach((prod, idx) => {
    const imageUrl = imageByCategory[prod.category] || imageByCategory.accessory;
    
    db.run(
      `UPDATE products SET image_url = ? WHERE id = ?`,
      [imageUrl, prod.id],
      (err) => {
        if (!err) updated++;
        
        // Show progress every 50
        if ((idx + 1) % 50 === 0 || idx + 1 === products.length) {
          console.log(`  Updated ${idx + 1}/${products.length}`);
        }
      }
    );
  });

  // Close after a bit of time
  setTimeout(() => {
    console.log(`\n✅ Success! Updated ${updated}/${products.length} products`);
    
    // Verify
    db.all(`SELECT DISTINCT image_url FROM products LIMIT 5`, (err, urls) => {
      console.log('\n📝 Sample image URLs in database:');
      urls.forEach((row, i) => {
        const url = row.image_url.substring(0, 60) + '...';
        console.log(`   ${i + 1}. ${url}`);
      });
      
      console.log('\n🚀 Restart server and refresh browser to see images!');
      db.close();
      process.exit(0);
    });
  }, 1000);
});
