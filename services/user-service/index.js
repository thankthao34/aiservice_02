const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_super_secret_2024';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./db/users.db');

function normalizeCartItem(raw, options = {}) {
  const productId = Number(raw?.product_id ?? raw?.id);
  if (!Number.isFinite(productId)) return null;

  const rawQuantity = Number(raw?.quantity ?? 1);
  const quantity = options.allowZeroQuantity ? Math.max(0, rawQuantity) : Math.max(1, rawQuantity || 1);
  return {
    product_id: productId,
    quantity,
    product_name: String(raw?.product_name || raw?.name || `Product ${productId}`),
    product_price: Number(raw?.product_price ?? raw?.price ?? 0) || 0,
    product_image: String(raw?.product_image || raw?.image_url || ''),
    product_category: String(raw?.product_category || raw?.category || ''),
    product_subcategory: String(raw?.product_subcategory || raw?.sub_category || '')
  };
}

function mergeCartItems(items) {
  const map = new Map();

  for (const raw of items || []) {
    const item = normalizeCartItem(raw);
    if (!item) continue;
    const current = map.get(item.product_id);
    if (!current) {
      map.set(item.product_id, item);
      continue;
    }

    map.set(item.product_id, {
      ...current,
      quantity: current.quantity + item.quantity,
      product_name: item.product_name || current.product_name,
      product_price: item.product_price || current.product_price,
      product_image: item.product_image || current.product_image,
      product_category: item.product_category || current.product_category,
      product_subcategory: item.product_subcategory || current.product_subcategory
    });
  }

  return Array.from(map.values());
}

async function getCartItems(userId) {
  return all(
    `SELECT *
     FROM cart_items
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [userId]
  );
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });
}

async function ensureColumn(table, column, definition) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      return resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      return resolve(rows);
    });
  });
}

function isAdmin(req) {
  return String(req.headers['x-user-role'] || '').toLowerCase() === 'admin';
}

function ensureAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Admin role required' });
  }
  return next();
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aieco.local';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  const exists = await get('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);
  if (exists) return;

  const hash = await bcrypt.hash(adminPass, 10);
  await run(
    'INSERT INTO users (name, email, password, role, segment) VALUES (?, ?, ?, ?, ?)',
    ['System Admin', adminEmail, hash, 'admin', 'premium_user']
  );
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    total_spent REAL DEFAULT 0,
    avg_price REAL DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    fav_category TEXT DEFAULT 'accessory',
    segment TEXT DEFAULT 'normal_user',
    segment_score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await ensureColumn('users', 'role', "TEXT DEFAULT 'customer'");
  await ensureColumn('users', 'total_spent', 'REAL DEFAULT 0');
  await ensureColumn('users', 'avg_price', 'REAL DEFAULT 0');
  await ensureColumn('users', 'purchase_count', 'INTEGER DEFAULT 0');
  await ensureColumn('users', 'fav_category', "TEXT DEFAULT 'accessory'");
  await ensureColumn('users', 'segment', "TEXT DEFAULT 'normal_user'");
  await ensureColumn('users', 'segment_score', 'REAL DEFAULT 0');
  await ensureColumn('users', 'created_at', "TEXT DEFAULT (datetime('now'))");

  await run(`CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    receiver_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    line1 TEXT NOT NULL,
    ward TEXT,
    district TEXT,
    city TEXT NOT NULL,
    note TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await ensureColumn('addresses', 'ward', 'TEXT');
  await ensureColumn('addresses', 'district', 'TEXT');
  await ensureColumn('addresses', 'note', 'TEXT');
  await ensureColumn('addresses', 'is_default', 'INTEGER DEFAULT 0');

  await run(`CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT DEFAULT 'Unknown Product',
    product_price REAL DEFAULT 0,
    product_image TEXT DEFAULT '',
    product_category TEXT DEFAULT '',
    product_subcategory TEXT DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id)
  )`);

  await ensureColumn('cart_items', 'product_name', "TEXT DEFAULT 'Unknown Product'");
  await ensureColumn('cart_items', 'product_price', 'REAL DEFAULT 0');
  await ensureColumn('cart_items', 'product_image', "TEXT DEFAULT ''");
  await ensureColumn('cart_items', 'product_category', "TEXT DEFAULT ''");
  await ensureColumn('cart_items', 'product_subcategory', "TEXT DEFAULT ''");
  await ensureColumn('cart_items', 'quantity', 'INTEGER DEFAULT 1');
  await ensureColumn('cart_items', 'created_at', "TEXT DEFAULT (datetime('now'))");
  await ensureColumn('cart_items', 'updated_at', "TEXT DEFAULT (datetime('now'))");

  await seedAdmin();
}

app.get('/health', (_, res) => res.json({ ok: true, service: 'user-service' }));

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing name/email/password' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'customer']
    );

    return res.status(201).json({ id: result.lastID, name, email, role: 'customer' });
  } catch {
    return res.status(400).json({ message: 'Email already exists' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email/password' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    return res.status(500).json({ message: 'Login failed', error: e.message });
  }
});

app.get('/profile/:id', async (req, res) => {
  try {
    const user = await get(
      `SELECT id, name, email, role, total_spent, avg_price, purchase_count, fav_category, segment, segment_score, created_at
       FROM users
       WHERE id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ message: 'Query failed', error: e.message });
  }
});

app.put('/update/:id', async (req, res) => {
  try {
    const fields = [
      'name',
      'total_spent',
      'avg_price',
      'purchase_count',
      'fav_category',
      'segment',
      'segment_score'
    ];

    const updates = [];
    const values = [];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    if (!result.changes) return res.status(404).json({ message: 'User not found' });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Update failed', error: e.message });
  }
});

app.get('/addresses/:userId', async (req, res) => {
  try {
    const rows = await all(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.params.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Cannot load addresses', error: e.message });
  }
});

app.post('/addresses/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { receiver_name, phone, line1, ward, district, city, note, is_default } = req.body;

    if (!receiver_name || !phone || !line1 || !city) {
      return res.status(400).json({ message: 'Missing required address fields' });
    }

    const existing = await all('SELECT * FROM addresses WHERE user_id = ?', [userId]);
    const shouldDefault = is_default || !existing.length;

    if (shouldDefault) {
      await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const result = await run(
      `INSERT INTO addresses (user_id, receiver_name, phone, line1, ward, district, city, note, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        receiver_name,
        phone,
        line1,
        ward || '',
        district || '',
        city,
        note || '',
        shouldDefault ? 1 : 0
      ]
    );

    const row = await get('SELECT * FROM addresses WHERE id = ?', [result.lastID]);
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Create address failed', error: e.message });
  }
});

app.put('/addresses/:userId/:addressId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const addressId = Number(req.params.addressId);

    const current = await get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
    if (!current) return res.status(404).json({ message: 'Address not found' });

    const next = {
      receiver_name: req.body.receiver_name ?? current.receiver_name,
      phone: req.body.phone ?? current.phone,
      line1: req.body.line1 ?? current.line1,
      ward: req.body.ward ?? current.ward,
      district: req.body.district ?? current.district,
      city: req.body.city ?? current.city,
      note: req.body.note ?? current.note,
      is_default: req.body.is_default ?? current.is_default
    };

    if (Number(next.is_default) === 1) {
      await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    await run(
      `UPDATE addresses
       SET receiver_name = ?, phone = ?, line1 = ?, ward = ?, district = ?, city = ?, note = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        next.receiver_name,
        next.phone,
        next.line1,
        next.ward,
        next.district,
        next.city,
        next.note,
        Number(next.is_default ? 1 : 0),
        addressId,
        userId
      ]
    );

    const row = await get('SELECT * FROM addresses WHERE id = ?', [addressId]);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Update address failed', error: e.message });
  }
});

app.patch('/addresses/:userId/:addressId/default', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const addressId = Number(req.params.addressId);

    await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    const result = await run('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, userId]);

    if (!result.changes) return res.status(404).json({ message: 'Address not found' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot set default address', error: e.message });
  }
});

app.delete('/addresses/:userId/:addressId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const addressId = Number(req.params.addressId);
    const row = await get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
    if (!row) return res.status(404).json({ message: 'Address not found' });

    await run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);

    if (row.is_default) {
      const first = await get('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
      if (first) {
        await run('UPDATE addresses SET is_default = 1 WHERE id = ?', [first.id]);
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Delete address failed', error: e.message });
  }
});

app.get('/admin/users', ensureAdmin, async (_, res) => {
  try {
    const rows = await all(
      `SELECT id, name, email, role, total_spent, purchase_count, segment, created_at
       FROM users
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Cannot load users', error: e.message });
  }
});

app.post('/admin/users', ensureAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing name/email/password' });
    }

    const hash = await bcrypt.hash(password, 10);
    const nextRole = role === 'admin' ? 'admin' : 'customer';
    const result = await run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, nextRole]
    );

    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ message: 'Cannot create user', error: e.message });
  }
});

app.put('/admin/users/:id', ensureAdmin, async (req, res) => {
  try {
    const current = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ message: 'User not found' });

    const nextRole = req.body.role === 'admin' ? 'admin' : 'customer';
    await run('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [
      req.body.name ?? current.name,
      req.body.email ?? current.email,
      nextRole,
      req.params.id
    ]);

    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, 10);
      await run('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
    }

    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: 'Cannot update user', error: e.message });
  }
});

app.delete('/admin/users/:id', ensureAdmin, async (req, res) => {
  try {
    const result = await run('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'admin']);
    if (!result.changes) return res.status(400).json({ message: 'Cannot delete user' });
    await run('DELETE FROM addresses WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM cart_items WHERE user_id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot delete user', error: e.message });
  }
});

app.get('/cart/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'Invalid user_id' });
    }

    const rows = await getCartItems(userId);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot load cart', error: e.message });
  }
});

app.put('/cart/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const items = mergeCartItems(req.body.items || []);

    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'Invalid user_id' });
    }

    await run('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    for (const item of items) {
      await run(
        `INSERT INTO cart_items (
          user_id, product_id, product_name, product_price, product_image, product_category, product_subcategory, quantity, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          userId,
          item.product_id,
          item.product_name,
          item.product_price,
          item.product_image,
          item.product_category,
          item.product_subcategory,
          item.quantity
        ]
      );
    }

    const rows = await getCartItems(userId);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot sync cart', error: e.message });
  }
});

app.post('/cart/:userId/items', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const item = normalizeCartItem(req.body);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'Invalid user_id' });
    }
    if (!item) {
      return res.status(400).json({ message: 'Missing product_id' });
    }

    const current = await get('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, item.product_id]);
    const nextQuantity = Number(current?.quantity || 0) + item.quantity;

    await run(
      `INSERT INTO cart_items (
        user_id, product_id, product_name, product_price, product_image, product_category, product_subcategory, quantity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM cart_items WHERE user_id = ? AND product_id = ?), datetime('now')), datetime('now'))
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        product_name = excluded.product_name,
        product_price = excluded.product_price,
        product_image = excluded.product_image,
        product_category = excluded.product_category,
        product_subcategory = excluded.product_subcategory,
        quantity = excluded.quantity,
        updated_at = datetime('now')`,
      [
        userId,
        item.product_id,
        item.product_name,
        item.product_price,
        item.product_image,
        item.product_category,
        item.product_subcategory,
        nextQuantity,
        userId,
        item.product_id
      ]
    );

    const row = await get('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, item.product_id]);
    return res.status(current ? 200 : 201).json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot add cart item', error: e.message });
  }
});

app.put('/cart/:userId/items/:productId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const productId = Number(req.params.productId);
    const item = normalizeCartItem({ ...req.body, product_id: productId }, { allowZeroQuantity: true });

    if (!Number.isFinite(userId) || !Number.isFinite(productId)) {
      return res.status(400).json({ message: 'Invalid identifiers' });
    }

    if (!item) {
      return res.status(400).json({ message: 'Missing product_id' });
    }

    if (item.quantity <= 0) {
      await run('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
      return res.json({ ok: true, deleted: true });
    }

    await run(
      `INSERT INTO cart_items (
        user_id, product_id, product_name, product_price, product_image, product_category, product_subcategory, quantity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM cart_items WHERE user_id = ? AND product_id = ?), datetime('now')), datetime('now'))
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        product_name = excluded.product_name,
        product_price = excluded.product_price,
        product_image = excluded.product_image,
        product_category = excluded.product_category,
        product_subcategory = excluded.product_subcategory,
        quantity = excluded.quantity,
        updated_at = datetime('now')`,
      [
        userId,
        productId,
        item.product_name,
        item.product_price,
        item.product_image,
        item.product_category,
        item.product_subcategory,
        item.quantity,
        userId,
        productId
      ]
    );

    const row = await get('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ message: 'Cannot update cart item', error: e.message });
  }
});

app.delete('/cart/:userId/items/:productId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const productId = Number(req.params.productId);
    if (!Number.isFinite(userId) || !Number.isFinite(productId)) {
      return res.status(400).json({ message: 'Invalid identifiers' });
    }

    const result = await run('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
    if (!result.changes) return res.status(404).json({ message: 'Cart item not found' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot delete cart item', error: e.message });
  }
});

app.delete('/cart/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'Invalid user_id' });
    }

    await run('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Cannot clear cart', error: e.message });
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`User service running on ${port}`);
    });
  })
  .catch((error) => {
    console.error('User service init failed', error);
    process.exit(1);
  });