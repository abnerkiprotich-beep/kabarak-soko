// server/server.js - MongoDB Atlas Version
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const publicPath = path.join(__dirname, '../public');
const indexPath = path.join(publicPath, 'index.html');

console.log('========================================');
console.log('KABARAK SOKO SERVER STARTING');
console.log('========================================');
console.log('Storage: MongoDB Atlas');
console.log('========================================');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// Fallback to index.html for frontend routing
app.use((req, res) => {
  try {
    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({
        success: false,
        message: 'index.html not found',
        path: indexPath
      });
    }
    return res.sendFile(indexPath);
  } catch (error) {
    console.error('Fallback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load the application'
    });
  }
});

// Error Handler
app.use((error, req, res, next) => {
  console.error('Express server error:', error);
  if (res.headersSent) return next(error);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Connect to MongoDB and Start Server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('ERROR: MONGODB_URI is missing in .env file!');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas Connected! Database: kabarak-soko');

    const server = app.listen(PORT, () => {
      console.log('========================================');
      console.log(`KABARAK SOKO running on http://localhost:${PORT}`);
      console.log(`Storage: MongoDB Atlas - PERSISTENT!`);
      console.log(`Product API: http://localhost:${PORT}/api/products`);
      console.log(`Auth API: http://localhost:${PORT}/api/auth`);
      console.log(`Orders API: http://localhost:${PORT}/api/orders`);
      console.log('========================================');
    });

    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`ERROR: Port ${PORT} is already in use.`);
        process.exit(1);
      }
      console.error('Server startup error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    console.error('Check your MONGODB_URI in .env file');
    process.exit(1);
  }
}

startServer();