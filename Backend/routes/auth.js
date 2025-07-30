const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For creating JWTs
const { pgPool } = require('../database/postgres'); // PostgreSQL connection pool

// Load environment variables for JWT secret
// Note: dotenv is typically loaded in server.js, but ensure it's available or require here if standalone
// require('dotenv').config(); // Uncomment if you run this file directly for testing

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        // Check if user already exists (by email or username)
        const userCheck = await pgClientId.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (userCheck.rows.length > 0) {
            return res.status(400).json({ msg: 'User with that email or username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10); // Generate a salt
        const passwordHash = await bcrypt.hash(password, salt); // Hash the password with the salt

        // Save user to PostgreSQL
        const newUser = await pgClientId.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, email, passwordHash]
        );

        const user = newUser.rows[0];

        // Create and sign JWT token (optional for register, but useful to auto-login)
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 360000 }, // Token expires in 100 hours (for development)
            (err, token) => {
                if (err) throw err;
                res.status(201).json({
                    msg: 'User registered successfully',
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during registration');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        // Check if user exists
        const userRes = await pgClientId.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        const user = userRes.rows[0];

        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Create and sign JWT token
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 360000 }, // Token expires in 100 hours
            (err, token) => {
                if (err) throw err;
                res.json({
                    msg: 'Logged in successfully',
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during login');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;