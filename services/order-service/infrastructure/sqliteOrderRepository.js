const sqlite3 = require('sqlite3').verbose();

class SqliteOrderRepository {
  constructor(dbPath = './db/orders.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function callback(err) {
        if (err) return reject(err);
        return resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        return resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        return resolve(rows);
      });
    });
  }

  async init() {
    await this.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      receiver_name TEXT,
      receiver_phone TEXT,
      shipping_address TEXT,
      shipping_city TEXT,
      shipping_district TEXT,
      shipping_ward TEXT,
      shipping_note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_category TEXT,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL
    )`);
  }

  async createOrder(order) {
    const created = await this.run(
      `INSERT INTO orders (
         user_id, status, total, receiver_name, receiver_phone, shipping_address, shipping_city, shipping_district, shipping_ward, shipping_note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(order.user_id),
        order.status || 'pending',
        Number(order.total || 0),
        order.shipping.receiver_name,
        order.shipping.phone,
        order.shipping.line1 || '',
        order.shipping.city || '',
        order.shipping.district || '',
        order.shipping.ward || '',
        order.shipping.note || ''
      ]
    );
    const orderId = created.lastID;
    for (const item of order.items) {
      await this.run(
        `INSERT INTO order_items (order_id, product_id, product_name, product_category, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.product_category, item.quantity, item.price]
      );
    }
    return orderId;
  }

  async updateOrderStatus(id, status) {
    const result = await this.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    return result.changes;
  }

  async getOrderById(id) {
    const order = await this.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return null;
    const items = await this.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    order.items = items;
    return order;
  }

  async listByUser(userId) {
    const orders = await this.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const placeholders = ids.map(() => '?').join(',');
    const items = await this.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, ids);
    return orders.map((o) => ({ ...o, items: items.filter((it) => it.order_id === o.id) }));
  }

  async listPurchasedItems(userId) {
    const rows = await this.all(
      `SELECT
         o.id AS order_id,
         o.status,
         o.created_at,
         i.product_id,
         i.product_name,
         i.product_category,
         i.quantity,
         i.price
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'completed'
       ORDER BY o.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async canReview(userId, productId) {
    const row = await this.get(
      `SELECT o.id AS order_id
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'completed' AND i.product_id = ?
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [userId, productId]
    );
    return row || null;
  }

  async listAll() {
    return this.all('SELECT * FROM orders ORDER BY created_at DESC');
  }
}

module.exports = SqliteOrderRepository;
