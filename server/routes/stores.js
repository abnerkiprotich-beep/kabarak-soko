const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const User = require('../models/User');
const Product = require('../models/Product');

// ========================================
// REGISTER A NEW STORE
// ========================================
router.post('/register', auth, async (req, res) => {
  try {
    const { name, description, email, phone, address } = req.body;
    const userId = req.user._id;

    // Check if user already has a store
    const existingStore = await Store.findOne({ owner: userId });
    if (existingStore) {
      return res.status(400).json({ message: 'You already have a store.' });
    }

    // Check if store name is taken
    const nameTaken = await Store.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (nameTaken) {
      return res.status(400).json({ message: 'Store name is already taken.' });
    }

    // Create store
    const store = new Store({
      name,
      description: description || '',
      email,
      phone: phone || '',
      address: address || '',
      owner: userId,
      isActive: true,
      isVerified: false
    });

    await store.save();

    // Update user role and storeId
    await User.findByIdAndUpdate(userId, {
      role: 'seller',
      storeId: store._id
    });

    res.status(201).json({
      success: true,
      message: 'Store registered successfully! Please wait for admin verification.',
      store
    });
  } catch (error) {
    console.error('Store registration error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// GET STORE BY ID OR SLUG
// ========================================
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let store;

    // Check if identifier is a valid ObjectId or slug
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      store = await Store.findById(identifier).populate('owner', 'name email');
    } else {
      store = await Store.findOne({ slug: identifier }).populate('owner', 'name email');
    }

    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    res.json({ store });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// GET MY STORE (for logged-in seller)
// ========================================
router.get('/my/store', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(404).json({ message: 'You do not have a store.' });
    }

    const store = await Store.findById(user.storeId).populate('owner', 'name email');
    res.json({ store });
  } catch (error) {
    console.error('Get my store error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// UPDATE STORE INFO
// ========================================
router.put('/my/store', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    const { name, description, logo, banner, phone, address } = req.body;
    const store = await Store.findById(user.storeId);

    if (name && name !== store.name) {
      const nameTaken = await Store.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, _id: { $ne: store._id } });
      if (nameTaken) {
        return res.status(400).json({ message: 'Store name is already taken.' });
      }
      store.name = name;
    }

    if (description !== undefined) store.description = description;
    if (logo !== undefined) store.logo = logo;
    if (banner !== undefined) store.banner = banner;
    if (phone !== undefined) store.phone = phone;
    if (address !== undefined) store.address = address;

    store.updatedAt = new Date();
    await store.save();

    res.json({ success: true, message: 'Store updated successfully.', store });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// GET ALL STORES (public)
// ========================================
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true, isVerified: true })
      .populate('owner', 'name email')
      .sort({ totalSales: -1 });
    res.json({ stores });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// GET STORE PRODUCTS
// ========================================
router.get('/:storeId/products', async (req, res) => {
  try {
    const { storeId } = req.params;
    const products = await Product.find({ store: storeId, stock: { $gt: 0 } })
      .sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    console.error('Get store products error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// ADMIN: GET ALL STORES (including unverified)
// ========================================
router.get('/admin/all', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const stores = await Store.find().populate('owner', 'name email').sort({ createdAt: -1 });
    res.json({ stores });
  } catch (error) {
    console.error('Admin get stores error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// ADMIN: VERIFY STORE
// ========================================
router.put('/admin/:storeId/verify', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { storeId } = req.params;
    const { isVerified } = req.body;

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    store.isVerified = isVerified;
    store.updatedAt = new Date();
    await store.save();

    res.json({ success: true, message: `Store ${isVerified ? 'verified' : 'unverified'}.`, store });
  } catch (error) {
    console.error('Verify store error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// ADMIN: ACTIVATE/DEACTIVATE STORE
// ========================================
router.put('/admin/:storeId/activate', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { storeId } = req.params;
    const { isActive } = req.body;

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    store.isActive = isActive;
    store.updatedAt = new Date();
    await store.save();

    res.json({ success: true, message: `Store ${isActive ? 'activated' : 'deactivated'}.`, store });
  } catch (error) {
    console.error('Activate store error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});
// ========================================
// SELLER: GET STORE ANALYTICS
// ========================================
router.get('/my/analytics', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({ message: 'Seller access required.' });
    }

    const store = await Store.findById(user.storeId);

    // Get total products
    const totalProducts = await Product.countDocuments({ sellerId: userId });

    // Get approved products
    const approvedProducts = await Product.countDocuments({ sellerId: userId, isApproved: true });

    // Get orders
    const totalOrders = await Order.countDocuments({ storeId: user.storeId });

    // Get delivered orders total
    const deliveredOrders = await Order.find({ storeId: user.storeId, status: 'delivered' });
    const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + o.sellerEarnings, 0);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: { storeId: user.storeId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Recent orders (last 5)
    const recentOrders = await Order.find({ storeId: user.storeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email');

    res.json({
      store,
      analytics: {
        totalProducts,
        approvedProducts,
        totalOrders,
        deliveredRevenue,
        totalEarnings: store.totalEarnings || 0,
        pendingEarnings: store.pendingEarnings || 0,
        ordersByStatus,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get store analytics error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;