// makeAdmin.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const email = 'abnertraders@gmail.com';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    user.isAdmin = true;
    await user.save();

    console.log(`✅ User "${email}" is now an admin!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });