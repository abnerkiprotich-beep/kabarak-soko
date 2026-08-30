const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters']
    },

    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative']
    },

    oldPrice: {
      type: Number,
      min: [0, 'Old price cannot be negative'],
      default: null
    },

    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters']
    },

    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },

    images: {
      type: [String],
      default: []
    },

    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0
    },

    rating: {
      type: Number,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0
    },

    reviews: {
      type: Number,
      min: [0, 'Reviews cannot be negative'],
      default: 0
    },

    seller: {
      type: String,
      required: [true, 'Seller is required'],
      trim: true,
      maxlength: [200, 'Seller name cannot exceed 200 characters']
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);