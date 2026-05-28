class OrderItem {
  constructor({ product_id, product_name, product_category, quantity, price }) {
    this.product_id = Number(product_id);
    this.product_name = product_name;
    this.product_category = product_category;
    this.quantity = Number(quantity);
    this.price = Number(price);
  }
}

class Order {
  constructor({ id = null, user_id, status = 'pending', items = [], total = 0, shipping = {}, created_at = null }) {
    this.id = id;
    this.user_id = Number(user_id);
    this.status = status;
    this.items = items.map((i) => new OrderItem(i));
    this.total = Number(total) || this.calculateTotal();
    this.shipping = shipping;
    this.created_at = created_at;
  }

  addItem(item) {
    this.items.push(new OrderItem(item));
    this.total = this.calculateTotal();
  }

  calculateTotal() {
    return this.items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
  }

  validateForCreate() {
    if (!this.user_id || !Array.isArray(this.items) || !this.items.length) {
      throw new Error('Missing user_id or items');
    }
    if (!this.shipping || !this.shipping.receiver_name || !this.shipping.phone || !this.shipping.line1 || !this.shipping.city) {
      throw new Error('Missing shipping information');
    }
    return true;
  }
}

module.exports = { Order, OrderItem };
