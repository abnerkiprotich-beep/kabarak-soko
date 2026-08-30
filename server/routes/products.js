const express = require('express');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    return next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
}

// GET all products - public
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let filter = {};

    if (category && category.trim()) {
      filter.category = { $regex: category.trim(), $options: 'i' };
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { seller: searchRegex }
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to read products',
      error: error.message
    });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('GET /api/products/:id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to read product',
      error: error.message
    });
  }
});

// POST create product - admin only - NOW SAVES TO MONGODB ATLAS
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      price,
      oldPrice,
      category,
      description,
      images,
      stock,
      rating,
      reviews,
      seller
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (price === undefined || price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Valid non-negative product price is required' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ success: false, message: 'Product category is required' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'Product description is required' });
    }
    if (!seller || !String(seller).trim()) {
      return res.status(400).json({ success: false, message: 'Seller is required' });
    }

    const product = await Product.create({
      name: String(name).trim(),
      price: Number(price),
      oldPrice: oldPrice === undefined || oldPrice === null || oldPrice === '' ? null : Number(oldPrice),
      category: String(category).trim(),
      description: String(description).trim(),
      images: Array.isArray(images) ? images : [],
      stock: stock === undefined || stock === null || stock === '' ? 0 : Number(stock),
      rating: rating === undefined || rating === null || rating === '' ? 0 : Number(rating),
      reviews: reviews === undefined || reviews === null || reviews === '' ? 0 : Number(reviews),
      seller: String(seller).trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
});

module.exports = router;