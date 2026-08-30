require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./server/models/Product');
const User = require('./server/models/User');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find or create admin user to be seller
  let seller = await User.findOne({ email: "admin@kabarak.ac.ke" });
  if (!seller) {
    seller = await User.create({
      name: "Admin",
      email: "admin@kabarak.ac.ke",
      password: "123456",
      role: "admin"
    });
    console.log("Admin created");
  }

  await Product.deleteMany({});

  const products = [
    { name: "Kabarak Milk 500ml", price: 60, category: "Groceries", description: "Fresh", stock: 100, image: "https://via.placeholder.com/300", seller: seller._id },
    { name: "Bread", price: 55, category: "Groceries", description: "Soft bread", stock: 50, image: "https://via.placeholder.com/300", seller: seller._id },
    { name: "Soko T-Shirt", price: 800, category: "Clothing", description: "Merch", stock: 20, image: "https://via.placeholder.com/300", seller: seller._id }
  ];

  await Product.insertMany(products);
  console.log("✅ 3 Products Added with seller!");
  process.exit();
};

run();