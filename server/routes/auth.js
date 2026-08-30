const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the .env file');
    }
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        secret,
        { expiresIn: '7d' }
    );
}

function publicUser(user) {
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        createdAt: user.createdAt
    };
}

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!email || !String(email).trim()) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(String(password), 12);

        const user = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: 'user',
            phone: phone ? String(phone).trim() : '',
            address: address ? String(address).trim() : ''
        });

        const token = createToken(user);

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.error('POST /api/auth/register error:', error);
        return res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !String(email).trim()) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const passwordMatches = await bcrypt.compare(String(password), user.password);
        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.error('POST /api/auth/login error:', error);
        return res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
});

router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, user: publicUser(user) });
    } catch (error) {
        console.error('GET /api/auth/me error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load user', error: error.message });
    }
});

module.exports = router;