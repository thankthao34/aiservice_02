const { Order, OrderItem } = require('../domain/order');

describe('Order domain', () => {
  test('creates order and calculates total', () => {
    const payload = {
      user_id: 1,
      items: [
        { product_id: 10, product_name: 'A', product_category: 'accessory', quantity: 2, price: 5 },
        { product_id: 11, product_name: 'B', product_category: 'accessory', quantity: 1, price: 3 }
      ],
      shipping: { receiver_name: 'T', phone: '0123', line1: 'addr', city: 'HCM' }
    };
    const order = new Order(payload);
    expect(order.total).toBe(13);
    order.addItem({ product_id: 12, product_name: 'C', product_category: 'accessory', quantity: 3, price: 2 });
    expect(order.total).toBe(19);
  });

  test('validateForCreate throws on missing data', () => {
    const bad = new Order({ user_id: null, items: [], shipping: {} });
    expect(() => bad.validateForCreate()).toThrow();
  });
});
