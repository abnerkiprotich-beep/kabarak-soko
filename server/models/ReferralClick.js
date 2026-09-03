const mongoose = require('mongoose');

const referralClickSchema = new mongoose.Schema({
  affiliateCode: {
    type: String,
    required: true,
    index: true
  },
  visitorIp: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  referrerUrl: {
    type: String,
    default: ''
  },
  converted: {
    type: Boolean,
    default: false
  },
  convertedAt: {
    type: Date,
    default: null
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for fast queries
referralClickSchema.index({ affiliateCode: 1, createdAt: -1 });

module.exports = mongoose.model('ReferralClick', referralClickSchema);