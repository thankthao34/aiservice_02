const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

const ORDER_STATUSES = ['pending', 'paid', 'shipping', 'completed', 'cancelled'];

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === GATEWAY_URL) return callback(null, true);
    if (process.env.ALLOW_LOCAL_DEV === 'true' && origin.includes('localhost')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
};
app.use(cors(corsOptions));
app.use(express.json());

const SqliteOrderRepository = require('./infrastructure/sqliteOrderRepository');
const OrderService = require('./application/orderService');
const orderController = require('./api/controllers/orderController');

function isAdmin(req) {
  return String(req.headers['x-user-role'] || '').toLowerCase() === 'admin';
}

function ensureAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Admin role required' });
  }
  return next();
}

const PRODUCT_SERVICE_URL_INTERNAL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const USER_SERVICE_URL_INTERNAL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const AI_SERVICE_URL_INTERNAL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

const repository = new SqliteOrderRepository('./db/orders.db');
const orderService = new OrderService({
  repository,
  config: {
    productServiceUrl: process.env.PRODUCT_SERVICE_URL || PRODUCT_SERVICE_URL_INTERNAL,
    userServiceUrl: process.env.USER_SERVICE_URL || USER_SERVICE_URL_INTERNAL,
    aiServiceUrl: process.env.AI_SERVICE_URL || AI_SERVICE_URL_INTERNAL
  }
});

orderController.setService(orderService);

app.get('/health', (_, res) => res.json({ ok: true, service: 'order-service' }));
app.post('/create', orderController.create);
app.post('/pay/:id', orderController.pay);
app.get('/user/:uid', orderController.getUserOrders);
app.get('/user/:uid/purchased-items', orderController.getPurchasedItems);
app.get('/can-review', orderController.canReview);
app.get('/admin/orders', ensureAdmin, orderController.adminList);
app.put('/admin/orders/:id/status', ensureAdmin, orderController.adminUpdateStatus);

(async () => {
  try {
    await repository.init();
    await orderService.init();
    app.listen(port, () => {
      console.log(`Order service running on ${port}`);
    });
  } catch (error) {
    console.error('Order service init failed', error);
    process.exit(1);
  }
})();

app.get('/health', (_, res) => res.json({ ok: true, service: 'order-service' }));

app.post('/create', async (req, res) => {
  const { user_id, items, shipping } = req.body;
  if (!user_id || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Missing user_id or items' });
  }

  if (!shipping || !shipping.receiver_name || !shipping.phone || !shipping.line1 || !shipping.city) {
    return res.status(400).json({ message: 'Missing shipping information' });
  }

  try {
    const productIds = items.map((i) => i.product_id).join(',');
    const { data: products } = await axios.get(`${PRODUCT_SERVICE_URL}/by-ids?ids=${productIds}`);
    const map = new Map(products.map((p) => [p.id, p]));

    let total = 0;
    const normalizedItems = items.map((i) => {
      const p = map.get(Number(i.product_id));
      if (!p) {
        throw new Error(`Product ${i.product_id} not found`);
      }
      const quantity = Number(i.quantity || 1);
      if (quantity <= 0) {
        throw new Error(`Invalid quantity for product ${i.product_id}`);
      }
      if (quantity > Number(p.stock || 0)) {
        throw new Error(`Product ${p.name} is out of stock`);
      }
      total += Number(p.price) * quantity;
      return {
        // store authoritative product id from product service to avoid ID mismatches
        product_id: Number(p.id),
        product_name: p.name,
        product_category: p.category,
        quantity,
        price: Number(p.price)
      };
    });

    const created = await run(
      `INSERT INTO orders (
        user_id, status, total, receiver_name, receiver_phone, shipping_address, shipping_city, shipping_district, shipping_ward, shipping_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(user_id),
        'pending',
        total,
        shipping.receiver_name,
        shipping.phone,
        shipping.line1,
        shipping.city,
        shipping.district || '',
        shipping.ward || '',
        shipping.note || ''
      ]
    );

    const orderId = created.lastID;
    for (const item of normalizedItems) {
      await run(
        `INSERT INTO order_items (order_id, product_id, product_name, product_category, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.product_category, item.quantity, item.price]
      );
    }

    await axios.post(`${PRODUCT_SERVICE_URL}/inventory/decrease`, {
      items: normalizedItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
    });

    return res.status(201).json({
      id: orderId,
      user_id: Number(user_id),
      total,
      status: 'pending'
    });
  } catch (e) {
    return res.status(500).json({ message: 'Order create failed', error: e.message });
  }
});

app.post('/pay/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'pending') {
      return res.json({ ok: true, status: order.status, alreadyProcessed: true });
    }

    const items = await all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    await run('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);

    try {
      const { data: profile } = await axios.get(`${USER_SERVICE_URL}/profile/${order.user_id}`);

      const newTotalSpent = Number(profile.total_spent || 0) + Number(order.total || 0);
      const newPurchaseCount = Number(profile.purchase_count || 0) + 1;
      const currentAvg = Number(profile.avg_price || 0);
      const orderAvg = items.reduce((s, i) => s + i.price * i.quantity, 0) / Math.max(items.reduce((s, i) => s + i.quantity, 0), 1);
      const newAvgPrice = (currentAvg * Number(profile.purchase_count || 0) + orderAvg) / newPurchaseCount;

      const categoryCounter = {};
      items.forEach((it) => {
        const c = it.product_category || 'accessory';
        categoryCounter[c] = (categoryCounter[c] || 0) + it.quantity;
      });
      const favCategory = Object.entries(categoryCounter).sort((a, b) => b[1] - a[1])[0][0];

      await axios.put(`${USER_SERVICE_URL}/update/${order.user_id}`, {
        total_spent: newTotalSpent,
        purchase_count: newPurchaseCount,
        avg_price: Number(newAvgPrice.toFixed(2)),
        fav_category: favCategory
      });

      const { data: segmentResult } = await axios.post(`${AI_SERVICE_URL}/segment`, {
        user_id: order.user_id,
        total_spent: newTotalSpent,
        purchase_count: newPurchaseCount,
        avg_price: Number(newAvgPrice.toFixed(2)),
        fav_category: favCategory
      });

      await axios.put(`${USER_SERVICE_URL}/update/${order.user_id}`, {
        segment: segmentResult.segment,
        segment_score: segmentResult.confidence
      });

      return res.json({ ok: true, status: 'paid', segmentResult });
    } catch (e) {
      return res.status(500).json({ message: 'Paid but AI/profile sync failed', error: e.message });
    }
  } catch (e) {
    return res.status(500).json({ message: 'Pay order failed', error: e.message });
  }
});

app.get('/user/:uid', async (req, res) => {
  try {
    const userId = Number(req.params.uid);
    const orders = await all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const orderIds = orders.map((o) => o.id);
    let items = [];
    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      items = await all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
    }

    const grouped = orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id)
    }));

    return res.json(grouped);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load orders', error: e.message });
  }
});

app.get('/user/:uid/purchased-items', async (req, res) => {
  try {
    const userId = Number(req.params.uid);
    const rows = await all(
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
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load purchased items', error: e.message });
  }
});

app.get('/can-review', async (req, res) => {
  try {
    const userId = Number(req.query.user_id);
    const productId = Number(req.query.product_id);
    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing user_id or product_id' });
    }

    const row = await get(
      `SELECT o.id AS order_id
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'completed' AND i.product_id = ?
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [userId, productId]
    );

    return res.json({ canReview: !!row, order_id: row?.order_id || null });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot validate review permission', error: e.message });
  }
});

app.get('/admin/orders', ensureAdmin, async (_, res) => {
  try {
    const rows = await all('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Cannot load orders', error: e.message });
  }
});

app.put('/admin/orders/:id/status', ensureAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || '').toLowerCase();
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!result.changes) return res.status(404).json({ message: 'Order not found' });

    const row = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot update order status', error: e.message });
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Order service running on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Order service init failed', error);
    process.exit(1);
  });