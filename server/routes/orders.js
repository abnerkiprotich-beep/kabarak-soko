const express = require('express');
const Order = require('../models/Orders');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

function getUserId(req) {
    if (!req.user) return null;
    return req.user.id?? req.user._id?? req.user.userId?? null;
}
function getUserEmail(req) {
    return String(req.user?.email || '').trim().toLowerCase();
}
function createOrderId() {
    return 'KSO-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}
function createMockCheckoutRequestId() {
    return 'MOCK-STK-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}
function normalizeKenyanPhone(phone) {
    const value = String(phone || '').trim().replace(/\s+/g, '');
    if (/^07\d{8}$/.test(value)) return '254' + value.substring(1);
    if (/^01\d{8}$/.test(value)) return '254' + value.substring(1);
    if (/^\+254[17]\d{8}$/.test(value)) return value.substring(1);
    if (/^254[17]\d{8}$/.test(value)) return value;
    return null;
}
function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        productId: String(item?.productId?? item?.id?? item?._id?? '').trim(),
        qty: Math.floor(Number(item?.qty?? item?.quantity?? 0))
    })).filter(item => item.productId && Number.isInteger(item.qty) && item.qty > 0);
}
function buildStatusTimeline(status) {
    const stages = [
        { key: 'confirmed', label: 'Order Confirmed', description: 'Your order has been confirmed.' },
        { key: 'processing', label: 'Processing', description: 'Your order is being prepared.' },
        { key: 'shipped', label: 'Shipped', description: 'Your order is on its way.' },
        { key: 'delivered', label: 'Delivered', description: 'Your order has been delivered.' }
    ];
    const normalizedStatus = String(status || '').toLowerCase();
    if (normalizedStatus === 'cancelled') {
        return [{ key: 'cancelled', label: 'Order Cancelled', description: 'This order has been cancelled.', completed: true, current: true }];
    }
    if (normalizedStatus === 'pending') {
        return [
            { key: 'confirmed', label: 'Order Confirmed', description: 'Your order is awaiting payment confirmation.', completed: false, current: true },
           ...stages.slice(1).map(stage => ({...stage, completed: false, current: false }))
        ];
    }
    const statusOrder = ['confirmed', 'processing', 'shipped', 'delivered'];
    let currentIndex = statusOrder.indexOf(normalizedStatus);
    if (currentIndex < 0) currentIndex = 0;
    return stages.map((stage, index) => ({...stage, completed: index <= currentIndex, current: index === currentIndex }));
}
function enrichOrder(order) {
    const o = order.toObject? order.toObject() : order;
    return {...o, statusTimeline: buildStatusTimeline(o.status) };
}

// POST /api/orders - CREATE ORDER -> MONGODB ATLAS
router.post('/', protect, async (req, res) => {
    try {
        const { items, deliveryAddress, paymentMethod } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty.' });
        }
        if (!deliveryAddress || typeof deliveryAddress!== 'object') {
            return res.status(400).json({ success: false, message: 'Delivery address is required.' });
        }
        const requiredFields = ['name', 'phone', 'county', 'town', 'address'];
        for (const field of requiredFields) {
            if (!String(deliveryAddress[field] || '').trim()) {
                return res.status(400).json({ success: false, message: `Delivery ${field} is required.` });
            }
        }
        if (!['mpesa', 'cod'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Choose M-Pesa or Cash on Delivery.' });
        }

        const normalizedItems = normalizeItems(items);
        if (normalizedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart contains no valid items.' });
        }

        // Get products from MongoDB
        const productIds = normalizedItems.map(i => i.productId);
        const products = await Product.find({ _id: { $in: productIds } });

        if (products.length === 0) {
            return res.status(400).json({ success: false, message: 'No products are available.' });
        }

        const orderProducts = [];
        let total = 0;

        for (const item of normalizedItems) {
            const product = products.find(p => String(p._id) === item.productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'A product in your cart no longer exists.' });
            }
            const price = Number(product.price);
            if (!Number.isFinite(price) || price < 0) {
                return res.status(400).json({ success: false, message: `Invalid price for ${product.name || 'product'}.` });
            }
            const stock = Number(product.stock);
            if (Number.isFinite(stock) && stock < item.qty) {
                return res.status(400).json({ success: false, message: `${product.name || 'Product'} does not have enough stock.` });
            }
            total += price * item.qty;
            orderProducts.push({
                product: product._id,
                qty: item.qty
            });
        }

        total = Math.round((total + Number.EPSILON) * 100) / 100;

        if (paymentMethod === 'mpesa') {
            const phone = normalizeKenyanPhone(deliveryAddress.phone);
            if (!phone) {
                return res.status(400).json({ success: false, message: 'Enter a valid Kenyan M-Pesa phone number.' });
            }
        }

        const order = await Order.create({
            user: getUserId(req),
            products: orderProducts,
            total,
            status: paymentMethod === 'cod'? 'confirmed' : 'pending',
            paymentMethod,
            deliveryAddress: `${deliveryAddress.name}, ${deliveryAddress.phone}, ${deliveryAddress.county}, ${deliveryAddress.town}, ${deliveryAddress.address}`
        });

        console.log(paymentMethod === 'cod'? 'COD order created:' : 'MOCK M-PESA order created:', order._id);

        return res.status(201).json({
            success: true,
            message: paymentMethod === 'cod'? 'Order placed successfully. Pay cash on delivery.' : 'Mock M-Pesa STK Push sent successfully.',
            order: enrichOrder(order)
        });
    } catch (error) {
        console.error('Create order error:', error);
        return res.status(500).json({ success: false, message: 'Unable to create order.' });
    }
});

// GET /api/orders/my
router.get('/my', protect, async (req, res) => {
    try {
        const userId = getUserId(req);
        const orders = await Order.find({ user: userId }).populate('products.product').sort({ createdAt: -1 });
        return res.status(200).json({ success: true, orders: orders.map(enrichOrder) });
    } catch (error) {
        console.error('Get my orders error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load your orders.' });
    }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const orderId = String(req.params.id || '').trim();
        if (!orderId) return res.status(400).json({ success: false, message: 'Order ID is required.' });

        const order = await Order.findById(orderId).populate('products.product');
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

        const userId = getUserId(req);
        if (String(order.user)!== String(userId)) {
            return res.status(403).json({ success: false, message: 'You do not have permission to view this order.' });
        }

        return res.status(200).json({ success: true, order: enrichOrder(order) });
    } catch (error) {
        console.error('Get order error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load order.' });
    }
});

module.exports = router;