'use client';

import { Loader2, NotebookPen } from 'lucide-react';
import type { Note } from '../_hooks/useNotesPage';

interface Props {
  notes: Note[];
  loading: boolean;
  onSelectNote: (note: Note) => void;
  hasFilter: boolean;
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
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function firstLine(content: string): string {
  return content.split('\n')[0]?.trim() || 'Nota vacía';
}

export function NotesList({ notes, loading, onSelectNote, hasFilter }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando notas...</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3 px-6 text-center">
        <NotebookPen className="w-8 h-8 text-gray-300" />
        <p className="text-sm">
          {hasFilter ? 'Sin resultados para este filtro' : 'No hay notas'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelectNote(note)}
          className="w-full text-left px-4 py-3 hover:bg-white transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 truncate flex-1 leading-snug">
              {firstLine(note.content)}
            </p>
            <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
              {relativeDate(note.updatedAt)}
            </span>
          </div>
          {(note.tema || note.subtema) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {note.tema && (
                <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                  {note.tema.name}
                </span>
              )}
              {note.subtema && (
                <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                  {note.subtema.name}
                </span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
