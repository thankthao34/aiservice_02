// Check current image-product mapping
// Show: Product name → Current image → Is it accurate?

const sqlite3 = require('sqlite3');

const DB_PATH = './db/products.db';

const db = new sqlite3.Database(DB_PATH);

console.log('\n' + '='.repeat(100));
console.log('🔍 CHECK CURRENT IMAGE MAPPING');
console.log('='.repeat(100));

db.all(`
  SELECT 
    id,
    name,
    category,
    SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as current_image_slug
  FROM products
  ORDER BY id
  LIMIT 30
`, (err, rows) => {
  if (err) {
    console.log('❌ Error:', err.message);
    db.close();
    return;
  }

  console.log('\n📋 PRODUCT → CURRENT IMAGE MAPPING (First 30):');
  console.log('─'.repeat(100));
  console.log('ID  | Product Name'.padEnd(40) + ' | Image Being Used'.padEnd(35) + ' | Match?');
  console.log('─'.repeat(100));

  rows.forEach(r => {
    const img = r.current_image_slug.split('?')[0];
    const matches = img.includes(r.name.toLowerCase().split(' ')[0]);
    const mark = matches ? '✅' : '❌';
    
    console.log(`${r.id.toString().padEnd(4)}| ${r.name.substring(0, 37).padEnd(40)} | ${img.substring(0, 32).padEnd(35)} | ${mark}`);
  });

  console.log('─'.repeat(100));

  // Get all unique images being used
  db.all(`
    SELECT DISTINCT SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as image_slug
    FROM products
    ORDER BY image_slug
  `, (err2, images) => {
    console.log('\n📊 CURRENTLY USED IMAGES:');
    const uniqueImages = [...new Set(images.map(i => i.image_slug.split('?')[0]))];
    
    uniqueImages.forEach((img, idx) => {
      // Count how many products use this image
      db.get(`
        SELECT COUNT(*) as cnt 
        FROM products 
        WHERE image_url LIKE ?
      `, ['%' + img + '%'], (err3, result) => {
        console.log(`   ${String(idx + 1).padStart(2)}. ${img.padEnd(40)} ← ${result?.cnt || 0} products`);
        
        if (idx === uniqueImages.length - 1) {
          console.log('\n' + '='.repeat(100));
          console.log('💡 ANALYSIS:');
          console.log('   Problem: Multiple products share SAME image');
          console.log('   Example: Samsung Galaxy A Gen 1, Gen 2, Gen 3 all use samsung-a54.jpg');
          console.log('   Reality: They should each have DIFFERENT images if possible');
          console.log('\n⚠️  LIMITATION: Cannot auto-download unique images due to copyright/APIs');
          console.log('   Options:');
          console.log('   1. Manual upload unique images per product');
          console.log('   2. Generate styled placeholders (shows product name/price)');
          console.log('   3. Use brand-level images (current approach) ← Most practical');
          console.log('='.repeat(100) + '\n');
          
          db.close();
        }
      });
    });
  });
});
