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

    const statusTimeline = buildTimeline(status);

    const newOrder = new Order({
      userId,
      items,
      total,
      deliveryAddress,
      paymentMethod,
      status,
      statusTimeline
    });

    await newOrder.save();

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

module.exports = router;