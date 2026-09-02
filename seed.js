const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const sampleProducts = [
  {
    name: 'Samsung Galaxy A15',
    description: '6.5" HD+ display, 128GB storage, 50MP camera',
    price: 18999,
    oldPrice: 21999,
    category: 'Phones',
    images: ['https://via.placeholder.com/150'],
    stock: 50,
    rating: 4.5,
    reviews: 12
  },
  {
    name: 'Soko T-Shirt',
    description: 'Comfortable cotton t-shirt for everyday wear',
    price: 800,
    category: 'Fashion',
    images: [],
    stock: 100,
    rating: 4.0,
    reviews: 5
  },
  {
    name: 'Bread',
    description: 'Freshly baked white bread',
    price: 55,
    category: 'Supermarket',
    images: [],
    stock: 200,
    rating: 4.2,
    reviews: 8
  },
  {
    name: 'Kabarak Milk 500ml',
    description: 'Fresh pasteurised milk',
    price: 60,
    category: 'Supermarket',
    images: [],
    stock: 150,
    rating: 4.8,
    reviews: 15
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    await Product.deleteMany({});
    await Product.insertMany(sampleProducts);
    console.log('✅ Products seeded');
    process.exit(0);
  })
  .catch(err => console.error(err));