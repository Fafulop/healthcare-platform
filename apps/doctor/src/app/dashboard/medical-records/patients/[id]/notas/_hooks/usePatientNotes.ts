'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/lib/practice-toast';

export interface PatientNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function usePatientNotes(patientId: string) {
  // Data
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Editor state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Whisper
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/notes`);
      const data = await res.json();
      if (data.success) {
        setNotes(data.data);
      } else {
        toast.error(data.error || 'Error al cargar las notas');
      }
    } catch {
      toast.error('Error al cargar las notas');
    } finally {
      setLoadingNotes(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  // ─── Editor actions ─────────────────────────────────────────────────────────

  const selectNote = useCallback((note: PatientNote) => {
    setSelectedNoteId(note.id);
    setIsNewNote(false);
    setEditorContent(note.content);
    setIsDirty(false);
  }, []);

  const newNote = useCallback(() => {
    setSelectedNoteId(null);
    setIsNewNote(true);
    setEditorContent('');
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

  // ─── Save ───────────────────────────────────────────────────────────────────

  const saveNote = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNewNote) {
        const res = await fetch(`/api/medical-records/patients/${patientId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editorContent }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar');
        const created: PatientNote = data.data;
        setNotes((prev) => [created, ...prev]);
        setSelectedNoteId(created.id);
        setIsNewNote(false);
        setIsDirty(false);
      } else if (selectedNoteId) {
        const res = await fetch(
          `/api/medical-records/patients/${patientId}/notes/${selectedNoteId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editorContent }),
          }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar');
        const updated: PatientNote = data.data;
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setIsDirty(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la nota');
    } finally {
      setSaving(false);
    }
  }, [saving, isNewNote, selectedNoteId, editorContent, patientId]);

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const deleteNote = useCallback(async (id: string) => {
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/notes/${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) closeEditor();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar la nota');
    }
  }, [patientId, selectedNoteId, closeEditor]);

  // ─── Whisper ────────────────────────────────────────────────────────────────

  const toggleRecording = useCallback(async () => {
    if (recording) {
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

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    notes,
    loadingNotes,
    selectedNote,
    isNewNote,
    editorContent,
    isDirty,
    saving,
    handleContentChange,
    selectNote,
    newNote,
    closeEditor,
    saveNote,
    deleteNote,
    recording,
    transcribing,
    toggleRecording,
  };
}
