'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Plus, NotebookPen, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePatientNotes } from './_hooks/usePatientNotes';
import { PatientNotesList } from './_components/PatientNotesList';
import { PatientNoteEditor } from './_components/PatientNoteEditor';
import { practiceConfirm } from '@/lib/practice-confirm';
import { etiquetaVisita, visitaHref } from '@/lib/visitas-ui';
import { SelectorDeVisita } from '@/components/medical-records/visitas/SelectorDeVisita';
import { useVisitaElegida } from '@/components/medical-records/visitas/useVisitaElegida';
import { VisitaDelElemento } from '@/components/medical-records/visitas/VisitaDelElemento';

export default function PatientNotasPage() {
  const params = useParams();
  const patientId = params.id as string;
  // VISITAS D4 — «Nueva nota» from a visit arrives with `?visitaId=`: it opens a new note that is
  // created in that visit, and «Volver» goes back to it.
  const searchParams = useSearchParams();
  const visitaId = searchParams.get('visitaId');
  // «+ Nueva nota» de la tarjeta del expediente llega con `?nueva=1`: abre una nota en blanco.
  const abrirNueva = !!visitaId || searchParams.get('nueva') === '1';
  const volverHref = visitaId
    ? visitaHref(patientId, visitaId)
    : `/dashboard/medical-records/patients/${patientId}`;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  // VISITAS D5 — desde Notas (sin visita fija), la nota NUEVA pregunta «¿A qué visita pertenece?».
  // D5b — una nota YA guardada se puede mover de visita (también si se llegó desde una visita).
  const conVisitas = !!session?.user?.doctorId;
  const elegirVisita = conVisitas && !visitaId;
  const visita = useVisitaElegida(patientId, conVisitas);
  const [moviendo, setMoviendo] = useState(false);

  const {
    notes,
    loadingNotes,
    selectedNote,
    isNewNote,
    editorContent,
    isDirty,
    saving,
    recording,
    transcribing,
    handleContentChange,
    selectNote,
    newNote,
    closeEditor,
    saveNote,
    deleteNote,
    moverNota,
    toggleRecording,
  } = usePatientNotes(patientId, visitaId ?? (elegirVisita ? visita.elegida || null : null));

  // Mobile: show list or editor
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const isEditorOpen = isNewNote || selectedNote !== null;

  // Coming from a visit (or «+ Nueva nota») means coming to WRITE: open the new note right away (once).
  const abrioNueva = useRef(false);
  useEffect(() => {
    if (abrirNueva && !abrioNueva.current) {
      abrioNueva.current = true;
      newNote();
      setMobileView('editor');
    }
  }, [abrirNueva, newNote]);

  // D5b — mover la nota abierta: pregunta primero (como «Mover a…» de las plantillas) y mueve ya.
  async function handleMoverNota(destino: string) {
    if (!selectedNote || destino === (selectedNote.visitaId ?? '')) return;
    const v = visita.visitas.find((x) => x.id === destino);
    const texto = v ? `a la ${etiquetaVisita(v)}` : 'a «Sin visita»';
    const ok = await practiceConfirm(`Se moverá ${texto}. El texto de la nota no cambia.`, '¿Mover la nota?');
    if (!ok) return;
    setMoviendo(true);
    await moverNota(selectedNote.id, destino || null);
    setMoviendo(false);
  }

  async function handleSelectNote(note: Parameters<typeof selectNote>[0]) {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    selectNote(note);
    setMobileView('editor');
  }

  async function handleNewNote() {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    newNote();
    setMobileView('editor');
  }

  async function handleCloseEditor() {
    if (isDirty) {
      const ok = await practiceConfirm('¿Descartar los cambios sin guardar?', 'Cambios sin guardar');
      if (!ok) return;
    }
    closeEditor();
    setMobileView('list');
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile: back to list when in editor */}
          {mobileView === 'editor' && (
            <button
              onClick={handleCloseEditor}
              className="sm:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {mobileView === 'list' && (
            <Link
              href={volverHref}
              className="sm:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          {/* Desktop back link */}
          <Link
            href={volverHref}
            className="hidden sm:inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{visitaId ? 'Volver a la Visita' : 'Volver al Paciente'}</span>
          </Link>
          <div className="hidden sm:block w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h1 className="text-lg font-semibold text-gray-900">Notas del Paciente</h1>
          </div>
        </div>
        <button
          onClick={handleNewNote}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Nota</span>
        </button>
      </div>

      {visitaId && (
        <div className="px-4 sm:px-6 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-800 flex-shrink-0">
          Las notas nuevas que escribas aquí se guardan en la visita.{' '}
          <Link href={volverHref} className="underline">Volver a la visita</Link>
        </div>
      )}

      {/* Body: two-panel desktop, stacked mobile */}
      <div className="flex flex-1 min-h-0">
        {/* List panel */}
        <div
          className={`flex flex-col border-r border-gray-200 bg-gray-50 ${
            mobileView === 'editor' ? 'hidden sm:flex' : 'flex'
          } w-full sm:w-72 lg:w-80 flex-shrink-0`}
        >
          <PatientNotesList
            notes={notes}
            loading={loadingNotes}
            selectedNoteId={selectedNote?.id ?? null}
            onSelectNote={handleSelectNote}
          />
        </div>

        {/* Editor panel */}
        <div
          className={`flex-1 min-w-0 ${
            mobileView === 'list' ? 'hidden sm:flex' : 'flex'
          } flex-col`}
        >
          {isEditorOpen ? (
            <PatientNoteEditor
              isNewNote={isNewNote}
              editorContent={editorContent}
              isDirty={isDirty}
              saving={saving}
              recording={recording}
              transcribing={transcribing}
              selectedNoteId={selectedNote?.id ?? null}
              handleContentChange={handleContentChange}
              saveNote={saveNote}
              deleteNote={deleteNote}
              closeEditor={handleCloseEditor}
              toggleRecording={toggleRecording}
              selectorDeVisita={elegirVisita && isNewNote ? (
                <SelectorDeVisita
                  compacto
                  visitas={visita.visitas}
                  estado={visita.estado}
                  value={visita.elegida}
                  onChange={visita.elegir}
                  disabled={saving}
                />
              ) : conVisitas && selectedNote && visita.estado !== 'ok' ? (
                // Sin las visitas cargadas el selector diría «Ninguna» de una nota que SÍ tiene
                // visita (code review de D5b): se muestra en lectura.
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  Visita:
                  <VisitaDelElemento
                    patientId={patientId}
                    visitaId={selectedNote.visitaId}
                    visitas={visita.visitas}
                    estado={visita.estado}
                  />
                </span>
              ) : conVisitas && selectedNote ? (
                <SelectorDeVisita
                  compacto
                  visitas={visita.visitas}
                  estado={visita.estado}
                  value={selectedNote.visitaId ?? ''}
                  onChange={handleMoverNota}
                  disabled={saving || moviendo}
                />
              ) : undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
              <NotebookPen className="w-10 h-10 text-gray-200" />
              <p className="text-sm">Selecciona una nota o crea una nueva</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
