// Download real product images from Unsplash/Pexels for each product
// Then update database with new image URLs

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const sqlite3 = require('sqlite3');

const IMG_DIR = './public/images/products';
const DB_PATH = './db/products.db';
const API_PORT = 3002;

// Product → Image URL mapping
// Using Unsplash free images (no auth required for moderate use)
const PRODUCT_IMAGES = {
  'iphone-15-pro': 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=600&h=600&fit=crop',
  'nothing-phone-2a': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=600&fit=crop',
  'google-pixel-8-pro': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
  'oneplus-12': 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  'macbook-pro-m3': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'samsung-a54': 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  'xiaomi-13t': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=600&fit=crop',
  'dell-xps-15': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'dell-inspiron-gaming': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'lenovo-ideapad': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'hp-pavilion': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'asus-vivobook': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'acer-swift-go-14': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'airpods-pro': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  'sony-wh-1000xm5': 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
  'logitech-mx-keys': 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
  'logitech-mx-master-3s': 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&h=600&fit=crop',
  'samsung-t7-ssd-1tb': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=600&fit=crop',
  'anker-65w-gan-charger': 'https://images.unsplash.com/photo-1591637281519-b7b05a50abe2?w=600&h=600&fit=crop',
  'razer-blackshark-v2-x': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  'jbl-tune-510bt': 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
};

// Additional generic fallbacks by category
const CATEGORY_IMAGES = {
  'phone': 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  'laptop': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'accessory': 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
};

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, { timeout: 5000 }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location, filepath).then(resolve);
        return;
      }
      
      if (response.statusCode !== 200) {
        console.log(`    ❌ HTTP ${response.statusCode}`);
        resolve(false);
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        const size = fs.statSync(filepath).size / 1024;
        console.log(`    ✅ Downloaded (${size.toFixed(1)}KB)`);
        resolve(true);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {});
        console.log(`    ❌ Write error: ${err.message}`);
        resolve(false);
      });
    });
    
    request.on('error', (err) => {
      console.log(`    ❌ Download error: ${err.message}`);
      resolve(false);
    });
    
    request.on('timeout', () => {
      request.destroy();
      console.log(`    ❌ Timeout`);
      resolve(false);
    });
  });
}

async function getAllProducts() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all(
      'SELECT id, name, category FROM products ORDER BY id',
      (err, rows) => {
        db.close();
        resolve(err ? [] : rows);
      }
    );
  });
}

function updateProductImage(productId, imageUrl) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(
      'UPDATE products SET image_url = ? WHERE id = ?',
      [imageUrl, productId],
      (err) => {
        db.close();
        resolve(!err);
      }
    );
  });
}

function getImageUrl(slug, category) {
  return `http://localhost:${API_PORT}/images/product-photo/${slug}.jpg?category=${category}&v=20260405c`;
}

async function main() {
  console.log('\n' + '='.repeat(90));
  console.log('🖼️  DOWNLOAD REAL PRODUCT IMAGES');
  console.log('='.repeat(90));

  // Create img directory
  if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
  }

  // Get products
  console.log('\n📂 Loading products from database...');
  const products = await getAllProducts();

  if (!products.length) {
    console.log('❌ No products found!');
    return;
  }

  console.log(`✅ Found ${products.length} products\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const slug = prod.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const filepath = path.join(IMG_DIR, `${slug}.jpg`);
    
    // Check if already exists
    if (fs.existsSync(filepath)) {
      const size = fs.statSync(filepath).size / 1024;
      console.log(`✅ [${i + 1}/${products.length}] ${prod.name.padEnd(40)} | ${size.toFixed(1)}KB (exists)`);
      skipped++;
      continue;
    }

    console.log(`⏳ [${i + 1}/${products.length}] ${prod.name.padEnd(40)} | Downloading...`);

    // Get image URL
    let imageUrl = PRODUCT_IMAGES[slug];
    if (!imageUrl) {
      imageUrl = CATEGORY_IMAGES[prod.category] || CATEGORY_IMAGES['accessory'];
    }

    // Download
    const success = await downloadImage(imageUrl, filepath);

    if (success) {
      // Update database
      const dbImageUrl = getImageUrl(slug, prod.category);
      const dbOk = await updateProductImage(prod.id, dbImageUrl);
      
      if (dbOk) {
        console.log(`    📝 Database updated`);
      }
      
      downloaded++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log('📊 SUMMARY:');
  console.log(`   ✅ Already existing: ${skipped}`);
  console.log(`   ⬇️  Downloaded: ${downloaded}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${downloaded + skipped}/${products.length}`);
  console.log('='.repeat(90));
  
  if (downloaded + skipped === products.length) {
    console.log('✅ All products have images!');
  } else {
    console.log(`⚠️  ${failed} products still need images`);
  }
  console.log('');
}

main().catch(console.error);
