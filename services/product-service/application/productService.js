const SqliteProductRepository = require('../infrastructure/sqliteProductRepository');
const Product = require('../domain/product');

class ProductService {
  constructor(repo) {
    this.repo = repo || new SqliteProductRepository();
  }

  async getByIds(ids) {
    const rows = await this.repo.getByIds(ids);
    return rows.map((r) => new Product(r));
  }

  async listAll() {
    const rows = await this.repo.listAll();
    return rows.map((r) => new Product(r));
  }

  async list(filters) {
    const rows = await this.repo.list(filters);
    return rows.map((r) => new Product(r));
  }

  async getFeatured(limit) {
    const rows = await this.repo.getFeatured(limit);
    return rows.map((r) => new Product(r));
  }

  async decreaseInventory(items) {
    return this.repo.decreaseInventory(items);
  }

  async adminList() {
    const rows = await this.repo.adminList();
    return rows.map((r) => new Product(r));
  }

  async createProduct(data) {
    const row = await this.repo.createProduct(data);
    return row ? new Product(row) : null;
  }

  async updateProduct(id, data) {
    const row = await this.repo.updateProduct(id, data);
    return row ? new Product(row) : null;
  }

  async deleteProduct(id) {
    return this.repo.deleteProduct(id);
  }

  async getById(id) {
    const row = await this.repo.getById(id);
    return row ? new Product(row) : null;
  }

  async getAdminReviews() {
    return this.repo.getAdminReviews();
  }

  async getUserReviews(userId) {
    return this.repo.getUserReviews(userId);
  }

  async getReviewsByProduct(productId) {
    return this.repo.getReviewsByProduct(productId);
  }

  async createReview(productId, data) {
    return this.repo.createReview(productId, data);
  }

  async deleteReview(reviewId) {
    return this.repo.deleteReview(reviewId);
  }

  async initDb() {
    return this.repo.initDb();
  }
}

module.exports = ProductService;
