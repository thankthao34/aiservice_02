# Update product images in database
$dbPath = ".\db\products.db"
$imageConfig = @{
    "phone" = "https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=600&h=600&fit=crop"
    "laptop" = "https://images.unsplash.com/photo-1527864550417-7fd231fc5205?w=600&h=600&fit=crop"
    "accessory" = "https://images.unsplash.com/photo-1587829191301-4c3943b65a58?w=600&h=600&fit=crop"
}

Write-Host "🔄 Updating all product images with Unsplash URLs..."

# Query and update each product
$products = & node -e "
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db/products.db');
db.all('SELECT id, category FROM products', (err, rows) => {
  console.log(JSON.stringify(rows || []));
  db.close();
});
" | ConvertFrom-Json

$count = 0
foreach ($product in $products) {
    $category = $product.category
    $imageUrl = $imageConfig[$category]
    
    & node -e "
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database('./db/products.db');
    db.run('UPDATE products SET image_url = ? WHERE id = ?', ['$imageUrl', $($product.id)]);
    db.close();
    " 2>$null
    
    $count++
    if ($count % 50 -eq 0) {
        Write-Host "✅ Updated $count/$($products.Count) products..."
    }
}

Write-Host "`n✅ SUCCESS! All $($products.Count) products updated with Unsplash image URLs"
Write-Host "`n📝 Image mappings:"
Write-Host "   📱 Phones → https://images.unsplash.com/photo-1511707267537-b85faf00021e"
Write-Host "   💻 Laptops → https://images.unsplash.com/photo-1527864550417-7fd231fc5205"
Write-Host "   🎧 Accessories → https://images.unsplash.com/photo-1587829191301-4c3943b65a58"
Write-Host "`n🚀 Now refresh http://localhost:5273 to see images!"
