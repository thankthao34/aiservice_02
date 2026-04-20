// Quick check: See what images exist and what's in database
const fs = require('fs');
const sqlite3 = require('sqlite3');
const path = require('path');

const IMG_DIR = './public/images/products';
const DB_PATH = './db/products.db';

console.log('\n' + '='.repeat(90));
console.log('📊 IMAGE & DATABASE CHECK');
console.log('='.repeat(90));

// Check files
const files = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg'));
console.log(`\n📁 Image files on disk: ${files.length}`);

const totalSize = files.reduce((sum, f) => {
  const filepath = path.join(IMG_DIR, f);
  return sum + fs.statSync(filepath).size;
}, 0);

console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`\n📋 Largest 15 image files:`);

files
  .map(f => ({ name: f, size: fs.statSync(path.join(IMG_DIR, f)).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 15)
  .forEach((f, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${f.name.padEnd(45)} ${(f.size / 1024).toFixed(1)} KB`);
  });

// Check database
console.log(`\n📚 Database check:`);
const db = new sqlite3.Database(DB_PATH);

db.all('SELECT id, name, category, image_url FROM products LIMIT 20', (err, rows) => {
  if (err) {
    console.log('❌ DB Error:', err.message);
    db.close();
    return;
  }

  console.log(`\n📝 First 10 products:`);
  rows.slice(0, 10).forEach((r, i) => {
    const img = r.image_url.split('product-photo/')[1]?.split('?')[0] || 'N/A';
    const exists = files.includes(img.replace('.jpg', '') + '.jpg');
    const mark = exists ? '✅' : '❌';
    console.log(`   ${mark} ID${r.id.toString().padEnd(3)} ${r.name.padEnd(30)} → ${img.substring(0, 35)}`);
  });

  // Stats
  db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN image_url LIKE '%product-photo/%' THEN 1 ELSE 0 END) as with_url
    FROM products
  `, (err, stats) => {
    if (!err && stats) {
      console.log(`\n📈 Database Statistics:`);
      console.log(`   Total products: ${stats.total}`);
      console.log(`   With image_url: ${stats.with_url}`);
    }
    db.close();
  });
});
