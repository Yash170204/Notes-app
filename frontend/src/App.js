import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState('');

  // NEW STATE: To manage which note is being edited
  const [editingNote, setEditingNote] = useState(null); // Stores the note object being edited
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');


  const fetchNotes = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreateNote = async (e) => {
    e.preventDefault();

    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      alert('Please enter a title and content for your note.');
      return;
    }

    const tagsArray = newNoteTags.split(',').map(tag => tag.trim()).filter(tag => tag);

    try {
      const response = await fetch('http://localhost:5000/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          tags: tagsArray,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const createdNote = await response.json();
      setNotes(prevNotes => [createdNote, ...prevNotes]);

      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteTags('');

    } catch (error) {
      console.error("Failed to create note:", error);
      setError(error.message);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));

    } catch (error) {
        console.error("Failed to delete note:", error);
        setError(error.message);
    }
  };

  // NEW FUNCTION: Start editing a note
  const handleEditClick = (note) => {
    setEditingNote(note); // Set the entire note object
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(', ')); // Convert array back to comma-separated string
  };

  // NEW FUNCTION: Cancel editing
  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditTitle('');
    setEditContent('');
    setEditTags('');
  };

  // NEW FUNCTION: Handle update note submission
  const handleUpdateNote = async (e) => {
    e.preventDefault();

    if (!editTitle.trim() || !editContent.trim()) {
      alert('Please enter a title and content for your note.');
      return;
    }

    const tagsArray = editTags.split(',').map(tag => tag.trim()).filter(tag => tag);

    try {
      const response = await fetch(`http://localhost:5000/api/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          tags: tagsArray,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedNoteFromServer = await response.json();

      // Update the notes list in state with the updated note
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === updatedNoteFromServer.id ? updatedNoteFromServer : note
        )
      );

      handleCancelEdit(); // Exit editing mode

    } catch (error) {
      console.error("Failed to update note:", error);
      setError(error.message);
    }
  };


  if (loading) {
    return <div className="App">Loading notes...</div>;
  }

  if (error) {
    return <div className="App" style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>My Notes App</h1>
      </header>

      <div className="notes-section">
        <h2>Create New Note</h2>
        <form onSubmit={handleCreateNote} className="note-form">
          <input
            type="text"
            placeholder="Note Title"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Note Content"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            required
          ></textarea>
          <input
            type="text"
            placeholder="Tags (comma-separated, e.g., work, personal)"
            value={newNoteTags}
            onChange={(e) => setNewNoteTags(e.target.value)}
          />
          <button type="submit">Add Note</button>
        </form>
      </div>

      <div className="notes-section">
        <h2>Your Notes</h2>
        <div className="notes-list">
          {notes.length === 0 ? (
            <p>No notes available. Create one above!</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="note-item">
                {editingNote && editingNote.id === note.id ? (
                  // Edit Form when a note is being edited
                  <form onSubmit={handleUpdateNote} className="edit-form">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      required
                    ></textarea>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags (comma-separated)"
                    />
                    <button type="submit">Save Changes</button>
                    <button type="button" onClick={handleCancelEdit} className="cancel-button">Cancel</button>
                  </form>
                ) : (
                  // Display Note normally
                  <>
                    <h3>{note.title}</h3>
                    <p>{note.content}</p>
                    {note.tags && note.tags.length > 0 && (
                      <p className="note-tags">Tags: {note.tags.join(', ')}</p>
                    )}
                    <small>Created: {new Date(note.createdAt).toLocaleDateString()}</small><br/>
                    <small>Last Updated: {new Date(note.updatedAt).toLocaleDateString()}</small>
                    <div className="note-actions">
                      <button
                        onClick={() => handleEditClick(note)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;