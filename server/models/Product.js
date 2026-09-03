const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  store: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Store',
  required: [true, 'Store is required']
},
sellerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: [true, 'Seller is required']
},
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: null },
  category: { type: String, required: true, trim: true },
  images: { type: [String], default: [] },
  stock: { type: Number, default: 0, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviews: { type: Number, default: 0 },
isApproved: {
  type: Boolean,
  default: false
},
approvedAt: {
  type: Date,
  default: null
},
approvedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);