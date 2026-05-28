let service = null;

function setService(s) {
  service = s;
}

const { validateCreatePayload, validateStatus } = require('../validators/orderValidators');

async function create(req, res) {
  try {
    const v = validateCreatePayload(req.body);
    if (!v.ok) return res.status(400).json({ message: 'Invalid payload', errors: v.errors });
    const result = await service.createOrder(req.body);
    return res.status(201).json(result);
  } catch (e) {
    // domain/application validation errors should be client errors
    if (/Missing|Invalid|out of stock|not found/i.test(e.message)) {
      return res.status(400).json({ message: 'Order create failed', error: e.message });
    }
    return res.status(500).json({ message: 'Order create failed', error: e.message });
  }
}

async function pay(req, res) {
  try {
    const result = await service.payOrder(req.params.id);
    return res.json(result);
  } catch (e) {
    if (/Order not found/i.test(e.message)) return res.status(404).json({ message: e.message });
    return res.status(500).json({ message: 'Pay order failed', error: e.message });
  }
}

async function getUserOrders(req, res) {
  try {
    const result = await service.getUserOrders(req.params.uid);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load orders', error: e.message });
  }
}

async function getPurchasedItems(req, res) {
  try {
    const result = await service.getPurchasedItems(req.params.uid);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load purchased items', error: e.message });
  }
}

async function canReview(req, res) {
  try {
    const userId = Number(req.query.user_id);
    const productId = Number(req.query.product_id);
    if (!userId || !productId) return res.status(400).json({ message: 'Missing user_id or product_id' });
    const row = await service.canReview(userId, productId);
    return res.json({ canReview: !!row, order_id: row?.order_id || null });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot validate review permission', error: e.message });
  }
}

async function adminList(req, res) {
  try {
    const rows = await service.adminListOrders();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load orders', error: e.message });
  }
}

async function adminUpdateStatus(req, res) {
  try {
    const status = String(req.body.status || '').toLowerCase();
    const v = validateStatus(status);
    if (!v.ok) return res.status(400).json({ message: v.error });
    const changes = await service.adminUpdateStatus(req.params.id, status);
    if (!changes) return res.status(404).json({ message: 'Order not found' });
    const row = await service.repository.getOrderById(req.params.id);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot update order status', error: e.message });
  }
}

module.exports = { setService, create, pay, getUserOrders, getPurchasedItems, canReview, adminList, adminUpdateStatus };
