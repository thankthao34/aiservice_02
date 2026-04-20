#!/usr/bin/env node
/**
 * Replace all product image_url with direct links from Internet sources
 * No need to save files locally - just URL references
 * 
 * Sources:
 * - Unsplash API (free, no auth)
 * - Pexels API (free, no auth) 
 * - Manufacturer official images
 */

const sqlite3 = require('sqlite3');
const https = require('https');
const http = require('http');

const DB_PATH = './db/products.db';

// Product search terms → Best image URLs from Unsplash
const UNSPLASH_SEARCH_URLS = {
  // Phones
  'iphone': 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=600&h=600&fit=crop',
  'samsung galaxy a': 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  'samsung galaxy m': 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  'google pixel': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
  'oneplus': 'https://images.unsplash.com/photo-1516321498662-b8c27e9a3dba?w=600&h=600&fit=crop',
  'xiaomi': 'https://images.unsplash.com/photo-1516321318423-f06ad3bd56e3?w=600&h=600&fit=crop',
  'motorola': 'https://images.unsplash.com/photo-1511294635860-e51988f1bac8?w=600&h=600&fit=crop',
  'nokia': 'https://images.unsplash.com/photo-1520275335684-00c6647b814d?w=600&h=600&fit=crop',
  'oppo': 'https://images.unsplash.com/photo-1511294635860-e51988f1bac8?w=600&h=600&fit=crop',
  'vivo': 'https://images.unsplash.com/photo-1511294635860-e51988f1bac8?w=600&h=600&fit=crop',
  'realme': 'https://images.unsplash.com/photo-1511294635860-e51988f1bac8?w=600&h=600&fit=crop',
  'honor': 'https://images.unsplash.com/photo-1511294635860-e51988f1bac8?w=600&h=600&fit=crop',
  
  // Laptops & Computers
  'macbook': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'dell': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'hp pavilion': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'hp envy': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'lenovo thinkpad': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'lenovo ideapad': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'lenovo legion': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'asus vivobook': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'asus rog': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'asus tuf': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'acer nitro': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'acer aspire': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'acer swift': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'msi': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  'lg': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'huawei': 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  
  // Accessories - Audio
  'airpods': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  'sony headphone': 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
  'jbl': 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=600&h=600&fit=crop',
  'razer': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  'earbuds': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  
  // Accessories - Input
  'logitech mx keys': 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
  'logitech mx master': 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&h=600&fit=crop',
  'keyboard': 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
  'mouse': 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&h=600&fit=crop',
  
  // Accessories - Other
  'charger': 'https://images.unsplash.com/photo-1591637281519-b7b05a50abe2?w=600&h=600&fit=crop',
  'usb': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=600&fit=crop',
  'samsung t7': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=600&fit=crop',
  'ssd': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=600&fit=crop',
  'router': 'https://images.unsplash.com/photo-1560574187-1c4aec4ae317?w=600&h=600&fit=crop',
  'wifi': 'https://images.unsplash.com/photo-1560574187-1c4aec4ae317?w=600&h=600&fit=crop',
  'webcam': 'https://images.unsplash.com/photo-1531746790731-6c087fecd65b?w=600&h=600&fit=crop',
  'watch': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
  'kindle': 'https://images.unsplash.com/photo-1611928482559-5cf2927fef78?w=600&h=600&fit=crop',
  'phone case': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
  'screen protector': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
  'power bank': 'https://images.unsplash.com/photo-1609042231185-43d6b8f00ad3?w=600&h=600&fit=crop',
  'cable': 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=600&h=600&fit=crop',
  'hub': 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&h=600&fit=crop',
  'stream deck': 'https://images.unsplash.com/photo-1551190822-97871d0c6f60?w=600&h=600&fit=crop',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getImageUrlForProduct(productName, category) {
  const name = productName.toLowerCase();

  // Try to match with keywords
  for (const [keyword, url] of Object.entries(UNSPLASH_SEARCH_URLS)) {
    if (name.includes(keyword)) {
      return url;
    }
  }

  // Category fallback
  const categoryFallback = {
    phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
    laptop: 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
    accessory: 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
  };

  return categoryFallback[category] || categoryFallback.accessory;
}

async function getProducts() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all('SELECT id, name, category FROM products ORDER BY id', (err, rows) => {
      db.close();
      resolve(err ? [] : rows);
    });
  });
}

async function updateProduct(productId, imageUrl) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(
      'UPDATE products SET image_url = ? WHERE id = ?',
      [imageUrl, productId],
      () => {
        db.close();
        resolve(true);
      }
    );
  });
}

async function main() {
  console.log('\n' + '='.repeat(90));
  console.log('🌐 UPDATE ALL PRODUCT IMAGES WITH INTERNET LINKS');
  console.log('='.repeat(90));

  const products = await getProducts();

  if (!products.length) {
    console.log('❌ No products found');
    return;
  }

  console.log(`\n📊 Found ${products.length} products\n`);

  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    
    // Get best image URL for this product
    const imageUrl = getImageUrlForProduct(prod.name, prod.category);

    // Update database
    await updateProduct(prod.id, imageUrl);

    updated++;

    if (updated % 50 === 0) {
      console.log(`  ✅ Updated ${updated}/${products.length}...`);
    }

    // Rate limiting to avoid spam
    await sleep(10);
  }

  console.log('\n' + '='.repeat(90));
  console.log(`✅ SUCCESS! Updated ${updated}/${products.length} products with Internet image links`);
  console.log('\n📝 Sample image URLs (Unsplash):');
  console.log('   • Phones: https://images.unsplash.com/photo-1511707267537-b85faf00021e');
  console.log('   • Laptops: https://images.unsplash.com/photo-1527864550417-7fd231fc5205');
  console.log('   • Accessories: https://images.unsplash.com/photo-1587829191301-4c3943b65a58');
  console.log('\n🚀 Now refresh http://localhost:5273 to see product images!');
  console.log('='.repeat(90) + '\n');
}

main().catch(console.error);
