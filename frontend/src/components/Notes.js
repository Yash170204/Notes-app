import React, { useState, useEffect } from 'react';

const Notes = ({ token, username, handleLogout }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');

  const fetchNotes = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
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
    if (token) {
      fetchNotes();
    }
  }, [token]);

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setIsCreating(false);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(', '));
  };

  const handleCreateNewNote = () => {
    setSelectedNote(null);
    setIsCreating(true);
    setEditTitle('New Note');
    setEditContent('');
    setEditTags('');
  };

  const handleCloseEditor = () => {
    setSelectedNote(null);
    setIsCreating(false);
  };

  const handleSaveNote = async () => {
    const tagsArray = editTags.split(',').map(tag => tag.trim()).filter(tag => tag);
    const noteData = { title: editTitle, content: editContent, tags: tagsArray };

    const url = isCreating
      ? 'http://localhost:5000/api/notes'
      : `http://localhost:5000/api/notes/${selectedNote.id}`;
    const method = isCreating ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const savedNote = await response.json();

      if (isCreating) {
        const newNotes = [savedNote, ...notes];
        setNotes(newNotes);
        handleSelectNote(newNotes[0]);
      } else {
        const newNotes = notes.map(n => n.id === savedNote.id ? savedNote : n);
        setNotes(newNotes);
        handleSelectNote(savedNote);
      }
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to save note:", error);
      setError(error.message);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;

    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/notes/${selectedNote.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newNotes = notes.filter(n => n.id !== selectedNote.id);
      setNotes(newNotes);
      setSelectedNote(null);

    } catch (error) {
      console.error("Failed to delete note:", error);
      setError(error.message);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (error) {
    return <div className="error-screen">Error: {error}</div>;
  }

  return (
    <div className="App">
      <div className="sidebar">
        <div className="user-info">
          <h4>Welcome, {username}!</h4>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
        <button className="create-note-btn" onClick={handleCreateNewNote}>Create New Note</button>
        <ul className="notes-list">
          {notes.map(note => (
            <li 
              key={note.id} 
              className={`note-item ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`}
              onClick={() => handleSelectNote(note)}
            >
              <h3>{note.title}</h3>
              <p>{new Date(note.updatedAt).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="main-content">
        {(selectedNote || isCreating) ? (
          <div className="note-editor">
            <button onClick={handleCloseEditor} className="btn-close-editor">X</button>
            <input 
              type="text" 
              value={editTitle} 
              onChange={e => setEditTitle(e.target.value)} 
              className="note-title-input"
            />
            <textarea 
              value={editContent} 
              onChange={e => setEditContent(e.target.value)} 
              className="note-content-textarea"
            ></textarea>
            <input 
              type="text" 
              value={editTags} 
              onChange={e => setEditTags(e.target.value)} 
              placeholder="Tags (comma-separated)"
              className="note-tags-input"
            />
            <div className="note-actions">
              <button onClick={handleSaveNote} className="btn-save">{isCreating ? 'Create' : 'Save'}</button>
              {!isCreating && <button onClick={handleDeleteNote} className="btn-delete">Delete</button>}
            </div>
          </div>
        ) : (
          <div className="welcome-message">
            <h2>Welcome to your Notes!</h2>
            <p>Select a note from the list to view or edit it, or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
