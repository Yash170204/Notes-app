const { Pool } = require('pg');

// PostgreSQL Connection Pool
const pgPool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

pgPool.connect()
    .then(client => {
        console.log('PostgreSQL connected successfully!');
        client.release(); // Release the client back to the pool
        // Run schema creation after successful connection
        createPgTables();
    })
    .catch(err => console.error('PostgreSQL connection error:', err));

// Function to create PostgreSQL tables
async function createPgTables() {
    const client = await pgPool.connect();
    try {
        // Table for users (if you plan user authentication)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('PostgreSQL users table checked/created.');

        // Table for notes metadata
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes_metadata (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                -- This column will store the _id (ObjectId string) from the MongoDB document
                mongo_note_id VARCHAR(24) UNIQUE NOT NULL
            );
        `);
        console.log('PostgreSQL notes_metadata table checked/created.');

        // Index for faster lookups by user_id
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes_metadata (user_id);
        `);
        console.log('PostgreSQL notes_metadata index on user_id checked/created.');

    } catch (err) {
        console.error('Error creating PostgreSQL tables:', err);
    } finally {
        client.release(); // Release the client back to the pool
    }
}

module.exports = { pgPool, createPgTables };