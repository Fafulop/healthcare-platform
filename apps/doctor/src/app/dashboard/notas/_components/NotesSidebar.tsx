'use client';

import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import type { Note, NoteTema } from '../_hooks/useNotesPage';

interface Props {
  notes: Note[];
  temas: NoteTema[];
  search: string;
  filterTemaId: string | null;
  filterSubtemaId: string | null;
  setSearch: (v: string) => void;
  setFilter: (temaId: string | null, subtemaId?: string | null) => void;
}

export function NotesSidebar({
  notes,
  temas,
  search,
  filterTemaId,
  filterSubtemaId,
  setSearch,
  setFilter,
}: Props) {
  const [expandedTemas, setExpandedTemas] = useState<Set<string>>(new Set());

  function toggleExpand(temaId: string) {
    setExpandedTemas((prev) => {
      const next = new Set(prev);
      if (next.has(temaId)) next.delete(temaId);
      else next.add(temaId);
      return next;
    });
  }

  const totalCount = notes.length;
  const noTemaCount = notes.filter((n) => n.temaId === null).length;

  function subtemaCount(subtemaId: string) {
    return notes.filter((n) => n.subtemaId === subtemaId).length;
  }

  const isAllActive = filterTemaId === null && filterSubtemaId === null;
  const isNoTemaActive = filterTemaId === '__none__' && filterSubtemaId === null;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Nav tree */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* Todas */}
        <button
          onClick={() => setFilter(null)}
          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md transition-colors ${
            isAllActive ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>Todas</span>
          <span className="text-xs text-gray-400">{totalCount}</span>
        </button>

        {/* Sin tema */}
        <button
          onClick={() => setFilter('__none__')}
          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md transition-colors ${
            isNoTemaActive ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>Sin tema</span>
          <span className="text-xs text-gray-400">{noTemaCount}</span>
        </button>

        {/* Divider */}
        {temas.length > 0 && <div className="my-1.5 mx-3 border-t border-gray-100" />}

        {/* Temas */}
        {temas.map((tema) => {
          const expanded = expandedTemas.has(tema.id);
          const isTemaActive = filterTemaId === tema.id && filterSubtemaId === null;

          return (
            <div key={tema.id}>
              <div className="flex items-stretch">
                {/* Expand toggle — only show if has subtemas */}
                {tema.subtemas.length > 0 ? (
                  <button
                    onClick={() => toggleExpand(tema.id)}
                    className="flex items-center justify-center w-6 pl-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {expanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                ) : (
                  <div className="w-6 pl-2 flex-shrink-0" />
                )}

                {/* Tema row */}
                <button
                  onClick={() => setFilter(tema.id)}
                  className={`flex-1 flex items-center justify-between pr-3 py-1.5 text-sm rounded-r-md transition-colors text-left ${
                    isTemaActive ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{tema.name}</span>
                  <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{tema._count.notes}</span>
                </button>
              </div>

              {/* Subtemas */}
              {expanded && tema.subtemas.length > 0 && (
                <div className="ml-6">
                  {tema.subtemas.map((subtema) => {
                    const count = subtemaCount(subtema.id);
                    const isSubtemaActive = filterSubtemaId === subtema.id;
                    return (
                      <button
                        key={subtema.id}
                        onClick={() => setFilter(tema.id, subtema.id)}
                        className={`w-full flex items-center justify-between pl-3 pr-3 py-1.5 text-sm rounded-md transition-colors ${
                          isSubtemaActive ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{subtema.name}</span>
                        <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
