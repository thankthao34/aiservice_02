#!/usr/bin/env node
/**
 * Fix Product Images - Update database với mapped images chính xác
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, './public/images/products');

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getAvailableImages() {
  const files = fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('.jpg'));
  return files.map(f => f.replace('.jpg', ''));
}

// Mapping chi tiết: product name => correct image slug
function getCorrectImageSlug(productName, availableImages) {
  const name = productName.toLowerCase();
  
  // Exact matches
  const exactMap = {
    'iphone 15 pro': 'iphone-15-pro',
    'samsung s24 ultra': 'samsung-s24-ultra',
    'google pixel 8 pro': 'google-pixel-8-pro',
    'samsung a54': 'samsung-a54', 
    'xiaomi 13t': 'xiaomi-13t',
    'realme 11 pro': 'realme-11-pro',
    'nothing phone 2a': 'nothing-phone-2a',
    'oneplus 12': 'oneplus-12',
    'macbook pro m3': 'macbook-pro-m3',
    'dell xps 15': 'dell-xps-15',
    'lenovo thinkpad x1 carbon': 'lenovo-thinkpad-x1-carbon',
    'asus vivobook': 'asus-vivobook',
    'lenovo ideapad': 'lenovo-ideapad',
    'hp pavilion': 'hp-pavilion',
    'acer swift go 14': 'acer-swift-go-14',
    'msi katana 15': 'msi-katana-15',
    'airpods pro': 'airpods-pro',
    'sony wh-1000xm5': 'sony-wh-1000xm5',
    'logitech mx keys': 'logitech-mx-keys',
    'logitech mx master 3s': 'logitech-mx-master-3s',
    'samsung t7 ssd 1tb': 'samsung-t7-ssd-1tb',
    'anker 65w gan charger': 'anker-65w-gan-charger',
    'razer blackshark v2 x': 'razer-blackshark-v2-x',
    'jbl tune 510bt': 'jbl-tune-510bt',
    'amazon kindle paperwhite': 'amazon-kindle-paperwhite',
    'apple watch se': 'apple-watch-se',
    'samsung galaxy watch 6': 'samsung-galaxy-watch-6'
  };
  
  if (exactMap[name] && availableImages.includes(exactMap[name])) {
    return exactMap[name];
  }
  
  // Pattern matching
  if (name.includes('dell') && name.includes('inspiron')) {
    if (name.includes('gaming') && availableImages.includes('dell-inspiron-gaming')) return 'dell-inspiron-gaming';
    if (name.includes('creator') && availableImages.includes('dell-inspiron-creator')) return 'dell-inspiron-creator';
    if (availableImages.includes('dell-inspiron-15')) return 'dell-inspiron-15';
  }
  
  if (name.includes('dell') && name.includes('latitude')) {
    if (name.includes('gaming') && availableImages.includes('dell-latitude-gaming')) return 'dell-latitude-gaming';
    if (name.includes('creator') && availableImages.includes('dell-latitude-creator')) return 'dell-latitude-creator';
    if (availableImages.includes('dell-latitude-15')) return 'dell-latitude-15';
  }
  
  if (name.includes('acer') && name.includes('nitro')) {
    if (name.includes('gaming') && availableImages.includes('acer-nitro-gaming')) return 'acer-nitro-gaming';
    if (name.includes('creator') && availableImages.includes('acer-nitro-creator')) return 'acer-nitro-creator';
    if (availableImages.includes('acer-nitro-15')) return 'acer-nitro-15';
  }
  
  // Brand-based fallback
  const brandMaps = [
    { pattern: /samsung.*galaxy a/i, slug: 'samsung-a54' },
    { pattern: /samsung.*galaxy m/i, slug: 'samsung-a54' },
    { pattern: /xiaomi.*redmi/i, slug: 'xiaomi-13t' },
    { pattern: /xiaomi.*poco/i, slug: 'xiaomi-13t' },
    { pattern: /realme/i, slug: 'realme-11-pro' },
    { pattern: /google.*pixel/i, slug: 'google-pixel-8-pro' },
    { pattern: /oneplus/i, slug: 'oneplus-12' },
    { pattern: /hp.*pavilion|hp.*envy/i, slug: 'hp-pavilion' },
    { pattern: /lenovo.*ideapad|lenovo.*legion/i, slug: 'lenovo-ideapad' },
    { pattern: /lenovo.*thinkpad/i, slug: 'lenovo-thinkpad-x1-carbon' },
    { pattern: /asus.*vivobook|asus.*zenfone/i, slug: 'asus-vivobook' },
    { pattern: /sony.*headphone|sony.*wh/i, slug: 'sony-wh-1000xm5' },
    { pattern: /anker.*charger|anker.*charging/i, slug: 'anker-65w-gan-charger' },
    { pattern: /samsung.*watch/i, slug: 'samsung-galaxy-watch-6' },
    { pattern: /apple.*watch/i, slug: 'apple-watch-se' },
    { pattern: /belkin/i, slug: 'belkin-magsafe-charger' }
  ];
  
  for (const { pattern, slug } of brandMaps) {
    if (pattern.test(productName) && availableImages.includes(slug)) {
      return slug;
    }
  }
  
  return null;
}

function buildImageUrl(slug, category) {
  if (!slug) return null;
  return `http://localhost:3002/images/product-photo/${slug}.jpg?category=${category}&v=20260405c`;
}

async function getProducts() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/',
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : (parsed.products || []));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function updateProduct(productId, newImageUrl) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ image_url: newImageUrl });
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: `/update-image/${productId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔧 Fix Product Images\n');

  const availableImages = getAvailableImages();
  console.log(`📊 Ảnh có sẵn: ${availableImages.length}\n`);

  const products = await getProducts();
  console.log(`📦 Sản phẩm: ${products.length}\n`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const { id, name, category } = product;
    
    const correctSlug = getCorrectImageSlug(name, availableImages);
    if (!correctSlug) {
      skippedCount++;
      continue;
    }

    const newImageUrl = buildImageUrl(correctSlug, category);
    
    try {
      await updateProduct(id, newImageUrl);
      fixedCount++;
      console.log(`[${i+1}/${products.length}] ✅ ${name}`);
    } catch (error) {
      console.log(`[${i+1}/${products.length}] ⚠️  ${name} - lỗi update`);
    }

    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 KẾT QUẢ:');
  console.log(`   ✅ Đã cập nhật: ${fixedCount}`);
  console.log(`   ⏭️  Bỏ qua (không map được): ${skippedCount}`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
