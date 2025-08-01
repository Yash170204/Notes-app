const jwt = require('jsonwebtoken');

// Load environment variables for JWT secret
// require('dotenv').config(); // Not strictly needed here if server.js already loaded it

module.exports = function (req, res, next) {
    // Get token from header
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Check if token is in the correct format: Bearer <token>
    if (!token.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'Token format is not valid' });
    }

    try {
        const tokenValue = token.split(' ')[1];
        const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};