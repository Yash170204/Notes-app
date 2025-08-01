const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pgPool } = require('../database/postgres');

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        const userCheck = await pgClientId.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (userCheck.rows.length > 0) {
            return res.status(400).json({ msg: 'User with that email or username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pgClientId.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, email, passwordHash]
        );

        const user = newUser.rows[0];

        const payload = {
            user: {
                id: user.id,
                username: user.username
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 360000 },
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

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        const userRes = await pgClientId.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        const user = userRes.rows[0];

        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 360000 },
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