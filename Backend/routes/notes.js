const express = require('express');
const router = express.Router();
const NoteContent = require('../models/Note'); // Mongoose model for MongoDB
const { pgPool } = require('../database/postgres'); // PostgreSQL connection pool

// @route   POST /api/notes
// @desc    Create a new note
// @access  Public (for now, will add authentication later)
router.post('/', async (req, res) => {
    const { title, content, tags } = req.body; // Data from the frontend

    // Basic validation
    if (!title || !content) {
        return res.status(400).json({ msg: 'Please enter title and content' });
    }

    let pgClientId; // To hold the PostgreSQL client for transaction
    try {
        // --- Step 1: Save metadata to PostgreSQL (start a transaction) ---
        pgClientId = await pgPool.connect(); // Get a client from the pool
        await pgClientId.query('BEGIN'); // Start transaction

        // You'll need a user_id here eventually. For now, let's assume a default or temporary one.
        // Later, when you implement user authentication, you'll get user_id from req.user.id
        // For now, let's insert into users table first or assume a user exists.
        // For simplicity of this step, let's temporarily make user_id nullable or insert a dummy user.
        // We'll proceed assuming user_id will be handled.
        // If you want to insert a dummy user for testing, run this in pgAdmin:
        // INSERT INTO users (username, email, password_hash) VALUES ('testuser', 'test@example.com', 'dummyhash');
        // And use that ID. For now, we'll keep user_id as NULL if no user is logged in.

        // Insert into notes_metadata in PostgreSQL
        const pgRes = await pgClientId.query(
            'INSERT INTO notes_metadata (title, user_id, created_at, updated_at, mongo_note_id) VALUES ($1, $2, NOW(), NOW(), $3) RETURNING id, created_at, updated_at',
            [title, null, 'temp_mongo_id'] // user_id is null for now, mongo_note_id is temp
        );
        const pgNoteId = pgRes.rows[0].id; // Get the UUID generated by PostgreSQL
        const pgCreatedAt = pgRes.rows[0].created_at;
        const pgUpdatedAt = pgRes.rows[0].updated_at;

        // --- Step 2: Save content to MongoDB ---
        const newNoteContent = new NoteContent({
            pgId: pgNoteId, // Link MongoDB document to PostgreSQL UUID
            content,
            tags,
        });
        const mongoRes = await newNoteContent.save();
        const mongoNoteId = mongoRes._id.toString(); // Get MongoDB's ObjectId as string

        // --- Step 3: Update PostgreSQL with actual MongoDB ID (complete transaction) ---
        await pgClientId.query(
            'UPDATE notes_metadata SET mongo_note_id = $1 WHERE id = $2',
            [mongoNoteId, pgNoteId]
        );

        await pgClientId.query('COMMIT'); // Commit the transaction

        // Respond with the combined note data
        res.status(201).json({
            id: pgNoteId,
            title,
            content,
            tags,
            createdAt: pgCreatedAt,
            updatedAt: pgUpdatedAt,
            mongoNoteId: mongoNoteId,
            user_id: null // Will be actual user ID later
        });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK'); // Rollback transaction on error
        }
        res.status(500).send('Server Error during note creation');
    } finally {
        if (pgClientId) {
            pgClientId.release(); // Always release the client back to the pool
        }
    }
});

module.exports = router;
// ... (existing code for POST route) ...

// @route   GET /api/notes
// @desc    Get all notes
// @access  Public (for now)
router.get('/', async (req, res) => {
    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        // Fetch all notes metadata from PostgreSQL
        // Order by most recently updated
        const pgRes = await pgClientId.query(
            'SELECT id, user_id, title, created_at, updated_at, mongo_note_id FROM notes_metadata ORDER BY updated_at DESC'
        );
        const notesMetadata = pgRes.rows;

        if (notesMetadata.length === 0) {
            return res.json([]); // No notes found
        }

        // Get all MongoDB IDs from the fetched metadata
        const mongoIds = notesMetadata.map(note => note.mongo_note_id);

        // Fetch corresponding content from MongoDB in one go
        const mongoNotesContent = await NoteContent.find({ _id: { $in: mongoIds } });

        // Create a map for quick lookup of MongoDB content by its _id
        const mongoContentMap = new Map(
            mongoNotesContent.map(note => [note._id.toString(), note])
        );

        // Combine data from both databases
        const combinedNotes = notesMetadata.map(pgNote => {
            const mongoContent = mongoContentMap.get(pgNote.mongo_note_id);
            return {
                id: pgNote.id,
                title: pgNote.title,
                user_id: pgNote.user_id,
                createdAt: pgNote.created_at,
                updatedAt: pgNote.updated_at,
                mongoNoteId: pgNote.mongo_note_id,
                content: mongoContent ? mongoContent.content : null,
                tags: mongoContent ? mongoContent.tags : [],
            };
        });

        res.json(combinedNotes);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during note retrieval');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;

// ... (existing code for POST / and GET / routes) ...

// @route   GET /api/notes/:id
// @desc    Get a single note by ID
// @access  Public (for now)
router.get('/:id', async (req, res) => {
    const noteId = req.params.id; // Get the note ID (PostgreSQL UUID) from the URL parameter

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        // Fetch note metadata from PostgreSQL
        const pgRes = await pgClientId.query(
            'SELECT id, user_id, title, created_at, updated_at, mongo_note_id FROM notes_metadata WHERE id = $1',
            [noteId]
        );
        const noteMetadata = pgRes.rows[0]; // Get the first (and should be only) row

        if (!noteMetadata) {
            return res.status(404).json({ msg: 'Note not found' });
        }

        // Fetch corresponding content from MongoDB
        const mongoContent = await NoteContent.findById(noteMetadata.mongo_note_id);

        // Combine data from both databases
        const combinedNote = {
            id: noteMetadata.id,
            title: noteMetadata.title,
            user_id: noteMetadata.user_id,
            createdAt: noteMetadata.created_at,
            updatedAt: noteMetadata.updated_at,
            mongoNoteId: noteMetadata.mongo_note_id,
            content: mongoContent ? mongoContent.content : null, // Handle case if mongoContent not found
            tags: mongoContent ? mongoContent.tags : [], // Handle case if mongoContent not found
        };

        res.json(combinedNote);

    } catch (err) {
        console.error(err.message);
        // If the ID format is bad (e.g., not a valid UUID), it might throw an error earlier
        // So, check for specific errors if needed, otherwise send generic 500
        if (err.code === '22P02') { // PostgreSQL error code for invalid text representation (e.g., bad UUID)
            return res.status(400).json({ msg: 'Invalid note ID format' });
        }
        res.status(500).send('Server Error during single note retrieval');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;
// ... (existing code for POST /, GET /, GET /:id routes) ...

// @route   PUT /api/notes/:id
// @desc    Update an existing note
// @access  Public (for now)
router.put('/:id', async (req, res) => {
    const noteId = req.params.id; // Get the note ID (PostgreSQL UUID) from the URL parameter
    const { title, content, tags } = req.body; // Updated data from the frontend

    // Basic validation
    if (!title || !content) {
        return res.status(400).json({ msg: 'Please provide updated title and content' });
    }

    let pgClientId; // To hold the PostgreSQL client for transaction
    try {
        // --- Step 1: Start a transaction in PostgreSQL ---
        pgClientId = await pgPool.connect();
        await pgClientId.query('BEGIN');

        // --- Step 2: Update notes_metadata in PostgreSQL ---
        // We also update `updated_at` to reflect the change
        const pgUpdateRes = await pgClientId.query(
            'UPDATE notes_metadata SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [title, noteId]
        );

        // Check if any row was updated in PostgreSQL
        if (pgUpdateRes.rowCount === 0) {
            await pgClientId.query('ROLLBACK'); // Rollback if note not found in PG
            return res.status(404).json({ msg: 'Note not found in PostgreSQL' });
        }

        const updatedPgMetadata = pgUpdateRes.rows[0];
        const mongoNoteId = updatedPgMetadata.mongo_note_id;

        // --- Step 3: Update content in MongoDB ---
        const updatedMongoContent = await NoteContent.findByIdAndUpdate(
            mongoNoteId,
            { content, tags },
            { new: true, runValidators: true } // `new: true` returns the updated document
        );

        // Check if any document was updated in MongoDB
        if (!updatedMongoContent) {
            await pgClientId.query('ROLLBACK'); // Rollback if content not found in Mongo
            return res.status(404).json({ msg: 'Note content not found in MongoDB' });
        }

        // --- Step 4: Commit the transaction ---
        await pgClientId.query('COMMIT');

        // Respond with the combined updated note data
        res.json({
            id: updatedPgMetadata.id,
            title: updatedPgMetadata.title,
            user_id: updatedPgMetadata.user_id, // Still null for now
            createdAt: updatedPgMetadata.created_at,
            updatedAt: updatedPgMetadata.updated_at,
            mongoNoteId: updatedMongoContent._id.toString(),
            content: updatedMongoContent.content,
            tags: updatedMongoContent.tags,
        });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK'); // Rollback transaction on error
        }
        // Add specific error handling for bad UUID format for PUT as well
        if (err.code === '22P02') {
            return res.status(400).json({ msg: 'Invalid note ID format' });
        }
        res.status(500).send('Server Error during note update');
    } finally {
        if (pgClientId) {
            pgClientId.release(); // Always release the client back to the pool
        }
    }
});

module.exports = router;
// ... (existing code for POST /, GET /, GET /:id, PUT /:id routes) ...

// @route   DELETE /api/notes/:id
// @desc    Delete a note
// @access  Public (for now)
router.delete('/:id', async (req, res) => {
    const noteId = req.params.id; // Get the note ID (PostgreSQL UUID) from the URL parameter

    let pgClientId; // To hold the PostgreSQL client for transaction
    try {
        pgClientId = await pgPool.connect();
        await pgClientId.query('BEGIN'); // Start transaction

        // --- Step 1: Get mongo_note_id from PostgreSQL before deleting metadata ---
        const pgLookupRes = await pgClientId.query(
            'SELECT mongo_note_id FROM notes_metadata WHERE id = $1',
            [noteId]
        );

        if (pgLookupRes.rowCount === 0) {
            await pgClientId.query('ROLLBACK'); // Rollback if note not found in PG
            return res.status(404).json({ msg: 'Note not found in PostgreSQL' });
        }
        const mongoNoteIdToDelete = pgLookupRes.rows[0].mongo_note_id;

        // --- Step 2: Delete content from MongoDB ---
        const mongoDeleteRes = await NoteContent.findByIdAndDelete(mongoNoteIdToDelete);

        // Note: If mongoDeleteRes is null, it means the document wasn't found in MongoDB.
        // We might still want to delete from PG if it's just a dangling reference,
        // but for a strict dual-delete, we can check. For now, we proceed to delete from PG.
        // A more robust app might log if Mongo delete failed but PG delete succeeded.

        // --- Step 3: Delete metadata from PostgreSQL ---
        const pgDeleteRes = await pgClientId.query(
            'DELETE FROM notes_metadata WHERE id = $1',
            [noteId]
        );

        if (pgDeleteRes.rowCount === 0) {
            // This case should ideally not happen if pgLookupRes found it, but good for robustness
            await pgClientId.query('ROLLBACK');
            return res.status(404).json({ msg: 'Note not found in PostgreSQL during final delete check' });
        }

        // --- Step 4: Commit the transaction ---
        await pgClientId.query('COMMIT');

        res.json({ msg: 'Note deleted successfully', id: noteId });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK'); // Rollback transaction on error
        }
        if (err.code === '22P02') {
            return res.status(400).json({ msg: 'Invalid note ID format' });
        }
        res.status(500).send('Server Error during note deletion');
    } finally {
        if (pgClientId) {
            pgClientId.release(); // Always release the client back to the pool
        }
    }
});

module.exports = router;