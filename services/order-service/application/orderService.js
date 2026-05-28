const axios = require('axios');
const { Order } = require('../domain/order');

class OrderService {
  constructor({ repository, config = {} }) {
    this.repository = repository;
    this.userServiceUrl = config.userServiceUrl;
    this.productServiceUrl = config.productServiceUrl;
    this.aiServiceUrl = config.aiServiceUrl;
  }

  async init() {
    if (this.repository.init) await this.repository.init();
  }

  async createOrder(payload) {
    const order = new Order(payload);
    order.validateForCreate();

    // fetch product details
    const productIds = order.items.map((i) => i.product_id).join(',');
    const { data: products } = await axios.get(`${this.productServiceUrl}/by-ids?ids=${productIds}`);
    const map = new Map(products.map((p) => [p.id, p]));

    // normalize and validate items
    for (const it of order.items) {
      const p = map.get(Number(it.product_id));
      if (!p) throw new Error(`Product ${it.product_id} not found`);
      if (it.quantity <= 0) throw new Error(`Invalid quantity for product ${it.product_id}`);
      if (it.quantity > Number(p.stock || 0)) throw new Error(`Product ${p.name} is out of stock`);
      it.price = Number(p.price);
      it.product_name = p.name;
      it.product_category = p.category;
    }

    order.total = order.calculateTotal();

    const orderId = await this.repository.createOrder(order);

    // decrease inventory on product service
    await axios.post(`${this.productServiceUrl}/inventory/decrease`, {
      items: order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
    });

    return { id: orderId, user_id: order.user_id, total: order.total, status: order.status };
  }

  async payOrder(orderId) {
    const order = await this.repository.getOrderById(Number(orderId));
    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending') return { ok: true, status: order.status, alreadyProcessed: true };

    await this.repository.updateOrderStatus(orderId, 'paid');

    // sync with user and ai services
    const { data: profile } = await axios.get(`${this.userServiceUrl}/profile/${order.user_id}`);
    const newTotalSpent = Number(profile.total_spent || 0) + Number(order.total || 0);
    const newPurchaseCount = Number(profile.purchase_count || 0) + 1;
    const currentAvg = Number(profile.avg_price || 0);
    const items = order.items || [];
    const orderAvg = items.reduce((s, i) => s + i.price * i.quantity, 0) / Math.max(items.reduce((s, i) => s + i.quantity, 0), 1);
    const newAvgPrice = (currentAvg * Number(profile.purchase_count || 0) + orderAvg) / newPurchaseCount;

    const categoryCounter = {};
    items.forEach((it) => {
      const c = it.product_category || 'accessory';
      categoryCounter[c] = (categoryCounter[c] || 0) + it.quantity;
    });
    const favCategory = Object.entries(categoryCounter).sort((a, b) => b[1] - a[1])[0][0];

    await axios.put(`${this.userServiceUrl}/update/${order.user_id}`, {
      total_spent: newTotalSpent,
      purchase_count: newPurchaseCount,
      avg_price: Number(newAvgPrice.toFixed(2)),
      fav_category: favCategory
    });

    const { data: segmentResult } = await axios.post(`${this.aiServiceUrl}/segment`, {
      user_id: order.user_id,
      total_spent: newTotalSpent,
      purchase_count: newPurchaseCount,
      avg_price: Number(newAvgPrice.toFixed(2)),
      fav_category: favCategory
    });

    await axios.put(`${this.userServiceUrl}/update/${order.user_id}`, {
      segment: segmentResult.segment,
      segment_score: segmentResult.confidence
    });

    return { ok: true, status: 'paid', segmentResult };
  }

  async getUserOrders(userId) {
    return this.repository.listByUser(Number(userId));
  }

  async getPurchasedItems(userId) {
    return this.repository.listPurchasedItems(Number(userId));
  }

  async canReview(userId, productId) {
    return this.repository.canReview(Number(userId), Number(productId));
  }

  async adminListOrders() {
    return this.repository.listAll();
  }

  async adminUpdateStatus(id, status) {
    return this.repository.updateOrderStatus(Number(id), status);
  }
}

module.exports = OrderService;
