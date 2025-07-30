const jwt = require('jsonwebtoken');

// Load environment variables for JWT secret
// require('dotenv').config(); // Not strictly needed here if server.js already loaded it

module.exports = function (req, res, next) {
    // Get token from header
    const token = req.header('x-auth-token'); // Common header name for JWT

    // Check if no token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        // jwt.verify takes the token, the secret, and a callback
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the user (from the token payload) to the request object
        // The user ID will now be available as req.user.id in protected routes
        req.user = decoded.user;
        next(); // Move to the next middleware or route handler

    } catch (err) {
        // If verification fails (e.g., token expired, invalid secret)
        res.status(401).json({ msg: 'Token is not valid' });
    }
};