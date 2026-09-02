const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

dotenv.config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ===============================
// PUBLIC FOLDER
// ===============================

const publicPath = path.join(__dirname, '../public');

app.use(express.static(publicPath));

// ===============================
// API ROUTES
// ===============================

app.use('/api/auth', authRoutes);

app.use('/api/products', productRoutes);

app.use('/api/orders', orderRoutes);

// ===============================
// FALLBACK ROUTE
// ===============================

app.use((req, res) => {
  try {
    const indexPath = path.join(publicPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    return res.status(404).json({
      message: 'index.html not found'
    });
  } catch (error) {
    console.error('❌ Fallback error:', error);

    return res.status(500).json({
      message: 'Unable to load application'
    });
  }
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);

  res.status(500).json({
    message: 'Internal server error'
  });
});

// ===============================
// MONGODB CONNECTION
// ===============================

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');

    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📦 Auth API:      /api/auth`);
      console.log(`📦 Products API:  /api/products`);
      console.log(`📦 Orders API:    /api/orders`);
      console.log(`🌐 Public folder: ${publicPath}`);
    });

    // ===============================
    // HANDLE PORT ALREADY IN USE
    // ===============================

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(
          `Please stop the other server using port ${PORT} and try again.`
        );
      } else {
        console.error('❌ Server error:', error);
      }

      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });