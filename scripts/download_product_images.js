#!/usr/bin/env node
/**
 * Smart Product Image Downloader
 * Batch tải ảnh chính xác dựa trên product name pattern
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '../services/product-service/db/products.db');
const IMAGE_DIR = path.join(__dirname, '../services/product-service/public/images/products');

// Tạo thư mục nếu chưa có
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Download file từ URL
 */
async function downloadFile(url, outputPath, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let timeoutHandle;
    
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout
    }, (response) => {
      clearTimeout(timeoutHandle);
      
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadFile(response.headers.location, outputPath, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(outputPath, { flags: 'w' });
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        // Verify file size
        const stats = fs.statSync(outputPath);
        if (stats.size < 5000) {
          fs.unlinkSync(outputPath);
          reject(new Error('File too small'));
        } else {
          resolve();
        }
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
    
    timeoutHandle = setTimeout(() => {
      request.destroy();
      reject(new Error('Request timeout'));
    }, timeout);
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Socket timeout'));
    });
  });
}

/**
 * Mapping: Product name patterns -> Image URLs
 */
function getImageUrlForProduct(productName) {
  const name = productName.toLowerCase();
  
  // Pattern matching để tìm đúng ảnh cho từng sản phẩm
  const patterns = [
    // Flagship phones
    { test: /iphone 15 pro/i, url: 'https://www.apple.com/newsroom/images/product/iphone/standard/Apple-iPhone-15-Pro-lineup-hero-220923_big.jpg' },
    { test: /samsung s24 ultra/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/vn/2401/gallery/vn-galaxy-s24-ultra-sm-s918bzbdxxv-539410720' },
    { test: /google pixel 8 pro/i, url: 'https://lh3.googleusercontent.com/UOrVQZ02ySBOkZ8tVoq4KfQfxhvHZ_7u2sTZv6LMYFA11uGphLdC_e3G_DUwh4kEzLRlYtGBaZgLg_Qx' },
    
    // Mid-range phones
    { test: /samsung a54|galaxy a/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/ae/sm-a545fzkgmea/gallery/ae-galaxy-a54-sm-a545-sm-a545fzkgmea-535878920' },
    { test: /xiaomi 13t|redmi note/i, url: 'https://i01.appmifile.com/webstore/2023/10/30/25df89b9-bddf-48a3-991a-9e816fa38e4c.jpg' },
    { test: /realme 11|redmi/i, url: 'https://image01.realme.net/general/20231026/16e5f3c1f7e011eeb51a0242ac120002_w1080h1080_6c3b.webp' },
    
    // Laptops
    { test: /macbook pro m3|macbook/i, url: 'https://www.apple.com/macbook-pro/images/overview/hero__c2tqhywunjia_largetall.jpg' },
    { test: /dell xps 15|dell/i, url: 'https://i.dell.com/dam/jammrs/en/public/products/laptops/xps/xps-15-9530/media/images/xpsx15_pdp_hero_desktop_1800x1012_v5.jpg' },
    { test: /lenovo thinkpad|thinkpad/i, url: 'https://p4-ofp.static.pub/medias/bWFzdGVyfHJvb3R8MzM1NTR8aW1hZ2UvcG5nfGhjNC9oMWIvODgyNjQzOTA3NzQ2Mi5wbmd8MDI5NTBhMGE2MzY3YjQzYTYxYTU4NDQxZjYzODQ1YWE3YjM0ZTAxYzJmOWE1YWI2ONrqO' },
    
    // Accessories
    { test: /airpods pro/i, url: 'https://www.apple.com/newsroom/images/product/audio/standard/Apple-AirPods-Pro-2nd-gen-hero-09142022_big.jpg' },
    { test: /sony wh-1000xm5|sony.*headphone/i, url: 'https://www.sony.com/image/cc6f0de0ec10dcf39a018b7a8e1ff3f3?fmt=pjpeg&wid=330&bgcolor=FFFFFF&bgc=FFFFFF' },
    { test: /logitech mx/i, url: 'https://resource.logitech.com/content/dam/logitech/en/products/keyboards/mx-keys/gallery/mx-keys-graphite-gallery1.png' },
    { test: /samsung galaxy watch/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/vn/2308/gallery/vn-galaxy-watch-6-classic-sm-r950nzsaxvn-539410766' },
  ];
  
  for (const { test, url } of patterns) {
    if (test.test(productName)) {
      return url;
    }
  }
  
  // Fallback: tìm ảnh generic theo brand
  const brandUrls = {
    'Samsung': 'https://images.samsung.com/is/image/samsung/p6pim/vn/2401/gallery/vn-galaxy-s24-ultra-sm-s918bzbdxxv-539410720',
    'iPhone': 'https://www.apple.com/newsroom/images/product/iphone/standard/Apple-iPhone-15-Pro-lineup-hero-220923_big.jpg',
    'Xiaomi': 'https://i01.appmifile.com/webstore/2023/10/30/25df89b9-bddf-48a3-991a-9e816fa38e4c.jpg',
    'Realme': 'https://image01.realme.net/general/20231026/16e5f3c1f7e011eeb51a0242ac120002_w1080h1080_6c3b.webp',
    'OnePlus': 'https://www.oneplus.com/content/dam/oplus/product/2024q1/global/9-2024-1-27.png',
    'Google': 'https://lh3.googleusercontent.com/UOrVQZ02ySBOkZ8tVoq4KfQfxhvHZ_7u2sTZv6LMYFA11uGphLdC_e3G_DUwh4kEzLRlYtGBaZgLg_Qx',
    'MacBook': 'https://www.apple.com/macbook-pro/images/overview/hero__c2tqhywunjia_largetall.jpg',
    'Dell': 'https://i.dell.com/dam/jammrs/en/public/products/laptops/xps/xps-15-9530/media/images/xpsx15_pdp_hero_desktop_1800x1012_v5.jpg',
    'Lenovo': 'https://p4-ofp.static.pub/medias/bWFzdGVyfHJvb3R8MzM1NTR8aW1hZ2UvcG5nfGhjNC9oMWIvODgyNjQzOTA3NzQ2Mi5wbmd8MDI5NTBhMGE2MzY3YjQzYTYxYTU4NDQxZjYzODQ1YWE3YjM0ZTAxYzJmOWE1YWI2ONrqO',
    'HP': 'https://lh3.googleusercontent.com/e1xvZME6CYxOjDRq-f8Qv4-7lzWmzVQbN-x8xY9jHqc',
    'ASUS': 'https://dlcdnwebimgs.asus.com/gain/E1D93CE9-6A3D-4C19-9C63-B1D2DB7344E9/w800/fwebp',
  };
  
  for (const [brand, url] of Object.entries(brandUrls)) {
    if (productName.includes(brand)) {
      return url;
    }
  }
  
  return null; // No URL found
}

/**
 * Main: Download tất cả product images
 */
async function main() {
  console.log('🖼️  Bắt đầu tải ảnh sản phẩm chính xác...\n');
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.all('SELECT id, name FROM products ORDER BY id', async (err, rows) => {
    if (err) {
      console.error('❌ Lỗi đọc DB:', err);
      db.close();
      process.exit(1);
    }
    
    console.log(`📊 Tính năng: ${rows.length} sản phẩm\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let noUrlCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const { id, name } = rows[i];
      const slug = slugify(name);
      const imagePath = path.join(IMAGE_DIR, `${slug}.jpg`);
      
      // Bỏ qua nếu đã có file
      if (fs.existsSync(imagePath)) {
        skipCount++;
        console.log(`⏭️  [${i+1}/${rows.length}] ✔️ Đã có: ${name}`);
        continue;
      }
      
      const imageUrl = getImageUrlForProduct(name);
      if (!imageUrl) {
        noUrlCount++;
        console.log(`⏭️  [${i+1}/${rows.length}] ⚠️  Không match: ${name}`);
        continue;
      }
      
      console.log(`⬇️  [${i+1}/${rows.length}] Tải: ${name}...`);
      
      try {
        await downloadFile(imageUrl, imagePath);
        successCount++;
        console.log(`✅ Thành công\n`);
      } catch (error) {
        errorCount++;
        console.log(`❌ Lỗi: ${error.message}\n`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 KẾT QUẢ:');
    console.log(`   ✅ Tải thành công: ${successCount}`);
    console.log(`   ⏭️  Bỏ qua (đã có): ${skipCount}`);
    console.log(`   ⚠️  Không match pattern: ${noUrlCount}`);
    console.log(`   ❌ Lỗi tải: ${errorCount}`);
    console.log(`   📊 Tổng cộng: ${successCount + skipCount}/${rows.length} có ảnh`);
    console.log('='.repeat(60));
    
    db.close();
    process.exit(0);
  });
}

main();
