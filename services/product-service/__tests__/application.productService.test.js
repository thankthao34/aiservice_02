const ProductService = require('../application/productService');

class MockRepo {
  constructor(rows) { this._rows = rows || []; }
  async getByIds(ids) { return this._rows.filter(r => ids.includes(r.id)); }
  async list(filters) { return this._rows; }
}

test('ProductService.getByIds returns Product instances', async () => {
  const rows = [{ id: 1, name: 'A', price: 10 }, { id: 2, name: 'B', price: 20 }];
  const repo = new MockRepo(rows);
  const svc = new ProductService(repo);
  const result = await svc.getByIds([1]);
  expect(Array.isArray(result)).toBe(true);
  expect(result[0].id).toBe(1);
  expect(result[0].price).toBe(10);
});
