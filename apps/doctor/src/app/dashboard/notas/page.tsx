'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, NotebookPen } from 'lucide-react';
import { practiceConfirm } from '@/lib/practice-confirm';
import { useNotesPage } from './_hooks/useNotesPage';
import { NotesSidebar } from './_components/NotesSidebar';
import { NotesList } from './_components/NotesList';
import { NoteEditor } from './_components/NoteEditor';
import { CreateTaskFromNoteModal } from './_components/CreateTaskFromNoteModal';

export default function NotasPage() {
  const notesPage = useNotesPage();
  const {
    notes,
    temas,
    loadingNotes,
    filteredNotes,
    selectedNote,
    filterTemaId,
    filterSubtemaId,
    search,
    setSearch,
    setFilter,
    isNewNote,
    editorContent,
    editorTemaName,
    editorSubtemaName,
    isDirty,
    saving,
    handleContentChange,
    handleTemaChange,
    handleSubtemaChange,
    selectNote,
    newNote,
    closeEditor,
    saveNote,
    deleteNote,
    recording,
    transcribing,
    toggleRecording,
    showTaskModal,
    openTaskModal,
    closeTaskModal,
  } = notesPage;

  const editorOpen = isNewNote || selectedNote !== null;

  // Mobile: show sidebar or main panel
  const [mobileView, setMobileView] = useState<'sidebar' | 'main'>('sidebar');

  function handleSelectNote(note: Parameters<typeof selectNote>[0]) {
    selectNote(note);
    setMobileView('main');
  }

  async function handleNewNote() {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    newNote();
    setMobileView('main');
  }

  function handleCloseEditor() {
    closeEditor();
    setMobileView('sidebar');
  }

  // Sidebar navigation: always closes editor (with guard) and shows NotesList
  // On mobile also switches to main panel so the list becomes visible
  async function handleSetFilter(temaId: string | null, subtemaId?: string | null) {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    closeEditor();
    setFilter(temaId, subtemaId ?? null);
    setMobileView('main');
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-gray-300 hidden sm:inline">/</span>
          <div className="flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-gray-400" />
            <h1 className="text-base font-semibold text-gray-900">Notas</h1>
          </div>
        </div>
        <button
          onClick={handleNewNote}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          <span>+</span>
          <span>Nueva nota</span>
        </button>
      </div>

      {/* Body — two-panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — hidden on mobile when main panel is active */}
        <div
          className={`
            flex-shrink-0 w-56 border-r border-gray-200 bg-white overflow-y-auto
            ${mobileView === 'main' ? 'hidden md:flex md:flex-col' : 'flex flex-col w-full md:w-56'}
          `}
        >
          <NotesSidebar
            notes={notes}
            temas={temas}
            search={search}
            filterTemaId={filterTemaId}
            filterSubtemaId={filterSubtemaId}
            setSearch={setSearch}
            setFilter={handleSetFilter}
            onSearchActive={() => setMobileView('main')}
          />
        </div>

        {/* Main panel */}
        <div
          className={`
            flex-1 min-w-0 flex flex-col overflow-hidden bg-gray-50
            ${mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'}
          `}
        >
          {/* Mobile back button — only when no editor open (editor has its own X button with dirty guard) */}
          {!editorOpen && (
            <div className="md:hidden flex items-center px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
              <button
                onClick={handleCloseEditor}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Notas
              </button>
            </div>
          )}

          {editorOpen ? (
            <NoteEditor
              isNewNote={isNewNote}
              editorContent={editorContent}
              editorTemaName={editorTemaName}
              editorSubtemaName={editorSubtemaName}
              isDirty={isDirty}
              saving={saving}
              recording={recording}
              transcribing={transcribing}
              temas={temas}
              handleContentChange={handleContentChange}
              handleTemaChange={handleTemaChange}
              handleSubtemaChange={handleSubtemaChange}
              saveNote={saveNote}
              deleteNote={deleteNote}
              closeEditor={handleCloseEditor}
              openTaskModal={openTaskModal}
              selectedNoteId={selectedNote?.id ?? null}
              toggleRecording={toggleRecording}
            />
          ) : (
            <NotesList
              notes={filteredNotes}
              loading={loadingNotes}
              onSelectNote={handleSelectNote}
              hasFilter={filterTemaId !== null || search.trim() !== ''}
              selectedNoteId={selectedNote?.id ?? null}
            />
          )}
        </div>
      </div>

      {/* Task modal */}
      <CreateTaskFromNoteModal
        isOpen={showTaskModal}
        onClose={closeTaskModal}
        noteContent={editorContent}
      />
    </div>
  );
}
