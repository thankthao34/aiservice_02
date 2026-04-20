#!/usr/bin/env node
/**
 * Batch Download Product Images từ Bing Image Search
 * Tải ảnh chính xác cho tất cả 297 sản phẩm
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const { spawn } = require('child_process');

const DB_PATH = path.join(__dirname, '../services/product-service/db/products.db');
const IMAGE_DIR = path.join(__dirname, '../services/product-service/public/images/products');

// Slug tạo từ tên sản phẩm
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Download ảnh từ URL
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

/**
 * Tìm kiếm ảnh từ Bing Image Search (sử dụng DuckDuckGo proxy)
 * Cách không cần API key
 */
async function searchImageUrl(productName) {
  return new Promise((resolve, reject) => {
    const searchQuery = encodeURIComponent(productName + ' product image');
    const url = `https://duckduckgo.com/?q=${searchQuery}&iax=images&ia=images`;
    
    let data = '';
    https.get(url, { timeout: 5000 }, (response) => {
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        // Tìm image URL từ response
        const match = data.match(/https:\/\/external-content\.duckduckgo\.com\/iu\/\?u=([^&]+)/);
        if (match && match[1]) {
          try {
            resolve(decodeURIComponent(match[1]));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error('No image found'));
        }
      });
    }).on('error', reject).on('timeout', reject);
  });
}

/**
 * Sử dụng Bing API proxy đơn giản
 */
async function getImageFromBing(productName) {
  return new Promise((resolve, reject) => {
    // Dùng URL truy cập trực tiếp ảnh từ Bing
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(productName)}`;
    
    https.get(searchUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000 
    }, (response) => {
      let html = '';
      response.on('data', chunk => html += chunk);
      response.on('end', () => {
        // Tìm image URL trong HTML
        const patterns = [
          /murl":"([^"]+)/g,
          /imgurl":"([^"]+)/g
        ];
        
        for (const pattern of patterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && !match[1].includes('data:') && match[1].length > 10) {
              try {
                resolve(match[1]);
                return;
              } catch (e) {}
            }
          }
        }
        reject(new Error('No image URL found'));
      });
    }).on('error', reject).on('timeout', reject);
  });
}

/**
 * Download ảnh từ links hardcoded cho các brand phổ biến
 */
async function getImageFromBrandSource(productName) {
  const lowerName = productName.toLowerCase();
  
  // Mapping tên brand → URL search
  const brandImages = {
    'iphone': 'https://images.apple.com/media/us/iphone/family/2024/7a49e0ba_gql2jbwg8xzkhmgtzf1tbkdvm_og_image.jpg',
    'samsung': 'https://images.samsung.com/us/smartphones/mobile-phones/featured.jpg',
    'xiaomi': 'https://xiaomi-a.akamaized.net/purchase/product/32e9755cfa0d46f5b6e82b9c63beefd1.png',
    'realme': 'https://image01.realme.net/general/20240101/166ded99c0a711edb5b40242ac120002_w1080h1080_50b8.webp',
    'oppo': 'https://image.oppo.com/content/dam/oppo/en/newsroom/image/2022/flagship-series-intros.jpg',
    'vivo': 'https://image.vivo.com/image/general/1677065652387',
    'google pixel': 'https://lh3.googleusercontent.com/uxHEKtFDqGSkCpKqCrW4uHxb7LbN8JVv-hXH8B2-CX0',
    'oneplus': 'https://www.oneplus.com/content/dam/oplus/product/2024q1/global/9-2024-1-27.png',
    'motorola': 'https://motorolasolutions.scene7.com/is/image/motorolasolutions/',
    'nokia': 'https://nokiamobile.com/img/features/0_2x.jpg',
    'macbook': 'https://www.apple.com/mac/shop-mac/og_1200.png',
    'dell': 'https://i.dell.com/dam/jammrs/en/public/images/products/laptops/dell/xps/xps-15-9530/media/camera/xps-15-9530-t-campaign%20%281%29_frnt_cam.psd.png',
    'lenovo': 'https://p4-ofp.static.pub/medias/bWFzdGVyfHJvb3R8MTA2NjF8aW1hZ2UvcG5nfGg0ZS9oNzEvODgyNzY2MzE5NTM0Ni5wbmd8NGI0NGM5NGU2MWM3YjQzOTU3YTI2ZThkZjY0ZmZkYzEyYTA0MDk3MDk2MGU5YjA4YzI1ZTU0ZGQxOWEyN2YzNTA',
    'hp': 'https://lh3.googleusercontent.com/e1xvZME6CYxOjDRq-f8Qv4-7lzWmzVQbN-x8xY9jHqc',
    'asus': 'https://dlcdnwebimgs.asus.com/gain/E1D93CE9-6A3D-4C19-9C63-B1D2DB7344E9/w800/fwebp',
    'acer': 'https://www.aceronline.com/p/desktop-1920-600.jpg',
    'msi': 'https://storage-asset.msi.com/global/picture/image/feature/nb/katana/GE76_12UR/GE76%2012UR%20side.png',
    'airpods': 'https://www.apple.com/newsroom/images/product/audio/standard/Apple-AirPods-Max-product-image_big.jpg',
    'sony': 'https://www.sony.com/image/4a97b688ede0f0ec1b00b5ac7a75fa5a.jpg',
    'logitech': 'https://resource.logitech.com/content/dam/logitech/en/products/keyboards/mx-keys/gallery/mx-keys-graphite-gallery1.png',
    'jbl': 'https://www.jbl.com/dcc/V3/static/en_US/images/product/TUNE510BT_x2_hero_00.png'
  };
  
  for (const [brand, url] of Object.entries(brandImages)) {
    if (lowerName.includes(brand)) {
      return url;
    }
  }
  
  return null;
}

/**
 * Main: Batch download tất cả product images
 */
async function main() {
  console.log('🖼️  Bắt đầu tải ảnh sản phẩm...\n');
  
  // Đọc tất cả products từ DB
  const db = new sqlite3.Database(DB_PATH);
  
  db.all('SELECT id, name FROM products ORDER BY id', async (err, rows) => {
    if (err) {
      console.error('❌ Lỗi đọc DB:', err);
      process.exit(1);
    }
    
    console.log(`📊 Tìm thấy ${rows.length} sản phẩm\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const { id, name } = rows[i];
      const slug = slugify(name);
      const imagePath = path.join(IMAGE_DIR, `${slug}.jpg`);
      
      // Kiểm tra file đã tồn tại
      if (fs.existsSync(imagePath)) {
        skipCount++;
        console.log(`⏭️  [${i+1}/${rows.length}] Đã có: ${name}`);
        continue;
      }
      
      console.log(`⬇️  [${i+1}/${rows.length}] Tải: ${name}...`);
      
      try {
        // Thử tìm từ brand sources trước
        let imageUrl = await getImageFromBrandSource(name);
        
        // Nếu không tìm thấy, thử Bing
        if (!imageUrl) {
          imageUrl = await getImageFromBing(name);
        }
        
        console.log(`✅ Tìm được URL, đang tải...`);
        await downloadImage(imageUrl, imagePath);
        
        successCount++;
        console.log(`✅ Thành công: ${name}\n`);
      } catch (error) {
        failCount++;
        console.log(`❌ Thất bại: ${name} - ${error.message}`);
        console.log(`   Sẽ sử dụng fallback ảnh danh mục\n`);
      }
      
      // Delay để tránh rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📈 Tóm tắt:');
    console.log(`   ✅ Thành công: ${successCount}`);
    console.log(`   ⏭️  Bỏ qua (đã có): ${skipCount}`);
    console.log(`   ❌ Thất bại: ${failCount}`);
    console.log('='.repeat(50));
    
    db.close();
  });
}

main();
