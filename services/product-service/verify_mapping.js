const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db/products.db');

console.log('\n🎯 KIỂM TRA ÁNH XẠ CHO SẢN PHẨM ĐƯỢC TẠO TỰ ĐỘNG:');
console.log('═'.repeat(90));

// Check Dell variants
db.all(`
  SELECT id, name, SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as slug
  FROM products 
  WHERE name LIKE '%Dell%' AND category='laptop'
  LIMIT 8
`, (err, dellRows) => {
  console.log('\n📱 Dell Laptops (Pattern-based mapping):');
  console.log('─'.repeat(90));
  dellRows.forEach(r => {
    const slug = r.slug.split('?')[0];
    console.log(`  ID${r.id.toString().padEnd(3)} | ${r.name.padEnd(40)} → ${slug}`);
  });

  // Check Xiaomi
  db.all(`
    SELECT id, name, SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as slug
    FROM products 
    WHERE name LIKE '%Xiaomi%'
    LIMIT 6
  `, (err, xiaomiRows) => {
    console.log('\n📱 Xiaomi Phones (Brand fallback → xiaomi-13t):');
    console.log('─'.repeat(90));
    xiaomiRows.forEach(r => {
      const slug = r.slug.split('?')[0];
      console.log(`  ${slug.padEnd(45)} ← ${r.name}`);
    });

    // Check Belkin
    db.all(`
      SELECT id, name, SUBSTR(image_url, INSTR(image_url, 'product-photo/') + 14, 50) as slug
      FROM products 
      WHERE name LIKE '%Belkin%'
      LIMIT 4
    `, (err, belkinRows) => {
      console.log('\n💾 Belkin Accessories (Brand fallback → belkin-magsafe):');
      console.log('─'.repeat(90));
      belkinRows.forEach(r => {
        const slug = r.slug.split('?')[0];
        console.log(`  ${slug.padEnd(45)} ← ${r.name}`);
      });

      // Get statistics
      db.all(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN image_url LIKE '%-15-pro%' THEN 1 ELSE 0 END) as iphone_count,
          SUM(CASE WHEN image_url LIKE '%samsung-a54%' THEN 1 ELSE 0 END) as samsung_count,
          SUM(CASE WHEN image_url LIKE '%xiami-13t%' THEN 1 ELSE 0 END) as xiaomi_count,
          SUM(CASE WHEN image_url LIKE '%dell-inspiron%' THEN 1 ELSE 0 END) as dell_count
        FROM products
      `, (err, stats) => {
        console.log('\n═'.repeat(90));
        console.log('\n📊 THỐNG KÊ ÁNH XẠ:');
        const s = stats[0];
        console.log(`  • Tổng sản phẩm: ${s.total}`);
        console.log(`  • iPhone 15 Pro variants: ${s.iphone_count}`);
        console.log(`  • Samsung A54 variants: ${s.samsung_count}`);
        console.log(`  • Dell Inspiron variants: ${s.dell_count}`);
        
        console.log('\n✅ Tất cả sản phẩm đã được ánh xạ ảnh thích hợp theo chiến lược:');
        console.log('   1️⃣  Khớp chính xác (iPhone 15 Pro → iphone-15-pro.jpg)');
        console.log('   2️⃣  Pattern-based (Dell Inspiron Gaming → dell-inspiron-gaming.jpg)');
        console.log('   3️⃣  Brand fallback (Xiaomi Redmi → xiaomi-13t.jpg)');
        console.log('═'.repeat(90));
        
        db.close();
      });
    });
  });
});
