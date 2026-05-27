let service = new (require('../../application/productService'))();

exports.setService = (nextService) => {
  service = nextService;
};

exports.getByIds = async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) return res.json([]);
    const products = await service.getByIds(ids);
    res.json(products);
  } catch (e) {
    res.status(500).json({ message: 'Query failed', error: e.message });
  }
};

exports.list = async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      mainCategory: req.query.mainCategory || req.query.main_category,
      subCategory: req.query.subCategory || req.query.sub_category || req.query.category,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      search: req.query.search
    };
    const products = await service.list(filters);
    res.json(products);
  } catch (e) { res.status(500).json({ message: 'Query failed', error: e.message }); }
};

exports.getFeatured = async (req, res) => {
  try { res.json(await service.getFeatured(12)); }
  catch (e) { res.status(500).json({ message: 'Query failed', error: e.message }); }
};

exports.decreaseInventory = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'Missing items' });
    const result = await service.decreaseInventory(items);
    if (!result || !result.ok) return res.status(400).json({ message: result.message || 'Cannot decrease inventory' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Cannot decrease inventory', error: e.message }); }
};

exports.adminList = async (req, res) => {
  try { res.json(await service.adminList()); }
  catch (e) { res.status(500).json({ message: 'Query failed', error: e.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !Number.isFinite(Number(body.price))) return res.status(400).json({ message: 'Missing required product fields' });
    const created = await service.createProduct(body);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: 'Create product failed', error: e.message }); }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await service.updateProduct(id, req.body || {});
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: 'Update product failed', error: e.message }); }
};

exports.deleteProduct = async (req, res) => {
  try { await service.deleteProduct(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ message: 'Delete product failed', error: e.message }); }
};

exports.getById = async (req, res) => {
  try {
    const product = await service.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const reviews = await service.getReviewsByProduct(req.params.id);
    const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
    const avgRating = reviewCount
      ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount)
      : Number(product.rating || 0);

    res.json({
      ...product,
      basic_info: {
        category: product.sub_category,
        main_category: product.main_category,
        stock: product.stock,
        brand: product.brand,
        warranty_months: product.warranty_months
      },
      review_count: reviewCount,
      avg_rating: Number(avgRating || 0).toFixed(1)
    });
  } catch (e) { res.status(500).json({ message: 'Query failed', error: e.message }); }
};

exports.getAdminReviews = async (req, res) => {
  try { res.json(await service.getAdminReviews()); }
  catch (e) { res.status(500).json({ message: 'Cannot load admin reviews', error: e.message }); }
};

exports.getUserReviews = async (req, res) => {
  try {
    const userId = Number(req.params.uid);
    if (!userId) return res.status(400).json({ message: 'Invalid user id' });
    res.json(await service.getUserReviews(userId));
  } catch (e) { res.status(500).json({ message: 'Cannot load user reviews', error: e.message }); }
};

exports.getReviewsByProduct = async (req, res) => {
  try { res.json(await service.getReviewsByProduct(req.params.id)); }
  catch (e) { res.status(500).json({ message: 'Cannot load reviews', error: e.message }); }
};

exports.createReview = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { user_id, user_name, rating, comment, order_id } = req.body;
    if (!user_id || !user_name || !rating || !comment || !order_id) return res.status(400).json({ message: 'Missing review fields or completed order_id' });
    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) return res.status(400).json({ message: 'Rating must be 1..5' });
    await service.createReview(productId, { user_id, user_name, rating: numericRating, comment, order_id });
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Create review failed', error: e.message }); }
};

exports.deleteReview = async (req, res) => {
  try {
    const deleted = await service.deleteReview(req.params.reviewId);
    if (!deleted) return res.status(404).json({ message: 'Review not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: 'Delete review failed', error: e.message }); }
};

exports.uploadProductImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Missing image file' });
    const imageUrl = `${req.publicBaseUrl || ''}/uploads/products/${req.file.filename}`;
    const updated = await service.updateProduct(req.params.id, { image_url: imageUrl });
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.json({ ok: true, image_url: imageUrl });
  } catch (e) {
    res.status(500).json({ message: 'Upload image failed', error: e.message });
  }
};
