'use client';

import { useRef, useEffect, useState } from 'react';
import { Mic, Square, Loader2, X, Trash2, CheckSquare, Check } from 'lucide-react';
import { practiceConfirm } from '@/lib/practice-confirm';
import { TemaCombobox } from './TemaCombobox';
import { SubtemaCombobox } from './SubtemaCombobox';
import type { NoteTema } from '../_hooks/useNotesPage';

interface Props {
  isNewNote: boolean;
  editorContent: string;
  editorTemaName: string;
  editorSubtemaName: string;
  isDirty: boolean;
  saving: boolean;
  recording: boolean;
  transcribing: boolean;
  temas: NoteTema[];
  selectedNoteId: string | null;
  handleContentChange: (v: string) => void;
  handleTemaChange: (v: string) => void;
  handleSubtemaChange: (v: string) => void;
  saveNote: () => void;
  deleteNote: (id: string) => void;
  closeEditor: () => void;
  openTaskModal: () => void;
  toggleRecording: () => void;
}

export function NoteEditor({
  isNewNote,
  editorContent,
  editorTemaName,
  editorSubtemaName,
  isDirty,
  saving,
  recording,
  transcribing,
  temas,
  selectedNoteId,
  handleContentChange,
  handleTemaChange,
  handleSubtemaChange,
  saveNote,
  deleteNote,
  closeEditor,
  openTaskModal,
  toggleRecording,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const prevSavingRef = useRef(false);
  const [justSaved, setJustSaved] = useState(false);

  // Split content into title (first line) and body (rest)
  const firstNewline = editorContent.indexOf('\n');
  const titleValue = firstNewline === -1 ? editorContent : editorContent.slice(0, firstNewline);
  const bodyValue = firstNewline === -1 ? '' : editorContent.slice(firstNewline + 1);

  function onTitleChange(v: string) {
    // Titles can't contain newlines — strip them
    handleContentChange(v.replace(/\n/g, '') + '\n' + bodyValue);
  }

  function onBodyChange(v: string) {
    handleContentChange(titleValue + '\n' + v);
  }

  // Auto-focus title on open + reset save feedback state
  useEffect(() => {
    titleRef.current?.focus();
    setJustSaved(false);
    prevSavingRef.current = false;
  }, [isNewNote, selectedNoteId]);

  // Auto-grow body textarea
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [bodyValue]);

  // "Guardado ✓" feedback: fires when saving transitions false→true→false with isDirty=false
  useEffect(() => {
    if (prevSavingRef.current && !saving && !isDirty) {
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timer);
    }
    prevSavingRef.current = saving;
  }, [saving, isDirty]);

  function handleSaveShortcut(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isDirty && !saving && !recording && !transcribing) saveNote();
    }
  }

  async function handleClose() {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    closeEditor();
  }

  async function handleDelete() {
    if (!selectedNoteId) return;
    const ok = await practiceConfirm('¿Eliminar esta nota? Esta acción no se puede deshacer.', 'Eliminar nota');
    if (!ok) return;
    deleteNote(selectedNoteId);
  }

  const temasFlat = temas.map((t) => ({ id: t.id, name: t.name }));
  const currentTema = temas.find(
    (t) => t.name.toLowerCase() === editorTemaName.toLowerCase()
  );
  const subtemasForTema = currentTema?.subtemas ?? [];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar: tema/subtema + close/delete */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
          <TemaCombobox
            value={editorTemaName}
            onChange={handleTemaChange}
            temas={temasFlat}
          />
          <SubtemaCombobox
            value={editorSubtemaName}
            onChange={handleSubtemaChange}
            subtemas={subtemasForTema}
            disabled={editorTemaName.trim() === ''}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedNoteId && (
            <button
              onClick={handleDelete}
              title="Eliminar nota"
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleClose}
            title="Cerrar"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area: scrolls as a unit */}
      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <div className="px-5 pt-4 pb-1">
          <input
            ref={titleRef}
            type="text"
            value={titleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus(); }
              handleSaveShortcut(e);
            }}
            placeholder="Título (opcional)"
            className="w-full text-lg font-semibold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent"
          />
        </div>

        {/* Divider only when title has content */}
        {titleValue.trim() !== '' && (
          <div className="mx-5 border-t border-gray-100" />
        )}

        {/* Body */}
        <div className="px-5 py-3">
          <textarea
            ref={bodyRef}
            value={bodyValue}
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={handleSaveShortcut}
            placeholder="Escribe tu nota aquí..."
            rows={4}
            className="w-full resize-none border-none outline-none text-sm text-gray-700 leading-relaxed placeholder-gray-300 bg-transparent"
            style={{ minHeight: '120px' }}
          />
        </div>
      </div>

      {/* Bottom bar: whisper + task + save */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
        {/* Whisper */}
        <button
          onClick={toggleRecording}
          disabled={transcribing}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
            recording
              ? 'border-red-200 bg-red-50 text-red-600'
              : transcribing
              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {transcribing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transcribiendo...</span>
            </>
          ) : recording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <Square className="w-3.5 h-3.5" />
              <span>Detener</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Dictar</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Create task */}
          <button
            onClick={openTaskModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Crear tarea</span>
          </button>

          {/* Save */}
          <button
            onClick={saveNote}
            disabled={!isDirty || saving || recording || transcribing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:cursor-not-allowed ${
              justSaved
                ? 'bg-green-600 text-white opacity-100'
                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40'
            }`}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : justSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Guardado</span>
              </>
            ) : (
              <span>Guardar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
