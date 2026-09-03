const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
  image: { type: String, default: '' }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  county: { type: String, required: true },
  town: { type: String, required: true },
  address: { type: String, required: true }
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  label: { type: String, required: true },
  description: { type: String, required: true },
  completed: { type: Boolean, default: false },
  current: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
storeId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Store',
  required: false
},
commission: {
  type: Number,
  default: 0
},
sellerEarnings: {
  type: Number,
  default: 0
},
  items: { type: [itemSchema], required: true, validate: [v => v.length > 0, 'At least one item'] },
  total: { type: Number, required: true, min: 0 },
  deliveryAddress: { type: addressSchema, required: true },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'mpesa', 'cod'], required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  mpesaReceipt: { type: String, default: null },
  statusTimeline: { type: [timelineSchema], default: [] }
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);