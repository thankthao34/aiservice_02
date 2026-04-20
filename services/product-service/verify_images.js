const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db/products.db');

db.all(`
  SELECT 
    id, 
    name,
    SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as slug,
    category
  FROM products 
  ORDER BY id
  LIMIT 20
`, (err, rows) => {
  if (err) { 
    console.error('❌ Error:', err.message); 
    process.exit(1); 
  }
  
  console.log('\n📊 KIỂM TRA CÁC ẢNH SẢN PHẨM:');
  console.log('═'.repeat(80));
  console.log('ID | Tên Sản Phẩm'.padEnd(40) + ' | Slug Ảnh');
  console.log('─'.repeat(80));
  
  rows.forEach(r => {
    const slug = r.slug.split('?')[0];
    const status = slug && slug.includes('.jpg') ? '✅' : '❌';
    console.log(`${status} ${String(r.id).padEnd(3)} | ${r.name.substring(0, 35).padEnd(38)} | ${slug.substring(0, 30)}`);
  });
  
  console.log('═'.repeat(80));
  
  // Count stats
  db.get('SELECT COUNT(*) as total FROM products', (e, total) => {
    db.get('SELECT COUNT(*) as fixed FROM products WHERE image_url LIKE "%.jpg%"', (e2, fixed) => {
      console.log(`\n📈 Thống kê: ${fixed.fixed}/${total.total} sản phẩm đã có ảnh`);
      db.close();
    });
  });
});
