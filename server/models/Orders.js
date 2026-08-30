const mongoose = require('mongoose');

const orderProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    qty: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    products: {
      type: [orderProductSchema],
      required: [true, 'Order products are required'],
      validate: {
        validator: function (products) {
          return products.length > 0;
        },
        message: 'Order must contain at least one product'
      }
    },
    total: {
      type: Number,
      required: [true, 'Order total is required'],
      min: [0, 'Order total cannot be negative']
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['mpesa', 'cod'],
      required: [true, 'Payment method is required']
    },
    mpesaReceipt: {
      type: String,
      trim: true,
      default: null
    },
    deliveryAddress: {
      type: String,
      required: [true, 'Delivery address is required'],
      trim: true,
      maxlength: [1000, 'Delivery address cannot exceed 1000 characters']
    }
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);