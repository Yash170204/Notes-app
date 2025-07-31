import React, { useState, useEffect } from 'react';

const Notes = ({ token }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState('');

  const [editingNote, setEditingNote] = useState(null);
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
          'Authorization': `Bearer ${token}`,
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
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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

  const handleEditClick = (note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(', '));
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditTitle('');
    setEditContent('');
    setEditTags('');
  };

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
          'Authorization': `Bearer ${token}`,
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

      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === updatedNoteFromServer.id ? updatedNoteFromServer : note
        )
      );

      handleCancelEdit();

    } catch (error) {
      console.error("Failed to update note:", error);
      setError(error.message);
    }
  };

  if (loading) {
    return <div>Loading notes...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-4">
          <h2>Create New Note</h2>
          <form onSubmit={handleCreateNote} className="mb-4">
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Note Title"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <textarea
                className="form-control"
                placeholder="Note Content"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                required
              ></textarea>
            </div>
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Tags (comma-separated)"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">Add Note</button>
          </form>
        </div>
        <div className="col-md-8">
          <h2>Your Notes</h2>
          <div className="notes-list">
            {notes.length === 0 ? (
              <p>No notes available. Create one!</p>
            ) : (
              <div className="row">
                {notes.map(note => (
                  <div key={note.id} className="col-md-6 mb-3">
                    <div className="card">
                      <div className="card-body">
                        {editingNote && editingNote.id === note.id ? (
                          <form onSubmit={handleUpdateNote}>
                            <div className="mb-3">
                              <input
                                type="text"
                                className="form-control"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                required
                              />
                            </div>
                            <div className="mb-3">
                              <textarea
                                className="form-control"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                required
                              ></textarea>
                            </div>
                            <div className="mb-3">
                              <input
                                type="text"
                                className="form-control"
                                value={editTags}
                                onChange={(e) => setEditTags(e.target.value)}
                                placeholder="Tags (comma-separated)"
                              />
                            </div>
                            <button type="submit" className="btn btn-success btn-sm me-2">Save</button>
                            <button type="button" onClick={handleCancelEdit} className="btn btn-secondary btn-sm">Cancel</button>
                          </form>
                        ) : (
                          <>
                            <h5 className="card-title">{note.title}</h5>
                            <p className="card-text">{note.content}</p>
                            {note.tags && note.tags.length > 0 && (
                              <p className="card-text"><small className="text-muted">Tags: {note.tags.join(', ')}</small></p>
                            )}
                            <p className="card-text"><small className="text-muted">Created: {new Date(note.createdAt).toLocaleDateString()}</small></p>
                            <p className="card-text"><small className="text-muted">Last Updated: {new Date(note.updatedAt).toLocaleDateString()}</small></p>
                            <button onClick={() => handleEditClick(note)} className="btn btn-primary btn-sm me-2">Edit</button>
                            <button onClick={() => handleDeleteNote(note.id)} className="btn btn-danger btn-sm">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notes;
