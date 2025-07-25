const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
    // This 'pgId' will store the UUID from PostgreSQL for this note
    pgId: {
        type: String, // Storing UUID as a string
        required: true,
        unique: true,
    },
    content: {
        type: String,
        required: true,
    },
    tags: {
        type: [String], // Array of strings for tags
        default: [],
    },
    // You can add other fields specific to the content
    // e.g., 'richTextFormat': { type: Object }
}, { timestamps: false }); // timestamps are handled by PostgreSQL for metadata

module.exports = mongoose.model('NoteContent', NoteSchema);