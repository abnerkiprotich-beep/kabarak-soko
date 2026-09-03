const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ReferralClick = require('../models/ReferralClick');
const { sendEmail } = require('../../utils/sendEmail'); // <-- FIXED PATH

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address, referralCode } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = new User({ 
      name, 
      email: email.toLowerCase(), 
      password, 
      phone, 
      address 
    });

    // --- AFFILIATE SYSTEM - REFERRAL FIX ---
    if (referralCode) {
      const referrer = await User.findOne({ affiliateCode: referralCode, isAffiliate: true });
      if (referrer) {
        user.referredBy = referralCode;
        // Also log the referral click as converted
        try {
          const click = await ReferralClick.findOne({ affiliateCode: referralCode, converted: false })
            .sort({ createdAt: -1 });
          if (click) {
            click.converted = true;
            click.convertedAt = new Date();
            click.referredUserId = user._id;
            await click.save();
          }
        } catch (e) {
          console.log('Referral click update error:', e.message);
        }
      }
    }
    // --- END AFFILIATE FIX ---

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const resetUrl = `http://localhost:5000/reset-password.html?token=${resetToken}`;
    const html = `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your KABARAK SOKO account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#16834b;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a>
      <p>If you didn't request this, ignore this email.</p>
    `;
    await sendEmail(email, 'Reset Your Password - KABARAK SOKO', html);
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;