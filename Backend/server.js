// Load environment variables from .env file
require('dotenv').config();

// Import necessary packages
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // For MongoDB
const notesRoutes = require('./routes/notes');
// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000; // Use port from environment variable or default to 5000

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable parsing of JSON request bodies
app.use('/api/notes', notesRoutes);

// --- Database Connections ---

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

const { pgPool } = require('./database/postgres'); // Import pgPool
// --- Basic API Route (Test) ---
app.get('/', (req, res) => {
    res.send('Notes App Backend is running!');
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});