#!/usr/bin/env node
/**
 * Smart Product Image Downloader v2
 * Batch downloads exact product images cho tất cả 300 sản phẩm
 * Xử lý cả base products và generated variants
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, './public/images/products');

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getProducts() {
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

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const proto = url.startsWith('https') ? https : http;
    
    proto.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(outputPath);
        if (stats.size < 5000) {
          fs.unlinkSync(outputPath);
          reject(new Error('Too small'));
        } else {
          resolve();
        }
      });
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

function getImageUrlForProduct(productName) {
  const name = productName.toLowerCase();
  
  // Comprehensive pattern matching cho cả base + generated products
  const patterns = [
    // === PHONES: Base ===
    { test: /iPhone 15 Pro/i, url: 'https://www.apple.com/newsroom/images/product/iphone/standard/Apple-iPhone-15-Pro-lineup-hero-220923_big.jpg' },
    { test: /Samsung S24 Ultra/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/vn/2401/gallery/vn-galaxy-s24-ultra-sm-s918bzbdxxv-539410720' },
    { test: /Google Pixel 8 Pro/i, url: 'https://lh3.googleusercontent.com/UOrVQZ02ySBOkZ8tVoq4KfQfxhvHZ_7u2sTZv6LMYFA11uGphLdC_e3G_DUwh4kEzLRlYtGBaZgLg_Qx' },
    { test: /Samsung A54/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/ae/sm-a545fzkgmea/gallery/ae-galaxy-a54-sm-a545-sm-a545fzkgmea-535878920' },
    { test: /Xiaomi 13T/i, url: 'https://i01.appmifile.com/webstore/2023/10/30/25df89b9-bddf-48a3-991a-9e816fa38e4c.jpg' },
    { test: /Realme 11 Pro/i, url: 'https://image01.realme.net/general/20231026/16e5f3c1f7e011eeb51a0242ac120002_w1080h1080_6c3b.webp' },
    { test: /Nothing Phone 2a/i, url: 'https://www.nothing.tech/cdn/shop/products/main_52ba0b8d-2de6-45e7-a023-5e0d0d8e7f1d_700x.jpg' },
    { test: /OnePlus 12/i, url: 'https://www.oneplus.com/content/dam/oplus/product/2024q1/global/9-2024-1-27.png' },
    
    // === PHONES: Generated variants (Samsung, Xiaomi, Realme, etc.) ===
    { test: /Samsung Galaxy A.*Gen/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/ae/sm-a545fzkgmea/gallery/ae-galaxy-a54-sm-a545-sm-a545fzkgmea-535878920' },
    { test: /Samsung Galaxy M.*Gen/i, url: 'https://images.samsung.com/is/image/samsung/p6pim/vn/sm-m145fzsdxxv/gallery' },
    { test: /Xiaomi Redmi Note.*Gen/i, url: 'https://i01.appmifile.com/webstore/2023/10/30/25df89b9-bddf-48a3-991a-9e816fa38e4c.jpg' },
    { test: /Xiaomi Poco X.*Gen/i, url: 'https://i01.appmifile.com/webstore/2024/01/15/d1c0c2d8c6e6' },
    { test: /Realme Number.*Gen/i, url: 'https://image01.realme.net/general/20231026/16e5f3c1f7e011eeb51a0242ac120002_w1080h1080_6c3b.webp' },
    { test: /Vivo V Series/i, url: 'https://images-na.ssl-images-amazon.com/images/P/B0CV5G13H3.01._SY300_.jpg' },
    { test: /OPPO Reno/i, url: 'https://image.oppo.com/content/dam/oppo/en/newsroom/image/2022/flagship-series-intros.jpg' },
    { test: /Google Pixel A.*Gen/i, url: 'https://lh3.googleusercontent.com/UOrVQZ02ySBOkZ8tVoq4KfQfxhvHZ_7u2sTZv6LMYFA11uGphLdC_e3G_DUwh4kEzLRlYtGBaZgLg_Qx' },
    { test: /OnePlus Nord/i, url: 'https://www.oneplus.com/content/dam/oplus/product/2024q1/global/9-2024-1-27.png' },
    { test: /Motorola Edge/i, url: 'https://motorolasolutions.scene7.com/is/image/motorolasolutions/edge-2024' },
    { test: /Nokia G Series/i, url: 'https://images.nokia.com/media/image/2023/11/g11.png' },
    { test: /Infinix Zero/i, url: 'https://www.infinixmobility.com/wp-content/uploads/2024/01/zero-30.jpg' },
    { test: /Tecno Camon/i, url: 'https://www.tecnomobi.com/media/camon-20.jpg' },
    { test: /Asus Zenfone/i, url: 'https://dlcdnwebimgs.asus.com/gain/E1D93CE9-6A3D-4C19-9C63-B1D2DB7344E9' },
    
    // === LAPTOPS: Base ===
    { test: /MacBook Pro M3/i, url: 'https://www.apple.com/macbook-pro/images/overview/hero__c2tqhywunjia_largetall.jpg' },
    { test: /Dell XPS 15/i, url: 'https://i.dell.com/dam/jammrs/en/public/products/laptops/xps/xps-15-9530/media/images/xpsx15_pdp_hero_desktop_1800x1012_v5.jpg' },
    { test: /Lenovo ThinkPad X1 Carbon/i, url: 'https://p4-ofp.static.pub/medias/bWFzdGVyfHJvb3R8MzM1NTR8aW1hZ2UvcG5nfGhjNC9oMWIvODgyNjQzOTA3NzQ2Mi5wbmd8MDI5NTBhMGE2MzY3YjQzYTYxYTU4NDQxZjYzODQ1YWE3YjM0ZTAxYzJmOWE1YWI2ONrqO' },
    { test: /Asus Vivobook/i, url: 'https://dlcdnwebimgs.asus.com/gain/24A33D73-733F-4A41-B606-B9FA04922F0F/w240/h180' },
    { test: /Lenovo IdeaPad/i, url: 'https://p3-ofp.static.pub/medias/bWFzdGVyfHJvb3R8OTQ5NzB8aW1hZ2UvcG5nfGgzNS9oOWYvODk0NDYwNjYwNzA2Mi5wbmd8NjA4OTI3MjNkOTljOWFkYjczYTY2YjI1MDAwZWE3Y2VhNGMxOTM2MzUyNTJiZTU2YzY0YWJlZTJmNWJhZjE3OTA' },
... (file continues)
