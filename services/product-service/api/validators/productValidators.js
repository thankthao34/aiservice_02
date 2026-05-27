const { body, query, validationResult } = require('express-validator');

const createProduct = [
  body('name').isString().notEmpty().withMessage('name is required'),
  body('price').isFloat({ gt: 0 }).withMessage('price must be a number > 0'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    return next();
  }
];

const updateProduct = [
  body('price').optional().isFloat({ gt: 0 }).withMessage('price must be a number > 0'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    return next();
  }
];

const decreaseInventory = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.product_id').isInt({ gt: 0 }).withMessage('product_id must be integer'),
  body('items.*.quantity').isInt({ gt: 0 }).withMessage('quantity must be integer > 0'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    return next();
  }
];

module.exports = {
  createProduct,
  updateProduct,
  decreaseInventory
};
