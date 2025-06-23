import React, { useState, useEffect, useCallback, ChangeEvent, useMemo } from 'react';
import { db, auth } from './firebase'; // Import db and auth instances
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  where, // Import where for filtering
} from 'firebase/firestore'; // Firestore imports
import { onAuthStateChanged, User, signOut } from 'firebase/auth'; // Auth imports
import LoginPage from './LoginPage'; // Import the LoginPage component
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import './App.css';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt?: Timestamp; // Optional: for sorting or display
  lastModified?: Timestamp;
  userId?: string; // To associate note with a user
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true); // For initial auth check
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false); // Tracks if current form has unsaved changes
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Memoize notesCollectionRef to ensure it's stable across renders
  const notesCollectionRef = useMemo(() => collection(db, 'notepad'), []);
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        // Clear notes and selection if user logs out
        setNotes([]);
        setSelectedNote(null);
      }
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const fetchNotes = useCallback(async (user: User | null) => {
    // This function should now only be called if user is non-null by the calling useEffect
    if (!user) {
      // Safety guard, though the calling useEffect should prevent this.
      // If somehow called with null, ensure loading is false and notes are clear.
      setNotes([]); // Already handled by onAuthStateChanged and the other useEffect
      setIsLoading(false); // Ensure loading is off
      return;
    }
    setIsLoading(true);
    try {
      // Filter notes by the current user's ID and order them
      const q = query(notesCollectionRef, where("userId", "==", user.uid), orderBy('lastModified', 'desc'));
      const data = await getDocs(q);
      const fetchedNotesData: Note[] = data.docs.map((doc) => ({
        ...(doc.data() as Omit<Note, 'id'>),
        id: doc.id,
      }));
      setNotes(fetchedNotesData);
      // Logic for adjusting selectedNote is moved to a separate useEffect
    } catch (error) {
      console.error('Error fetching notes: ', error);
      // Consider setting an error state here to display to the user
    } finally {
      setIsLoading(false); // Ensure isLoading is set to false in all cases
    }
  }, [notesCollectionRef]); // Dependency is stable

  useEffect(() => {
    if (currentUser) { // Only fetch notes if a user is logged in
      fetchNotes(currentUser);
    } else {
      // User is logged out or not yet authenticated
      // onAuthStateChanged handles clearing notes and selectedNote from a data perspective.
      // This block ensures UI states like isLoading and form fields are also reset.
      setIsLoading(false); // Turn off notes loading indicator
      setCurrentTitle('');   // Clear form
      setCurrentContent('');
      setIsDirty(false);
    }
  }, [fetchNotes, currentUser]);

  // Effect to adjust selectedNote if it's removed from the notes list
  useEffect(() => {
    if (selectedNote && !notes.find(note => note.id === selectedNote.id)) {
      setSelectedNote(null);
      // Also clear the form when the selected note is gone
      setCurrentTitle('');
      setCurrentContent('');
      setIsDirty(false);
    }
  }, [notes, selectedNote]);

  // Effect to track if the current note form is dirty
  useEffect(() => {
    if (selectedNote) {
      const originalNoteInState = notes.find(n => n.id === selectedNote.id);
      if (originalNoteInState) {
        if (currentTitle !== originalNoteInState.title || currentContent !== originalNoteInState.content) {
          setIsDirty(true);
        } else {
          setIsDirty(false);
        }
      }
    } else {
      setIsDirty(false); // No selected note, so not dirty
    }
  }, [currentTitle, currentContent, selectedNote, notes]);

  const saveCurrentNote = useCallback(async () => {
    if (!selectedNote || !isDirty) return;

    setIsSaving(true);
    try {
      const noteDocRef = doc(db, 'notepad', selectedNote.id);
      const updatedNoteData = { 
        title: currentTitle, 
        content: currentContent,
        lastModified: Timestamp.now()
      };
      await updateDoc(noteDocRef, updatedNoteData);
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, ...updatedNoteData } : n));
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving note:', error);
    }
    setIsSaving(false);
  }, [selectedNote, currentTitle, currentContent, isDirty]);

  // Auto-save effect
  useEffect(() => {
    if (isDirty && selectedNote && !isSaving) {
      const timer = setTimeout(() => {
        saveCurrentNote();
      }, 1500); // Debounce: save 1.5s after last change if dirty
      return () => clearTimeout(timer);
    }
  }, [isDirty, selectedNote, saveCurrentNote, isSaving]);

  const handleSelectNote = async (noteToSelect: Note) => {
    if (selectedNote && selectedNote.id !== noteToSelect.id && isDirty) {
      await saveCurrentNote(); // Save previous note if dirty before switching
    }
    setSelectedNote(noteToSelect);
    setCurrentTitle(noteToSelect.title);
    setCurrentContent(noteToSelect.content);
    setIsDirty(false); // Reset dirty state as we just loaded the note
  };

  const handleAddNewNote = async () => {
    if (selectedNote && isDirty) {
      await saveCurrentNote(); // Save current note if dirty
    }
    
    if (!currentUser) {
      console.error("No user logged in. Cannot add note.");
      return;
    }

    const newNoteData = { 
      title: 'Untitled Note', 
      content: '', 
      createdAt: Timestamp.now(),
      lastModified: Timestamp.now(),
      userId: currentUser.uid // Associate note with the current user
    };
    setIsSaving(true);
    try {
      const docRef = await addDoc(notesCollectionRef, newNoteData);
      const newNote: Note = { id: docRef.id, ...newNoteData };
      setNotes(prevNotes => [newNote, ...prevNotes]); // Add to beginning for immediate visibility
      handleSelectNote(newNote); // Select the new note
    } catch (error) {
      console.error('Error adding new note: ', error);
    }
    setIsSaving(false);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setNoteToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    // Use isSaving to indicate any backend activity and disable buttons
    setIsSaving(true); // Use isSaving to indicate any backend activity
    try {
      const noteDoc = doc(db, 'notepad', noteToDelete);
      await deleteDoc(noteDoc);
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteToDelete));
      if (selectedNote && selectedNote.id === noteToDelete) {
        setSelectedNote(null);
        setCurrentTitle('');
        setCurrentContent('');
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setIsSaving(false);
      handleCloseDeleteModal(); // Close modal and reset state
    }
  };

  const handleDeleteNote = (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent li onClick from firing
    setNoteToDelete(noteId);
    setShowDeleteModal(true);
  };

  
  // const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
  //   setCurrentTitle(e.target.value);
  // };

  // const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
  //   setCurrentContent(e.target.value);
  // };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will handle clearing user state and notes
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (authLoading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="container-fluid vh-100 d-flex flex-column py-3">
      <div className="row mb-3">
        <div className="col d-flex justify-content-between align-items-center">
          <button className="btn btn-primary" onClick={handleAddNewNote} disabled={isSaving}>
            <i className="bi bi-plus-lg me-2"></i>New Note
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>Logout</button>
          {isSaving && <span className="ms-2 text-muted">Saving...</span>}
        </div>
      </div>
      <div className="row flex-grow-1" style={{ minHeight: 0 }}> {/* Ensure row can shrink and grow */}
        <div className="col-md-3 d-flex flex-column">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5>Notes List</h5>      
            {isLoading && <p>Loading notes...</p>}      
          </div>
          
          {!isLoading && notes.length === 0 && <p>No notes yet. Click "New Note" to start.</p>}
          <ul className="list-group overflow-auto"> {/* Make list scrollable */}
            {notes.map((note) => (
              <li
                key={note.id}
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedNote?.id === note.id ? 'active' : ''}`}
                onClick={() => handleSelectNote(note)}
                style={{ cursor: 'pointer' }}
              >
                {note.title}
                <button 
                  className="btn btn-sm btn-outline-danger"
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  disabled={isSaving}
                >
                  <i className="fa fa-trash-o"></i>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-9 d-flex flex-column">
          {selectedNote ? (
            <>
              <input
                type="text"
                className="form-control mb-2"
                value={currentTitle}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentTitle(e.target.value)}
                placeholder="Note Title"
                disabled={isSaving}
              />
              {/* <textarea
                className="form-control flex-grow-1" // Make textarea fill available space
                value={currentContent}
                onChange={handleContentChange}
                placeholder="Start typing your notes here..."
                aria-label="Text editor"
                disabled={isSaving}
                style={{ resize: 'none' }} // Optional: disable manual resize
              /> */}
              {/* CKEditor container to manage flex growth */}
              <div className="ckeditor-container flex-grow-1 mb-2" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <CKEditor
                  editor={ClassicEditor as any}
                  data={currentContent}
                  config={{
                    placeholder: "Start typing your notes here...",
                    // You can add more CKEditor configurations here if needed
                    // For example, to remove certain plugins or customize the toolbar:
                    // toolbar: [ 'heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote' ],
                  }}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    setCurrentContent(data);
                  }}
                  disabled={isSaving}
                />
              </div>
            </>
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              <p>Select a note to edit, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Deletion</h5>
                  <button type="button" className="btn-close" onClick={handleCloseDeleteModal} aria-label="Close" disabled={isSaving}></button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete this note? This action cannot be undone.</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseDeleteModal} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleConfirmDelete} disabled={isSaving}>
                    {isSaving ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}



export default App;
