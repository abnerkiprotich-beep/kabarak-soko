const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Orders');

// All admin routes require admin authentication
router.use(adminAuth);

// ===================== DASHBOARD STATS =====================

router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Calculate total revenue from delivered orders
    const deliveredOrders = await Order.find({ status: 'delivered' });
    const totalRevenue = deliveredOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent orders (last 5)
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email');

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      ordersByStatus,
      recentOrders
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);

    res.status(500).json({
      message: 'Unable to fetch dashboard stats'
    });
  }
});

// ===================== PRODUCT MANAGEMENT =====================

// Get all products (with optional search)
router.get('/products', async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        {
          name: {
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

    const products = await Product
      .find(filter)
      .sort({ createdAt: -1 });

    res.json({
      products
    });
  } catch (error) {
    console.error('Fetch products error:', error);

    res.status(500).json({
      message: 'Unable to fetch products'
    });
  }
});

// Create new product
router.post('/products', async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      oldPrice,
      category,
      images,
      stock,
      rating,
      reviews
    } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({
        message: 'Name, price and category are required'
      });
    }

    const product = new Product({
      name,
      description: description || '',
      price: Number(price),
      oldPrice: oldPrice ? Number(oldPrice) : null,
      category,
      images: images || [],
      stock: Number(stock) || 0,
      rating: Number(rating) || 0,
      reviews: Number(reviews) || 0
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);

    res.status(500).json({
      message: 'Unable to create product'
    });
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    // Update only provided fields
    Object.keys(updates).forEach(key => {
      if (
        updates[key] !== undefined &&
        key !== '_id' &&
        key !== '__v'
      ) {
        product[key] = updates[key];
      }
    });

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);

    res.status(500).json({
      message: 'Unable to update product'
    });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);

    res.status(500).json({
      message: 'Unable to delete product'
    });
  }
});

// ===================== ORDER MANAGEMENT =====================

// Get all orders (with optional filter)
router.get('/orders', async (req, res) => {
  try {
    const { status, limit } = req.query;

    let filter = {};

    if (status) {
      filter.status = status;
    }

    let query = Order
      .find(filter)
      .sort({ createdAt: -1 });

    if (limit) {
      query = query.limit(Number(limit));
    }

    const orders = await query.populate(
      'userId',
      'name email'
    );

    res.json({
      orders
    });
  } catch (error) {
    console.error('Fetch orders error:', error);

    res.status(500).json({
      message: 'Unable to fetch orders'
    });
  }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'pending',
      'confirmed',
      'processing',
      'paid',
      'shipped',
      'delivered',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status'
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    order.status = status;

    // Update timeline
    const statusOrder = [
      'pending',
      'confirmed',
      'processing',
      'paid',
      'shipped',
      'delivered',
      'cancelled'
    ];

    const currentIndex = statusOrder.indexOf(status);

    // Reset timeline completion flags
    order.statusTimeline.forEach((step, idx) => {
      if (idx < currentIndex) {
        step.completed = true;
      }

      if (idx === currentIndex) {
        step.current = true;
      }

      if (idx > currentIndex) {
        step.current = false;
      }
    });

    // Add note to timeline if cancelled
    if (status === 'cancelled') {
      order.statusTimeline.push({
        label: 'Cancelled',
        description: 'This order has been cancelled.',
        completed: true,
        current: true
      });
    }

    order.updatedAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);

    res.status(500).json({
      message: 'Unable to update order'
    });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order
      .findById(id)
      .populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    res.json({
      order
    });
  } catch (error) {
    console.error('Fetch order error:', error);

    res.status(500).json({
      message: 'Unable to fetch order'
    });
  }
});

// ===================== USER MANAGEMENT =====================

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User
      .find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      users
    });
  } catch (error) {
    console.error('Fetch users error:', error);

    res.status(500).json({
      message: 'Unable to fetch users'
    });
  }
});

// Promote/demote user admin status
router.put('/users/:id/admin', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;

    // Prevent self-demotion
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        message: 'You cannot change your own admin status'
      });
    }

    const user = await User
      .findById(id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    user.isAdmin = isAdmin;

    await user.save();

    res.json({
      success: true,
      message: `User ${isAdmin ? 'promoted to' : 'demoted from'} admin successfully`,
      user
    });
  } catch (error) {
    console.error('Update user admin error:', error);

    res.status(500).json({
      message: 'Unable to update user'
    });
  }
});

// ===================== EXPORT ROUTER =====================

module.exports = router;