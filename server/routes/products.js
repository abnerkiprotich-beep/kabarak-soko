const express = require('express');
const router = express.Router();

const Product = require('../models/Product');
const User = require('../models/User');
const Store = require('../models/Store'); // <-- added for store verification
const auth = require('../middleware/auth');

// =====================================================
// GET ALL PRODUCTS (PUBLIC - ONLY APPROVED)
// =====================================================
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;

    let filter = { isApproved: true }; // <-- ONLY SHOW APPROVED PRODUCTS

    if (category) {
      filter.category = {
        $regex: new RegExp(category, 'i')
      };
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: new RegExp(search, 'i')
          }
        },
        {
          description: {
            $regex: new RegExp(search, 'i')
          }
        },
        {
          category: {
            $regex: new RegExp(search, 'i')
          }
        }
      ];
    }

    const products = await Product.find(filter)
      .populate('store', 'name slug logo')
      .populate('sellerId', 'name email');

    res.json(products);

  } catch (error) {
    console.error('Fetch products error:', error);

    res.status(500).json({
      message: 'Unable to fetch products'
    });
  }
});

// =====================================================
// GET SINGLE PRODUCT
// =====================================================
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('store', 'name slug logo')
      .populate('sellerId', 'name email');

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    // Only return if approved (or if admin/seller is viewing their own)
    if (!product.isApproved) {
      // Check if user is authenticated and owns this product or is admin
      const token = req.headers.authorization?.split(' ')[1];
      let isAuthorized = false;

      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.id);
          if (user && (user.isAdmin || user._id.toString() === product.sellerId.toString())) {
            isAuthorized = true;
          }
        } catch (e) {
          // Token invalid – ignore
        }
      }

      if (!isAuthorized) {
        return res.status(404).json({
          message: 'Product not found'
        });
      }
    }

    res.json(product);

  } catch (error) {
    console.error('Fetch product error:', error);

    res.status(500).json({
      message: 'Unable to fetch product'
    });
  }
});

// =====================================================
// GET SELLER'S OWN PRODUCTS
// =====================================================
router.get('/my-products', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({
        message: 'Only verified sellers can view their products.'
      });
    }

    const products = await Product.find({ sellerId: user._id })
      .populate('store', 'name slug logo')
      .sort({ createdAt: -1 });

    res.json({
      products
    });

  } catch (error) {
    console.error('Get my products error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// CREATE PRODUCT
// ONLY AUTHENTICATED SELLERS WITH A STORE
// =====================================================
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({
        message: 'Only verified sellers can add products.'
      });
    }

    // Verify store is active and verified
    const store = await Store.findById(user.storeId);
    if (!store || !store.isActive || !store.isVerified) {
      return res.status(403).json({
        message: 'Your store is not active or verified. Please contact admin.'
      });
    }

    const productData = {
      ...req.body,
      store: user.storeId,
      sellerId: user._id,
      isApproved: false // <-- NEW: requires admin approval
    };

    const product = new Product(productData);

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully. Awaiting admin approval.',
      product
    });

  } catch (error) {
    console.error('Create product error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// UPDATE PRODUCT (SELLER ONLY)
// =====================================================
router.put('/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({
        message: 'Only sellers can update products.'
      });
    }

    const product = await Product.findOne({
      _id: productId,
      sellerId: user._id
    });

    if (!product) {
      return res.status(404).json({
        message: 'Product not found or you do not own it.'
      });
    }

    // Apply updates (exclude protected fields)
    const updates = req.body;
    const protectedFields = ['_id', '__v', 'sellerId', 'store', 'createdAt'];

    Object.keys(updates).forEach(key => {
      if (!protectedFields.includes(key)) {
        product[key] = updates[key];
      }
    });

    // If product was approved, un-approve it so admin must re-approve changes
    if (product.isApproved) {
      product.isApproved = false;
      product.approvedAt = null;
      product.approvedBy = null;
    }

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully. Awaiting admin re-approval.',
      product
    });

  } catch (error) {
    console.error('Update product error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// DELETE PRODUCT (SELLER ONLY)
// =====================================================
router.delete('/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({
        message: 'Only sellers can delete products.'
      });
    }

    const product = await Product.findOneAndDelete({
      _id: productId,
      sellerId: user._id
    });

    if (!product) {
      return res.status(404).json({
        message: 'Product not found or you do not own it.'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully.'
    });

  } catch (error) {
    console.error('Delete product error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// ADMIN: GET PENDING PRODUCTS
// =====================================================
router.get('/admin/pending', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        message: 'Admin access required.'
      });
    }

    const products = await Product.find({ isApproved: false })
      .populate('store', 'name slug logo')
      .populate('sellerId', 'name email')
      .sort({ createdAt: 1 });

    res.json({
      products
    });

  } catch (error) {
    console.error('Get pending products error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// ADMIN: APPROVE OR REJECT PRODUCT
// =====================================================
router.put('/admin/:productId/approve', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { isApproved } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        message: 'Admin access required.'
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found.'
      });
    }

    product.isApproved = isApproved;
    product.approvedAt = isApproved ? new Date() : null;
    product.approvedBy = isApproved ? user._id : null;

    await product.save();

    res.json({
      success: true,
      message: `Product ${isApproved ? 'approved' : 'rejected'}.`,
      product
    });

  } catch (error) {
    console.error('Approve product error:', error);

    res.status(500).json({
      message: 'Server error.'
    });
  }
});

// =====================================================
// EXPORT ROUTER
// =====================================================
module.exports = router;