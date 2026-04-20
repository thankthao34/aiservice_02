#!/usr/bin/env node
/**
 * Audit + Fix Product Images
 * Duyệt từng sản phẩm, gán ảnh chính xác
 */

const https = require('https');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, './db/products.db');
const IMAGE_DIR = path.join(__dirname, './public/images/products');

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Lấy danh sách ảnh đã có
function getAvailableImages() {
  const files = fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('.jpg'));
  return files.map(f => f.replace('.jpg', ''));
}

/**
 * Mapping chi tiết: product name => image slug
 */
function getCorrectImageSlug(productName) {
  const name = productName.toLowerCase();
  
  // Direct mapping cho sản phẩm cơ bản
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
    'usb-c hub': 'usb-c-hub',
    'phone case': 'phone-case',
    'screen protector': 'screen-protector',
    'cable usb-c': 'cable-usb-c',
    'power bank 10000mah': 'power-bank-10000mah',
    'webcam 1080p': 'webcam-1080p',
    'mouse pad xl': 'mouse-pad-xl',
    'anker 65w gan charger': 'anker-65w-gan-charger',
    'samsung t7 ssd 1tb': 'samsung-t7-ssd-1tb',
    'razer blackshark v2 x': 'razer-blackshark-v2-x',
    'jbl tune 510bt': 'jbl-tune-510bt',
    'amazon kindle paperwhite': 'amazon-kindle-paperwhite',
    'apple watch se': 'apple-watch-se',
    'samsung galaxy watch 6': 'samsung-galaxy-watch-6',
    'tp-link archer ax55 router': 'tp-link-archer-ax55-router',
    'elgato stream deck mini': 'elgato-stream-deck-mini',
    'belkin magsafe charger': 'belkin-magsafe-charger'
  };
  
  // Try exact match
  if (exactMap[name]) {
    return exactMap[name];
  }
  
  // Pattern-based for generated variants
  if (name.includes('dell') && name.includes('inspiron')) {
    const match = name.match(/inspiron.*?(gaming|creator|13|14|15|16)/);
    if (match) {
      if (match[1] === 'gaming') return 'dell-inspiron-gaming';
      if (match[1] === 'creator') return 'dell-inspiron-creator';
      return `dell-inspiron-${match[1]}`;
    }
    return 'dell-inspiron-15';
  }
  
  if (name.includes('dell') && name.includes('latitude')) {
    const match = name.match(/latitude.*?(gaming|creator|13|14|15|16)/);
    if (match) {
      if (match[1] === 'gaming') return 'dell-latitude-gaming';
      if (match[1] === 'creator') return 'dell-latitude-creator';
      return `dell-latitude-${match[1]}`;
    }
    return 'dell-latitude-15';
  }
  
  if (name.includes('acer') && name.includes('nitro')) {
    const match = name.match(/nitro.*?(gaming|14|15|16)/);
    if (match) {
      if (match[1].includes('gaming')) return 'acer-nitro-gaming';
      return `acer-nitro-${match[1]}`;
    }
    return 'acer-nitro-15';
  }
  
  // Fallback: map by category/brand
  if (name.includes('samsung') && name.includes('galaxy a')) return 'samsung-a54';
  if (name.includes('samsung') && name.includes('galaxy m')) return 'samsung-a54';
  if (name.includes('xiaomi') && name.includes('redmi')) return 'xiaomi-13t';
  if (name.includes('xiaomi') && name.includes('poco')) return 'xiaomi-13t';
  if (name.includes('realme')) return 'realme-11-pro';
  if (name.includes('google') && name.includes('pixel')) return 'google-pixel-8-pro';
  if (name.includes('oneplus')) return 'oneplus-12';
  
  if (name.includes('hp') && name.includes('pavilion')) return 'hp-pavilion';
  if (name.includes('hp') && name.includes('envy')) return 'hp-pavilion';
  if (name.includes('lenovo') && name.includes('ideapad')) return 'lenovo-ideapad';
  if (name.includes('lenovo') && name.includes('legion')) return 'lenovo-ideapad';
  if (name.includes('lenovo') && name.includes('thinkpad')) return 'lenovo-thinkpad-x1-carbon';
  if (name.includes('asus') && name.includes('vivobook')) return 'asus-vivobook';
  if (name.includes('asus') && name.includes('zenfone')) return 'asus-vivobook';
  
  if (name.includes('anker')) return 'anker-65w-gan-charger';
  if (name.includes('samsung') && name.includes('watch')) return 'samsung-galaxy-watch-6';
  if (name.includes('apple') && name.includes('watch')) return 'apple-watch-se';
  if (name.includes('sony')) return 'sony-wh-1000xm5';
  if (name.includes('logitech') && name.includes('mx')) return 'logitech-mx-master-3s';
  if (name.includes('belkin')) return 'belkin-magsafe-charger';
  
  return null; // No mapping found
}

/**
 * Main: Audit + Report
 */
async function main() {
  console.log('🔍 Duyệt lại từng sản phẩm...\n');

  const db = new sqlite3.Database(DB_PATH);
  const availableImages = getAvailableImages();
  
  console.log(`📊 Ảnh có sẵn: ${availableImages.length}\n`);

  db.all('SELECT id, name, image_url FROM products ORDER BY id', async (err, rows) => {
    if (err) {
      console.error('❌ Lỗi:', err);
      process.exit(1);
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let needsUpdateCount = 0;

    console.log('='.repeat(80));
    console.log('SẢN PHẨM CẦN SỬA');
    console.log('='.repeat(80));

    for (const product of rows) {
      const { id, name, image_url } = product;
      const currentSlug = image_url.split('/').pop().split('.jpg')[0].split('?')[0];
      const correctSlug = getCorrectImageSlug(name);
      
      if (!correctSlug) {
        // No mapping - will use fallback
        incorrectCount++;
        continue;
      }

      if (currentSlug === correctSlug && availableImages.includes(correctSlug)) {
        // Already correct
        correctCount++;
        continue;
      }

      if (availableImages.includes(correctSlug)) {
        needsUpdateCount++;
        console.log(`\n❌ [ID ${id}] ${name}`);
        console.log(`   Hiện tại: ${currentSlug}`);
        console.log(`   Cần là:   ${correctSlug} ✓`);
      } else {
        incorrectCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 TÓMSUMMARY:');
    console.log(`   ✅ Đúng rồi: ${correctCount}`);
    console.log(`   ❌ Sai (không tìm ảnh): ${incorrectCount}`);
    console.log(`   🔧 Cần sửa: ${needsUpdateCount}`);
    console.log(`   📊 Tổng: ${rows.length}`);
    console.log('='.repeat(80));

    db.close();
    process.exit(0);
  });
}

main();
