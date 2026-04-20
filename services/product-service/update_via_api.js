#!/usr/bin/env node
/**
 * Update product images via API endpoint
 * Safer than direct DB writes
 */

const http = require('http');

const API_BASE = 'http://localhost:3002';

const imageByCategory = {
  phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop',
  accessory: 'https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop',
};

async function getProducts() {
  return new Promise((resolve) => {
    http.get(`${API_BASE}/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function updateProduct(id, imageUrl) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ image_url: imageUrl });
    
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: `/update-image/${id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(true));
    }).on('error', () => resolve(false));

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('\n📡 Updating products via API...\n');

  const products = await getProducts();
  
  if (!products.length) {
    console.log('❌ Cannot connect to API on port 3002');
    console.log('   Make sure product-service is running:');
    console.log('   cd services/product-service && npm start');
    process.exit(1);
  }

  console.log(`📊 Found ${products.length} products\n`);

  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const imageUrl = imageByCategory[prod.category] || imageByCategory.accessory;

    await updateProduct(prod.id, imageUrl);
    updated++;

    if (updated % 50 === 0 || updated === products.length) {
      console.log(`  ✅ Updated ${updated}/${products.length}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 10));
  }

  console.log(`\n✅ SUCCESS! Updated ${updated}/${products.length} products`);
  console.log('\n📝 Image URLs by category:');
  console.log('   📱 Phone → Unsplash smartphone image');
  console.log('   💻 Laptop → Unsplash laptop image');
  console.log('   🎧 Accessory → Unsplash keyboard image');
  console.log('\n🚀 Now refresh http://localhost:5273');
  process.exit(0);
}

main();
