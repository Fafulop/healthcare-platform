'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteLabel {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  content: string;
  temaId: string | null;
  subtemaId: string | null;
  tema: NoteLabel | null;
  subtema: NoteLabel | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteSubtema {
  id: string;
  name: string;
}

export interface NoteTema {
  id: string;
  name: string;
  subtemas: NoteSubtema[];
  _count: { notes: number };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotesPage() {
  // Data
  const [notes, setNotes] = useState<Note[]>([]);
  const [temas, setTemas] = useState<NoteTema[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Sidebar filter
  const [filterTemaId, setFilterTemaId] = useState<string | null>(null);
  const [filterSubtemaId, setFilterSubtemaId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Editor state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorTemaName, setEditorTemaName] = useState('');
  const [editorSubtemaName, setEditorSubtemaName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Whisper
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await authFetch('/api/notes');
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } catch {
      toast.error('Error al cargar las notas');
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  const fetchTemas = useCallback(async () => {
    try {
      const res = await authFetch('/api/notes/temas');
      const data = await res.json();
      if (data.success) setTemas(data.data);
    } catch {
      // Non-blocking — sidebar just won't show temas
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    fetchTemas();
  }, [fetchNotes, fetchTemas]);

  // ─── Derived state ──────────────────────────────────────────────────────────

  const filteredNotes = notes.filter((note) => {
    if (filterSubtemaId && note.subtemaId !== filterSubtemaId) return false;
    if (!filterSubtemaId && filterTemaId) {
      if (filterTemaId === '__none__') {
        if (note.temaId !== null) return false;
      } else {
        if (note.temaId !== filterTemaId) return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      const inContent = note.content.toLowerCase().includes(q);
      const inTema = note.tema?.name.toLowerCase().includes(q) ?? false;
      const inSubtema = note.subtema?.name.toLowerCase().includes(q) ?? false;
      if (!inContent && !inTema && !inSubtema) return false;
    }
    return true;
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  // ─── Editor actions ─────────────────────────────────────────────────────────

  const loadNoteIntoEditor = useCallback((note: Note) => {
    setSelectedNoteId(note.id);
    setIsNewNote(false);
    setEditorContent(note.content);
    setEditorTemaName(note.tema?.name ?? '');
    setEditorSubtemaName(note.subtema?.name ?? '');
    setIsDirty(false);
  }, []);

  const selectNote = useCallback((note: Note) => {
    loadNoteIntoEditor(note);
  }, [loadNoteIntoEditor]);

  const newNote = useCallback(() => {
    setSelectedNoteId(null);
    setIsNewNote(true);
    setEditorContent('');
    setEditorTemaName('');
    setEditorSubtemaName('');
    setIsDirty(false);
  }, []);

  const closeEditor = useCallback(() => {
    setSelectedNoteId(null);
    setIsNewNote(false);
    setIsDirty(false);
  }, []);

  const handleContentChange = useCallback((value: string) => {
    setEditorContent(value);
    setIsDirty(true);
  }, []);

  const handleTemaChange = useCallback((name: string) => {
    setEditorTemaName(name);
    // Clear subtema if tema changes
    setEditorSubtemaName('');
    setIsDirty(true);
  }, []);

  const handleSubtemaChange = useCallback((name: string) => {
    setEditorSubtemaName(name);
    setIsDirty(true);
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────

  const saveNote = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const body = {
        content: editorContent,
        temaName: editorTemaName || undefined,
        subtemaName: editorSubtemaName || undefined,
      };

      if (isNewNote) {
        const res = await authFetch('/api/notes', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar');
        const created: Note = data.data;
        setNotes((prev) => [created, ...prev]);
        setSelectedNoteId(created.id);
        setIsNewNote(false);
        setIsDirty(false);
        await fetchTemas();
      } else if (selectedNoteId) {
        const res = await authFetch(`/api/notes/${selectedNoteId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar');
        const updated: Note = data.data;
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setIsDirty(false);
        await fetchTemas();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la nota');
    } finally {
      setSaving(false);
    }
  }, [saving, isNewNote, selectedNoteId, editorContent, editorTemaName, editorSubtemaName, fetchTemas]);

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const deleteNote = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/notes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) closeEditor();
      await fetchTemas();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar la nota');
    }
  }, [selectedNoteId, closeEditor, fetchTemas]);

  // ─── Sidebar filters ────────────────────────────────────────────────────────

  const setFilter = useCallback((temaId: string | null, subtemaId: string | null = null) => {
    setFilterTemaId(temaId);
    setFilterSubtemaId(subtemaId);
  }, []);

  // ─── Whisper ────────────────────────────────────────────────────────────────

  const toggleRecording = useCallback(async () => {
    if (recording) {
      // Stop recording — onstop will handle transcription
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.data.transcript) {
            setEditorContent((prev) =>
              prev ? `${prev}\n${data.data.transcript}` : data.data.transcript
            );
            setIsDirty(true);
          } else {
            toast.error(data.error?.message || 'No se pudo transcribir el audio');
          }
        } catch {
          toast.error('Error al transcribir el audio');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error('No se pudo acceder al micrófono');
    }
  }, [recording]);

  // ─── Task modal ─────────────────────────────────────────────────────────────

  const openTaskModal = useCallback(() => setShowTaskModal(true), []);
  const closeTaskModal = useCallback(() => setShowTaskModal(false), []);

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    // Data
    notes,
    temas,
    loadingNotes,

    // Derived
    filteredNotes,
    selectedNote,

    // Sidebar filters
    filterTemaId,
    filterSubtemaId,
    search,
    setSearch,
    setFilter,

    // Editor state
    isNewNote,
    editorContent,
    editorTemaName,
    editorSubtemaName,
    isDirty,
    saving,
    handleContentChange,
    handleTemaChange,
    handleSubtemaChange,

    // Editor actions
    selectNote,
    newNote,
    closeEditor,
    saveNote,
    deleteNote,

    // Whisper
    recording,
    transcribing,
    toggleRecording,

    // Task modal
    showTaskModal,
    openTaskModal,
    closeTaskModal,
  };
}
