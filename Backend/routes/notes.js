const express = require('express');
const router = express.Router();
const NoteContent = require('../models/Note'); // Mongoose model for MongoDB
const { pgPool } = require('../database/postgres'); // PostgreSQL connection pool

const auth = require('../middleware/auth');

// @route   POST /api/notes
// @desc    Create a new note
// @access  Private
router.post('/', auth, async (req, res) => {
    const { title, content, tags } = req.body;
    const userId = req.user.id;

    if (!title || !content) {
        return res.status(400).json({ msg: 'Please enter title and content' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();
        await pgClientId.query('BEGIN');

        const pgRes = await pgClientId.query(
            'INSERT INTO notes_metadata (title, user_id, mongo_note_id) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at',
            [title, userId, 'temp_mongo_id']
        );
        const pgNoteId = pgRes.rows[0].id;
        const pgCreatedAt = pgRes.rows[0].created_at;
        const pgUpdatedAt = pgRes.rows[0].updated_at;

        const newNoteContent = new NoteContent({
            pgId: pgNoteId,
            content,
            tags,
        });
        const mongoRes = await newNoteContent.save();
        const mongoNoteId = mongoRes._id.toString();

        await pgClientId.query(
            'UPDATE notes_metadata SET mongo_note_id = $1 WHERE id = $2',
            [mongoNoteId, pgNoteId]
        );

        await pgClientId.query('COMMIT');

        res.status(201).json({
            id: pgNoteId,
            title,
            content,
            tags,
            createdAt: pgCreatedAt,
            updatedAt: pgUpdatedAt,
            mongoNoteId: mongoNoteId,
            user_id: userId
        });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK');
        }
        res.status(500).send('Server Error during note creation');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;
// ... (existing code for POST route) ...

// @route   GET /api/notes
// @desc    Get all notes for a user
// @access  Private
router.get('/', auth, async (req, res) => {
    const userId = req.user.id;

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        const pgRes = await pgClientId.query(
            'SELECT id, user_id, title, created_at, updated_at, mongo_note_id FROM notes_metadata WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        const notesMetadata = pgRes.rows;

        if (notesMetadata.length === 0) {
            return res.json([]);
        }

        const mongoIds = notesMetadata.map(note => note.mongo_note_id);

        const mongoNotesContent = await NoteContent.find({ _id: { $in: mongoIds } });

        const mongoContentMap = new Map(
            mongoNotesContent.map(note => [note._id.toString(), note])
        );

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
// @access  Private
router.get('/:id', auth, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();

        const pgRes = await pgClientId.query(
            'SELECT id, user_id, title, created_at, updated_at, mongo_note_id FROM notes_metadata WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );
        const noteMetadata = pgRes.rows[0];

        if (!noteMetadata) {
            return res.status(404).json({ msg: 'Note not found' });
        }

        const mongoContent = await NoteContent.findById(noteMetadata.mongo_note_id);

        const combinedNote = {
            id: noteMetadata.id,
            title: noteMetadata.title,
            user_id: noteMetadata.user_id,
            createdAt: noteMetadata.created_at,
            updatedAt: noteMetadata.updated_at,
            mongoNoteId: noteMetadata.mongo_note_id,
            content: mongoContent ? mongoContent.content : null,
            tags: mongoContent ? mongoContent.tags : [],
        };

        res.json(combinedNote);

    } catch (err) {
        console.error(err.message);
        if (err.code === '22P02') {
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
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;
    const { title, content, tags } = req.body;

    if (!title || !content) {
        return res.status(400).json({ msg: 'Please provide updated title and content' });
    }

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();
        await pgClientId.query('BEGIN');

        const pgUpdateRes = await pgClientId.query(
            'UPDATE notes_metadata SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
            [title, noteId, userId]
        );

        if (pgUpdateRes.rowCount === 0) {
            await pgClientId.query('ROLLBACK');
            return res.status(404).json({ msg: 'Note not found or user not authorized' });
        }

        const updatedPgMetadata = pgUpdateRes.rows[0];
        const mongoNoteId = updatedPgMetadata.mongo_note_id;

        const updatedMongoContent = await NoteContent.findByIdAndUpdate(
            mongoNoteId,
            { content, tags },
            { new: true, runValidators: true }
        );

        if (!updatedMongoContent) {
            await pgClientId.query('ROLLBACK');
            return res.status(404).json({ msg: 'Note content not found in MongoDB' });
        }

        await pgClientId.query('COMMIT');

        res.json({
            id: updatedPgMetadata.id,
            title: updatedPgMetadata.title,
            user_id: updatedPgMetadata.user_id,
            createdAt: updatedPgMetadata.created_at,
            updatedAt: updatedPgMetadata.updated_at,
            mongoNoteId: updatedMongoContent._id.toString(),
            content: updatedMongoContent.content,
            tags: updatedMongoContent.tags,
        });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK');
        }
        if (err.code === '22P02') {
            return res.status(400).json({ msg: 'Invalid note ID format' });
        }
        res.status(500).send('Server Error during note update');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;
// ... (existing code for POST /, GET /, GET /:id, PUT /:id routes) ...

// @route   DELETE /api/notes/:id
// @desc    Delete a note
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    let pgClientId;
    try {
        pgClientId = await pgPool.connect();
        await pgClientId.query('BEGIN');

        const pgLookupRes = await pgClientId.query(
            'SELECT mongo_note_id FROM notes_metadata WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (pgLookupRes.rowCount === 0) {
            await pgClientId.query('ROLLBACK');
            return res.status(404).json({ msg: 'Note not found or user not authorized' });
        }
        const mongoNoteIdToDelete = pgLookupRes.rows[0].mongo_note_id;

        const mongoDeleteRes = await NoteContent.findByIdAndDelete(mongoNoteIdToDelete);

        const pgDeleteRes = await pgClientId.query(
            'DELETE FROM notes_metadata WHERE id = $1',
            [noteId]
        );

        if (pgDeleteRes.rowCount === 0) {
            await pgClientId.query('ROLLBACK');
            return res.status(404).json({ msg: 'Note not found in PostgreSQL during final delete check' });
        }

        await pgClientId.query('COMMIT');

        res.json({ msg: 'Note deleted successfully', id: noteId });

    } catch (err) {
        console.error(err.message);
        if (pgClientId) {
            await pgClientId.query('ROLLBACK');
        }
        if (err.code === '22P02') {
            return res.status(400).json({ msg: 'Invalid note ID format' });
        }
        res.status(500).send('Server Error during note deletion');
    } finally {
        if (pgClientId) {
            pgClientId.release();
        }
    }
});

module.exports = router;