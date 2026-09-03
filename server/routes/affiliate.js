const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ReferralClick = require('../models/ReferralClick');
const Order = require('../models/Orders'); // <-- FIXED: plural "Orders"

// =====================================================
// GENERATE UNIQUE AFFILIATE CODE
// =====================================================
function generateAffiliateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =====================================================
// BECOME AN AFFILIATE
// =====================================================
router.post('/register', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.isAffiliate) {
      return res.status(400).json({
        message: 'You are already an affiliate.'
      });
    }

    // Generate unique code
    let code = generateAffiliateCode();
    let exists = await User.findOne({ affiliateCode: code });
    while (exists) {
      code = generateAffiliateCode();
      exists = await User.findOne({ affiliateCode: code });
    }

    user.isAffiliate = true;
    user.affiliateCode = code;
    user.affiliateAppliedAt = new Date();

    await user.save();

    res.json({
      success: true,
      message: 'You are now an affiliate!',
      affiliateCode: code
    });

  } catch (error) {
    console.error('Affiliate registration error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =====================================================
// GET AFFILIATE DASHBOARD STATS
// =====================================================
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isAffiliate) {
      return res.status(403).json({
        message: 'You are not an affiliate.'
      });
    }

    // Total clicks on referral links
    const totalClicks = await ReferralClick.countDocuments({
      affiliateCode: user.affiliateCode
    });

    // Conversions (users who registered via this affiliate)
    const conversions = await User.countDocuments({
      referredBy: user.affiliateCode
    });

    // Orders that used this affiliate code
    const orders = await Order.find({
      affiliateCode: user.affiliateCode
    }).sort({ createdAt: -1 }).limit(20);

    const totalOrders = await Order.countDocuments({
      affiliateCode: user.affiliateCode
    });

    // Total commission earned (from orders that were completed)
    const completedOrders = await Order.find({
      affiliateCode: user.affiliateCode,
      status: { $in: ['delivered', 'paid'] }
    });
    const totalCommission = completedOrders.reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

    // Recent clicks with conversion status
    const recentClicks = await ReferralClick.find({
      affiliateCode: user.affiliateCode
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('referredUserId', 'name email');

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const referralLink = `${baseUrl}/index.html?ref=${user.affiliateCode}`;

    res.json({
      affiliateCode: user.affiliateCode,
      referralLink,
      commissionBalance: user.commissionBalance || 0,
      totalEarned: user.totalEarned || 0,
      totalClicks,
      conversions,
      totalOrders,
      totalCommission,
      recentClicks,
      recentOrders: orders
    });

  } catch (error) {
    console.error('Affiliate dashboard error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =====================================================
// GET REFERRAL LINK
// =====================================================
router.get('/referral-link', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isAffiliate || !user.affiliateCode) {
      return res.status(403).json({
        message: 'You are not an affiliate.'
      });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const link = `${baseUrl}/index.html?ref=${user.affiliateCode}`;

    res.json({ referralLink: link });

  } catch (error) {
    console.error('Referral link error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =====================================================
// GET AFFILIATE TRANSACTIONS (COMMISSIONS)
// =====================================================
router.get('/transactions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isAffiliate) {
      return res.status(403).json({
        message: 'You are not an affiliate.'
      });
    }

    const orders = await Order.find({
      affiliateCode: user.affiliateCode,
      affiliateCommission: { $gt: 0 }
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const transactions = orders.map(order => ({
      orderId: order._id,
      customer: order.userId?.name || 'Unknown',
      amount: order.total,
      commission: order.affiliateCommission,
      status: order.status,
      date: order.createdAt
    }));

    res.json({ transactions });

  } catch (error) {
    console.error('Affiliate transactions error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =====================================================
// REQUEST WITHDRAWAL (MOCK FOR NOW)
// =====================================================
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.isAffiliate) {
      return res.status(403).json({
        message: 'You are not an affiliate.'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }

    if (amount > user.commissionBalance) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // For now, just deduct and log (no actual payment)
    user.commissionBalance -= amount;
    await user.save();

    res.json({
      success: true,
      message: `Withdrawal of KSh ${amount} requested. Please allow 1-2 business days.`,
      newBalance: user.commissionBalance
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// =====================================================
// CHECK REFERRAL STATUS (FOR PUBLIC)
// =====================================================
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const user = await User.findOne({ affiliateCode: code, isAffiliate: true });

    if (!user) {
      return res.status(404).json({ valid: false });
    }

    res.json({ valid: true, affiliateName: user.name });
  } catch (error) {
    console.error('Check referral error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;