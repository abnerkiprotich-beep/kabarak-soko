const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth');

const Order = require('../models/Orders');

router.use(auth);

function buildTimeline(status) {
  const base = [
    {
      label: 'Order Placed',
      description: 'Your order has been received.',
      completed: true,
      current: true
    },
    {
      label: 'Processing',
      description: 'Your order is being prepared.',
      completed: false,
      current: false
    },
    {
      label: 'Shipped',
      description: 'Your order is on its way.',
      completed: false,
      current: false
    },
    {
      label: 'Delivered',
      description: 'Your order has been delivered.',
      completed: false,
      current: false
    }
  ];

  if (status === 'confirmed') {
    base[0].label = 'Order Confirmed';
    base[0].description = 'Your order has been confirmed.';
  }

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

  if (currentIndex !== -1) {
    base.forEach((step, idx) => {
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
  }

  return base;
}

// ========================================
// PLACE NEW ORDER
// ========================================

router.post('/', async (req, res) => {
  try {
    let {
      items,
      total,
      deliveryAddress,
      paymentMethod
    } = req.body;

    const userId = req.user._id;

    if (paymentMethod === 'cod') {
      paymentMethod = 'cash_on_delivery';
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Cart cannot be empty.'
      });
    }

    if (
      !deliveryAddress ||
      !deliveryAddress.name ||
      !deliveryAddress.phone
    ) {
      return res.status(400).json({
        message: 'Delivery address is incomplete.'
      });
    }

    let status = 'pending';

    if (paymentMethod === 'cash_on_delivery') {
      status = 'confirmed';
    }
const user = await User.findById(userId);
    const statusTimeline = buildTimeline(status);

    // Inside the POST / route – after paymentMethod validation
const store = await Store.findById(user.storeId);
const commissionRate = store?.commissionRate || 10; // 10% default

// Calculate commission and seller earnings
const commission = (total * commissionRate) / 100;
const sellerEarnings = total - commission;

// When creating the order, add these fields
const newOrder = new Order({
  userId,
  storeId: user.storeId,
  items,
  total,
  commission,
  sellerEarnings,
  deliveryAddress,
  paymentMethod,
  status,
  statusTimeline
});

await newOrder.save();

// Update store earnings
store.totalEarnings = (store.totalEarnings || 0) + sellerEarnings;
store.pendingEarnings = (store.pendingEarnings || 0) + sellerEarnings;
store.totalSales = (store.totalSales || 0) + 1;
await store.save();
     
  // 2.d Order confirmation email - non-blocking
  try {
    const html = `
      <h2>Order Confirmation</h2>
      <p>Hi ${user.name},</p>
      <p>Your order <strong>${newOrder._id}</strong> has been placed successfully.</p>
      <p>Total: Ksh ${newOrder.total.toLocaleString()}</p>
      <p>Payment: ${newOrder.paymentMethod}</p>
      <p>Delivery Address: ${deliveryAddress.address}, ${deliveryAddress.town}</p>
      <p>You can track your order at: <a href="http://localhost:5000/orders.html?order=${newOrder._id}">View Order</a></p>
      <p>Thank you for shopping with KABARAK SOKO!</p>
    `;
    await sendEmail(user.email, 'Order Confirmation - KABARAK SOKO', html);
  } catch (emailError) {
    console.error('Order email failed but order was saved:', emailError.message);
  }

  const orderObj = newOrder.toObject();

    orderObj.id = orderObj._id.toString();

    delete orderObj._id;
    delete orderObj.__v;

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order: orderObj
    });
  } catch (error) {
    console.error('Place order error:', error);

    res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

// ========================================
// GET CURRENT USER'S ORDERS
// ========================================

router.get('/my', async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order
      .find({ userId })
      .sort({ createdAt: -1 });

    const formatted = orders.map(order => {
      const obj = order.toObject();

      obj.id = obj._id.toString();

      delete obj._id;
      delete obj.__v;

      return obj;
    });

    res.json({
      orders: formatted
    });
  } catch (error) {
    console.error('Fetch orders error:', error);

    res.status(500).json({
      message: 'Unable to fetch orders.'
    });
  }
});

// ========================================
// GET SINGLE ORDER
// ========================================

router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({
      _id: orderId,
      userId
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    const obj = order.toObject();

    obj.id = obj._id.toString();

    delete obj._id;
    delete obj.__v;

    res.json({
      order: obj
    });
  } catch (error) {
    console.error('Fetch order details error:', error);

    res.status(500).json({
      message: 'Unable to load order details.'
    });
  }
});

// ========================================
// EXPORT ROUTER
// ========================================
// ========================================
// SELLER: GET ORDERS FOR MY STORE
// ========================================
router.get('/my-store/orders', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({ message: 'Seller access required.' });
    }

    const orders = await Order.find({ storeId: user.storeId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone');

    res.json({ orders });
  } catch (error) {
    console.error('Get store orders error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// SELLER: GET ORDER BY ID (verify ownership)
// ========================================
router.get('/my-store/orders/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({ message: 'Seller access required.' });
    }

    const order = await Order.findOne({ _id: orderId, storeId: user.storeId })
      .populate('userId', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get store order error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ========================================
// SELLER: UPDATE ORDER STATUS (for my store)
// ========================================
router.put('/my-store/orders/:orderId/status', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== 'seller' || !user.storeId) {
      return res.status(403).json({ message: 'Seller access required.' });
    }

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const order = await Order.findOne({ _id: orderId, storeId: user.storeId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.status = status;
    order.updatedAt = new Date();

    // Update timeline
    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    const currentIndex = statusOrder.indexOf(status);
    order.statusTimeline.forEach((step, idx) => {
      if (idx < currentIndex) step.completed = true;
      if (idx === currentIndex) step.current = true;
      if (idx > currentIndex) step.current = false;
    });

    await order.save();

    res.json({ success: true, message: 'Order status updated.', order });
  } catch (error) {
    console.error('Update store order error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;