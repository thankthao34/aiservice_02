const Product = require('../domain/product');

test('Product entity maps fields correctly', () => {
  const row = {
    id: 1,
    name: 'Test Product',
    description: 'Desc',
    category: 'accessory',
    main_category: 'electronics',
    sub_category: 'phone',
    price: '199.99',
    image_url: 'http://img',
    stock: '10',
    brand: 'BrandX',
    rating: '4.5',
    is_featured: 1,
    warranty_months: '24'
  };
  const p = new Product(row);
  expect(p.id).toBe(1);
  expect(p.name).toBe('Test Product');
  expect(p.price).toBeCloseTo(199.99);
  expect(p.is_featured).toBe(true);
  expect(p.warranty_months).toBe(24);
});
