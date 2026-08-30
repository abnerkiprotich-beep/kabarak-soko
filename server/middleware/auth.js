const jwt = require('jsonwebtoken');

function protect(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authorization format'
            });
        }

        const token = parts[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is missing'
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error('JWT_SECRET is not defined in the .env file.');

            return res.status(500).json({
                success: false,
                message: 'Server authentication configuration is missing'
            });
        }

        const decoded = jwt.verify(token, secret);

        req.user = decoded;

        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Authentication token has expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
}

module.exports = {
    protect
};