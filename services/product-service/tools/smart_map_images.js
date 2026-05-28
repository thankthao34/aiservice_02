// Smart image mapping: Assign 297 products to 45 existing images
// Based on brand, product line, and category matching

const fs = require('fs');
const sqlite3 = require('sqlite3');
const path = require('path');

const IMG_DIR = './public/images/products';
const DB_PATH = './db/products.db';
const API_PORT = 3002;

// Get all existing image files
function getExistingImages() {
  return fs.readdirSync(IMG_DIR)
    .filter(f => f.endsWith('.jpg') && !f.startsWith('__test'))
    .map(f => f.replace('.jpg', ''));
}

// Smart mapping function: products → existing images
function getImageSlugForProduct(productName, category) {
  const name = productName.toLowerCase();
  
  // Exact matches (these have real images)
  const exactMatches = {
    'iphone 15 pro': 'iphone-15-pro',
    'nothing phone 2a': 'nothing-phone-2a',
    'google pixel 8 pro': 'google-pixel-8-pro',
    'oneplus 12': 'oneplus-12',
    'macbook pro m3': 'macbook-pro-m3',
    'samsung a54': 'samsung-a54',
    'xiaomi 13t': 'xiaomi-13t',
    'dell xps 15': 'dell-xps-15',
    'lenovo ideapad': 'lenovo-ideapad',
    'realme 11 pro': 'realme-11-pro',
    'msi katana 15': 'msi-katana-15',
    'airpods pro': 'airpods-pro',
    'hp pavilion': 'hp-pavilion',
    'logitech mx keys': 'logitech-mx-keys',
    'acer swift go 14': 'acer-swift-go-14',
    'usb-c hub': 'usb-c-hub',
    'lenovo thinkpad x1 carbon': 'lenovo-thinkpad-x1-carbon',
    'screen protector': 'screen-protector',
    'sony wh-1000xm5': 'sony-wh-1000xm5',
    'power bank 10000mah': 'power-bank-10000mah',
    'logitech mx master 3s': 'logitech-mx-master-3s',
    'phone case': 'phone-case',
    'samsung t7 ssd 1tb': 'samsung-t7-ssd-1tb',
    'cable usb-c': 'cable-usb-c',
    'jbl tune 510bt': 'jbl-tune-510bt',
    'webcam 1080p': 'webcam-1080p',
    'apple watch se': 'apple-watch-se',
    'anker 65w gan charger': 'anker-65w-gan-charger',
    'samsung galaxy watch 6': 'samsung-galaxy-watch-6',
    'razer blackshark v2 x': 'razer-blackshark-v2-x',
    'belkin magsafe charger': 'belkin-magsafe-charger',
    'amazon kindle paperwhite': 'amazon-kindle-paperwhite',
    'mouse pad xl': 'mouse-pad-xl',
    'elgato stream deck mini': 'elgato-stream-deck-mini',
    'tp-link archer ax55 router': 'tp-link-archer-ax55-router',
    'dell inspiron 13': 'dell-inspiron-13',
    'dell inspiron 14': 'dell-inspiron-14',
    'dell inspiron 15': 'dell-inspiron-15',
    'dell inspiron creator': 'dell-inspiron-creator',
    'dell inspiron gaming': 'dell-inspiron-gaming',
    'dell latitude 13': 'dell-latitude-13',
    'dell latitude 14': 'dell-latitude-14',
    'dell latitude 15': 'dell-latitude-15',
  };

  // Check exact match
  if (exactMatches[name]) {
    return exactMatches[name];
  }

  // Pattern-based matching
  if (name.includes('samsung') && (name.includes('galaxy a') || name.includes('galaxy m'))) {
    return 'samsung-a54';
  }
  
  if (name.includes('xiaomi') && (name.includes('redmi') || name.includes('poco'))) {
    return 'xiaomi-13t';
  }
  
  if (name.includes('google') && name.includes('pixel a')) {
    return 'google-pixel-8-pro';
  }
  
  if (name.includes('motorola') && name.includes('edge')) {
    return 'cable-usb-c'; // fallback
  }
  
  if (name.includes('nokia') || name.includes('honor') || name.includes('infinix') || name.includes('tecno')) {
    return 'realme-11-pro'; // shared fallback for lesser-known phones
  }
  
  if (name.includes('dell') && name.includes('inspiron')) {
    if (name.includes('gaming')) return 'dell-inspiron-gaming';
    if (name.includes('creator')) return 'dell-inspiron-creator';
    if (name.includes('13')) return 'dell-inspiron-13';
    if (name.includes('14')) return 'dell-inspiron-14';
    return 'dell-inspiron-15';
  }
  
  if (name.includes('dell') && name.includes('latitude')) {
    if (name.includes('13')) return 'dell-latitude-13';
    if (name.includes('14')) return 'dell-latitude-14';
    return 'dell-latitude-15';
  }
  
  if (name.includes('hp') && (name.includes('envy') || name.includes('pavilion') || name.includes('victus'))) {
    return 'hp-pavilion';
  }
  
  if (name.includes('lenovo') && name.includes('ideapad')) {
    return 'lenovo-ideapad';
  }
  
  if (name.includes('lenovo') && (name.includes('legion') || name.includes('thinkbook'))) {
    return 'lenovo-thinkpad-x1-carbon';
  }
  
  if (name.includes('asus') && (name.includes('vivobook') || name.includes('rog') || name.includes('tuf'))) {
    return 'acer-swift-go-14';
  }
  
  if (name.includes('acer') && name.includes('nitro')) {
    return 'msi-katana-15';
  }
  
  if (name.includes('msi') || name.includes('gigabyte') || name.includes('huawei') || name.includes('lg')) {
    return 'dell-xps-15'; // general laptop
  }
  
  // Accessory mapping
  if (category === 'accessory') {
    if (name.includes('anker') || name.includes('ugreen') || name.includes('baseus') || name.includes('charger')) {
      return 'anker-65w-gan-charger';
    }
    if (name.includes('logitech') && name.includes('mx')) {
      return 'logitech-mx-master-3s';
    }
    if (name.includes('logitech')) {
      return 'logitech-mx-keys';
    }
    if (name.includes('belkin')) {
      return 'belkin-magsafe-charger';
    }
    if (name.includes('sony') || name.includes('audio') || name.includes('headphone') || name.includes('earbuds')) {
      return 'sony-wh-1000xm5';
    }
    if (name.includes('jbl') || name.includes('speaker')) {
      return 'jbl-tune-510bt';
    }
    if (name.includes('razer')) {
      return 'razer-blackshark-v2-x';
    }
    if (name.includes('asus') || name.includes('corsair') || name.includes('keyboard')) {
      return 'cable-usb-c';
    }
    if (name.includes('samsung') && name.includes('watch')) {
      return 'samsung-galaxy-watch-6';
    }
    if (name.includes('apple') && name.includes('watch')) {
      return 'apple-watch-se';
    }
    if (name.includes('router') || name.includes('tp-link') || name.includes('network')) {
      return 'tp-link-archer-ax55-router';
    }
    if (name.includes('webcam')) {
      return 'webcam-1080p';
    }
    if (name.includes('ssd') || name.includes('storage')) {
      return 'samsung-t7-ssd-1tb';
    }
    if (name.includes('kindle') || name.includes('ebook')) {
      return 'amazon-kindle-paperwhite';
    }
    if (name.includes('elgato') || name.includes('stream')) {
      return 'elgato-stream-deck-mini';
    }
    
    return 'cable-usb-c'; // Default accessory
  }
  
  // Default by category
  if (category === 'phone') {
    return 'iphone-15-pro';
  } else if (category === 'laptop') {
    return 'macbook-pro-m3';
  }
  
  return 'cable-usb-c'; // Ultimate fallback
}

function getImageUrl(slug, category) {
  return `http://localhost:${API_PORT}/images/product-photo/${slug}.jpg?category=${category}&v=20260405c`;
}

async function main() {
  console.log('\n' + '='.repeat(90));
  console.log('🔗 SMART IMAGE MAPPING - Map 297 products to 45 images');
  console.log('='.repeat(90));

  const existingImages = getExistingImages();
  console.log(`\n✅ Existing images: ${existingImages.length}`);
  console.log(existingImages.slice(0, 15).map(f => `   • ${f}`).join('\n'));

  // Get all products from DB
  const db = new sqlite3.Database(DB_PATH);
  
  db.all('SELECT id, name, category FROM products ORDER BY id', async (err, products) => {
    if (err || !products) {
      console.log('❌ DB Error:', err?.message);
      db.close();
      return;
    }

    console.log(`\n📊 Total products: ${products.length}`);
    console.log(`\n🔄 Updating image mappings...`);

    let updated = 0;
    let categoryBreakdown = {};

    for (const prod of products) {
      const newSlug = getImageSlugForProduct(prod.name, prod.category);
      const newImageUrl = getImageUrl(newSlug, prod.category);
      
      await new Promise(resolve => {
        db.run(
          'UPDATE products SET image_url = ? WHERE id = ?',
          [newImageUrl, prod.id],
          () => {
            updated++;
            categoryBreakdown[newSlug] = (categoryBreakdown[newSlug] || 0) + 1;
            resolve();
          }
        );
      });
    }

    console.log(`\n✅ Updated: ${updated}/${products.length} products`);
    
    console.log(`\n📈 Image usage breakdown:`);
    const sorted = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    sorted.forEach(([slug, count]) => {
      console.log(`   ${slug.padEnd(40)} ← ${count} products`);
    });

    console.log('\n✅ All products now map to existing images!');
    console.log('='.repeat(90) + '\n');
    
    db.close();
  });
}

main().catch(console.error);
