const fs = require('fs');
const path = require('path');
const SqliteOrderRepository = require('../infrastructure/sqliteOrderRepository');

describe('SqliteOrderRepository', () => {
  const tmpDb = path.join(__dirname, 'tmp_orders.db');
  let repo;

  beforeAll(async () => {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    repo = new SqliteOrderRepository(tmpDb);
    await repo.init();
  });

  afterAll(() => {
    if (repo && repo.close) {
      return repo.close().then(() => {
        if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
      });
    }
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
  });

  test('create and retrieve order', async () => {
    const order = {
      user_id: 2,
      items: [ { product_id: 100, product_name: 'P', product_category: 'accessory', quantity: 1, price: 9.5 } ],
      shipping: { receiver_name: 'X', phone: '09', line1: 'addr', city: 'HCM' },
      total: 9.5
    };
    const id = await repo.createOrder(order);
    expect(id).toBeGreaterThan(0);
    const got = await repo.getOrderById(id);
    expect(got).not.toBeNull();
    expect(got.user_id).toBe(2);
    expect(Array.isArray(got.items)).toBe(true);
    expect(got.items[0].product_id).toBe(100);
  });
});
