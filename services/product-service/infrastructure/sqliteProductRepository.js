const sqlite3 = require('sqlite3').verbose();

class SqliteProductRepository {
  constructor(dbPath = './db/products.db') {
    this.dbPath = dbPath;
  }

  _open() {
    return new sqlite3.Database(this.dbPath);
  }

  getByIds(ids) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(ids) || !ids.length) return resolve([]);
      const db = this._open();
      const placeholders = ids.map(() => '?').join(',');
      db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, ids, (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  listAll() {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  list(filters = {}) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      const { category, mainCategory, subCategory, minPrice, maxPrice, search } = filters;
      const where = [];
      const values = [];

      function normalizeKey(v) { return String(v || '').trim().toLowerCase(); }

      const nMain = normalizeKey(mainCategory);
      const nSub = normalizeKey(subCategory);
      const nCat = normalizeKey(category);

      if (nMain) { where.push('main_category = ?'); values.push(nMain); }
      if (nSub) { where.push('(sub_category = ? OR category = ?)'); values.push(nSub, nSub); }
      else if (nCat) { where.push('(sub_category = ? OR category = ?)'); values.push(nCat, nCat); }
      if (minPrice !== undefined && minPrice !== null) { where.push('price >= ?'); values.push(Number(minPrice)); }
      if (maxPrice !== undefined && maxPrice !== null) { where.push('price <= ?'); values.push(Number(maxPrice)); }
      if (search) {
        const like = `%${search}%`;
        where.push('(name LIKE ? OR description LIKE ? OR brand LIKE ?)');
        values.push(like, like, like);
      }

      const sql = `SELECT p.*, COALESCE(r.review_count,0) AS review_count FROM products p LEFT JOIN (SELECT product_id, COUNT(*) AS review_count FROM reviews GROUP BY product_id) r ON r.product_id = p.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.id DESC`;
      db.all(sql, values, (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getFeatured(limit = 12) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.all('SELECT * FROM products WHERE is_featured = 1 ORDER BY rating DESC LIMIT ?', [Number(limit)], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  async decreaseInventory(items) {
    if (!Array.isArray(items) || !items.length) return { ok: false, message: 'Missing items' };
    const db = this._open();
    const that = this;
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        try {
          for (const item of items) {
            const id = Number(item.product_id);
            const qty = Number(item.quantity || 0);
            if (!id || qty <= 0) throw new Error('Invalid item payload');
            // check stock
            // using synchronous-ish pattern via get
          }
        } catch (err) {
          db.close();
          return reject(err);
        }

        // perform checks
        const checks = items.map((it) => new Promise((res, rej) => db.get('SELECT id, stock, name FROM products WHERE id = ?', [Number(it.product_id)], (err, row) => {
          if (err) return rej(err);
          const quantity = Number(it.quantity || 0);
          if (!row || quantity <= 0) return rej(new Error('Invalid item payload'));
          if (Number(row.stock) < quantity) return rej(new Error(`Out of stock for ${row.name}`));
          res(true);
        })));

        Promise.all(checks).then(() => {
          const updates = items.map((it) => new Promise((res, rej) => db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [Number(it.quantity), Number(it.product_id)], function (err) {
            if (err) return rej(err);
            res(true);
          })));
          Promise.all(updates).then(() => {
            db.close();
            resolve({ ok: true });
          }).catch((e) => { db.close(); reject(e); });
        }).catch((e) => { db.close(); reject(e); });
      });
    });
  }

  adminList() { return this.listAll(); }

  createProduct(data) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      const stmt = 'INSERT INTO products (name, description, category, main_category, sub_category, price, image_url, stock, rating, is_featured, brand, warranty_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const vals = [
        data.name,
        data.description || '',
        data.sub_category || data.category || '',
        data.main_category || '',
        data.sub_category || data.category || '',
        Number(data.price),
        data.image_url || data.default_image || '',
        Number(data.stock || 0),
        Number(data.rating || 4.0),
        Number(data.is_featured ? 1 : 0),
        data.brand || 'Generic',
        Number(data.warranty_months || 12)
      ];
      db.run(stmt, vals, function (err) {
        if (err) { db.close(); return reject(err); }
        db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (err2, row) => { db.close(); if (err2) return reject(err2); resolve(row); });
      });
    });
  }

  updateProduct(id, data) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
        if (err) { db.close(); return reject(err); }
        if (!product) { db.close(); return resolve(null); }
        const next = {
          name: data.name ?? product.name,
          description: data.description ?? product.description,
          category: data.category ?? product.category,
          main_category: data.main_category ?? product.main_category,
          sub_category: data.sub_category ?? product.sub_category ?? product.category,
          price: data.price ?? product.price,
          image_url: data.image_url ?? product.image_url,
          stock: data.stock ?? product.stock,
          brand: data.brand ?? product.brand,
          warranty_months: data.warranty_months ?? product.warranty_months,
          is_featured: data.is_featured ?? product.is_featured
        };
        db.run('UPDATE products SET name=?, description=?, category=?, main_category=?, sub_category=?, price=?, image_url=?, stock=?, brand=?, warranty_months=?, is_featured=? WHERE id=?', [
          next.name,
          next.description,
          next.sub_category,
          next.main_category,
          next.sub_category,
          Number(next.price),
          next.image_url,
          Number(next.stock),
          next.brand,
          Number(next.warranty_months),
          Number(next.is_featured ? 1 : 0),
          id
        ], function (err2) {
          if (err2) { db.close(); return reject(err2); }
          db.get('SELECT * FROM products WHERE id = ?', [id], (err3, row) => { db.close(); if (err3) return reject(err3); resolve(row); });
        });
      });
    });
  }

  deleteProduct(id) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.run('DELETE FROM products WHERE id = ?', [id], function (err) { db.close(); if (err) return reject(err); resolve(true); });
    });
  }

  getById(id) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => { db.close(); if (err) return reject(err); resolve(row || null); });
    });
  }

  allRaw(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.all(sql, params, (err, rows) => { db.close(); if (err) return reject(err); resolve(rows || []); });
    });
  }

  getRaw(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.get(sql, params, (err, row) => { db.close(); if (err) return reject(err); resolve(row || null); });
    });
  }

  runRaw(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.run(sql, params, function (err) { db.close(); if (err) return reject(err); resolve(this); });
    });
  }

  getAdminReviews() {
    return this.allRaw(`SELECT r.id, r.product_id, r.user_id, r.user_name, r.rating, r.comment, r.order_id, r.created_at,
              p.name AS product_name, p.image_url AS product_image_url
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC`);
  }

  getUserReviews(userId) {
    return this.allRaw('SELECT id, product_id, user_id, user_name, rating, comment, order_id, created_at FROM reviews WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  getReviewsByProduct(productId) {
    return this.allRaw('SELECT id, product_id, user_id, user_name, rating, comment, order_id, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [productId]);
  }

  createReview(productId, data) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.run('INSERT INTO reviews (product_id, user_id, user_name, rating, comment, order_id) VALUES (?, ?, ?, ?, ?, ?)', [productId, Number(data.user_id), String(data.user_name), Number(data.rating), String(data.comment), Number(data.order_id)], function (err) {
        if (err) { db.close(); return reject(err); }
        db.get('SELECT AVG(rating) AS avg_rating FROM reviews WHERE product_id = ?', [productId], (err2, summary) => {
          if (err2) { db.close(); return reject(err2); }
          db.run('UPDATE products SET rating = ? WHERE id = ?', [Number(summary?.avg_rating || 4).toFixed(1), productId], (err3) => {
            db.close(); if (err3) return reject(err3); resolve(true);
          });
        });
      });
    });
  }

  deleteReview(reviewId) {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.get('SELECT * FROM reviews WHERE id = ?', [reviewId], (err, review) => {
        if (err) { db.close(); return reject(err); }
        if (!review) { db.close(); return resolve(null); }
        db.run('DELETE FROM reviews WHERE id = ?', [reviewId], function (err2) {
          if (err2) { db.close(); return reject(err2); }
          db.get('SELECT AVG(rating) AS avg_rating FROM reviews WHERE product_id = ?', [review.product_id], (err3, summary) => {
            if (err3) { db.close(); return reject(err3); }
            db.run('UPDATE products SET rating = ? WHERE id = ?', [summary?.avg_rating ? Number(summary.avg_rating).toFixed(1) : 4.0, review.product_id], (err4) => {
              db.close(); if (err4) return reject(err4); resolve(true);
            });
          });
        });
      });
    });
  }

  initDb() {
    return new Promise((resolve, reject) => {
      const db = this._open();
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'accessory',
    main_category TEXT DEFAULT 'electronics',
    sub_category TEXT DEFAULT 'accessory',
    price REAL DEFAULT 0,
    image_url TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    rating REAL DEFAULT 4.0,
    is_featured INTEGER DEFAULT 0,
    brand TEXT DEFAULT '',
    warranty_months INTEGER DEFAULT 12
  )`, [], (err) => { if (err) return reject(err); });

        db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    order_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`, [], (err2) => { if (err2) return reject(err2); });

        db.close();
        resolve(true);
      });
    });
  }
}

module.exports = SqliteProductRepository;
