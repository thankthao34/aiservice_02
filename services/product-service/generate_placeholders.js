#!/usr/bin/env node
/**
 * Generate professional placeholder SVG images for each product
 * Shows: Product name, price, category, brand colors
 */

const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = './db/products.db';
const IMG_DIR = './public/images/products';

if (!fs.existsSync(IMG_DIR)) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
}

// Category colors
const categoryColors = {
  phone: { bg: '#1e40af', accent: '#60a5fa', text: '#ffffff' },
  laptop: { bg: '#15803d', accent: '#86efac', text: '#ffffff' },
  accessory: { bg: '#92400e', accent: '#f59e0b', text: '#ffffff' }
};

function generateSVG(productName, price, category, productId) {
  const colors = categoryColors[category] || categoryColors.accessory;
  
  // Extract brand name for icon
  const brand = productName.split(' ')[0];
  const icon = brand.substring(0, 2).toUpperCase();
  
  // Shorten product name if too long
  let displayName = productName;
  if (displayName.length > 35) {
    displayName = displayName.substring(0, 32) + '...';
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <!-- Background with gradient -->
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#000;stop-opacity:0.2" />
    </linearGradient>
  </defs>
  
  <!-- Main background -->
  <rect width="600" height="600" fill="url(#grad)"/>
  
  <!-- Top accent bar with category -->
  <rect width="600" height="80" fill="${colors.accent}"/>
  
  <!-- Category label -->
  <text x="30" y="55" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${colors.bg}">
    ${category.toUpperCase()}
  </text>
  
  <!-- Brand icon circle -->
  <circle cx="500" cy="40" r="35" fill="${colors.bg}"/>
  <text x="500" y="55" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">
    ${icon}
  </text>
  
  <!-- Product name -->
  <text x="300" y="250" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">
    ${escapeXml(displayName.substring(0, 20))}
  </text>
  
  <text x="300" y="300" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    ${escapeXml(displayName.substring(20, 40))}
  </text>
  
  <!-- Price -->
  <text x="300" y="390" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="${colors.accent}" text-anchor="middle">
    $${Math.round(price)}
  </text>
  
  <!-- Product ID (subtle) -->
  <text x="300" y="550" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">
    Product #${productId} • ${new Date().getFullYear()}
  </text>
  
  <!-- Decorative corner elements -->
  <circle cx="50" cy="550" r="15" fill="${colors.accent}" opacity="0.3"/>
  <circle cx="550" cy="100" r="20" fill="${colors.accent}" opacity="0.2"/>
</svg>`;

  return svg;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('\n' + '='.repeat(90));
  console.log('🎨 GENERATE PROFESSIONAL PLACEHOLDER IMAGES');
  console.log('='.repeat(90));

  const db = new sqlite3.Database(DB_PATH);

  db.all('SELECT id, name, price, category FROM products ORDER BY id', (err, products) => {
    if (err || !products) {
      console.log('❌ DB Error:', err?.message);
      db.close();
      return;
    }

    console.log(`\n📊 Total products: ${products.length}\n`);

    let created = 0;
    let skipped = 0;

    for (const prod of products) {
      const slug = slugify(prod.name);
      const filepath = path.join(IMG_DIR, `${slug}.svg`);
      
      // Check if same-named JPG exists (take that instead)
      const jpgPath = filepath.replace('.svg', '.jpg');
      if (fs.existsSync(jpgPath)) {
        skipped++;
        continue;
      }

      // Create SVG
      const svg = generateSVG(prod.name, prod.price, prod.category, prod.id);
      fs.writeFileSync(filepath, svg);
      
      created++;

      if (created % 30 === 0) {
        console.log(`  ✅ Created ${created} SVGs...`);
      }
    }

    console.log(`\n✅ Created: ${created} SVG placeholders`);
    console.log(`⏭️  Kept: ${skipped} real JPG images`);
    console.log(`\n📝 Note: SVG files can be:
   • Served directly (lightweight)
   • Converted to PNG/JPG with ImageMagick
   • Replaced with real images later`);
    console.log('='.repeat(90) + '\n');

    db.close();
  });
}

main();
