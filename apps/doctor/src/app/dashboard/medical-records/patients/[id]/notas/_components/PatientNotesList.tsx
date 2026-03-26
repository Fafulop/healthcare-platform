'use client';

import { Loader2, NotebookPen } from 'lucide-react';
import type { PatientNote } from '../_hooks/usePatientNotes';

interface Props {
  notes: PatientNote[];
  loading: boolean;
  selectedNoteId: string | null;
  onSelectNote: (note: PatientNote) => void;
}

function relativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseContent(content: string): { title: string; excerpt: string } {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  return {
    title: lines[0] || 'Nota vacía',
    excerpt: lines[1] || '',
  };
}

export function PatientNotesList({ notes, loading, selectedNoteId, onSelectNote }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando notas...</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-gray-400 gap-3 px-6 text-center">
        <NotebookPen className="w-8 h-8 text-gray-300" />
        <p className="text-sm">No hay notas para este paciente</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
      {notes.map((note) => {
        const { title, excerpt } = parseContent(note.content);
        const isActive = note.id === selectedNoteId;
        return (
          <button
            key={note.id}
            onClick={() => onSelectNote(note)}
            className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
              isActive
                ? 'bg-white border-gray-900'
                : 'hover:bg-white border-transparent'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 truncate flex-1 leading-snug">
                {title}
              </p>
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                {relativeDate(note.updatedAt)}
              </span>
            </div>
            {excerpt && (
              <p className="text-xs text-gray-400 truncate mt-0.5 leading-snug">
                {excerpt}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
