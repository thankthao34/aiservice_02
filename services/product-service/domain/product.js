class Product {
  constructor(row = {}) {
    this.id = row.id;
    this.name = row.name;
    this.description = row.description;
    this.category = row.category;
    this.main_category = row.main_category;
    this.sub_category = row.sub_category;
    this.price = Number(row.price || 0);
    this.image_url = row.image_url;
    this.stock = Number(row.stock || 0);
    this.brand = row.brand;
    this.rating = Number(row.rating || 0);
    this.is_featured = !!row.is_featured;
    this.warranty_months = Number(row.warranty_months || 12);
  }
}

module.exports = Product;
