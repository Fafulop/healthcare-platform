"use client";

import { Loader2, Save, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import { TaskChatPanel } from '@/components/tasks/TaskChatPanel';
import { useNewTask } from './useNewTask';

export default function NewTaskPage() {
  const {
    session,
    authStatus,
    form,
    setForm,
    patientSearch,
    setPatientSearch,
    filteredPatients,
    saving,
    error,
    successMessage,
    taskConflicts,
    conflictDialogOpen,
    setConflictDialogOpen,
    modalOpen,
    setModalOpen,
    sidebarOpen,
    setSidebarOpen,
    sidebarInitialData,
    chatPanelOpen,
    setChatPanelOpen,
    accumulatedTasks,
    handleSubmit,
    handleStartTimeChange,
    handleEndTimeChange,
    handleModalComplete,
    handleVoiceConfirm,
    handleChatTaskUpdates,
    handleChatBatchCreate,
  } = useNewTask();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/pendientes"
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Pendientes
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Tarea</h1>
            <p className="text-gray-600 mt-1">Crea una nueva tarea pendiente</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatPanelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Chat IA
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Success message with appointment overlap warning */}
      {successMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-blue-700 whitespace-pre-line flex-1">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titulo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Revisar resultados de laboratorio"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Detalles adicionales..."
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de inicio (opcional)
                  {form.endTime && !form.startTime && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={form.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">--:--</option>
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = String(Math.floor(i / 2)).padStart(2, '0');
                    const m = i % 2 === 0 ? '00' : '30';
                    return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de fin (opcional)
                  {form.startTime && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={form.endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">--:--</option>
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = String(Math.floor(i / 2)).padStart(2, '0');
                    const m = i % 2 === 0 ? '00' : '30';
                    return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Priority and Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SEGUIMIENTO">Seguimiento</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="LABORATORIO">Laboratorio</option>
                  <option value="RECETA">Receta</option>
                  <option value="REFERENCIA">Referencia</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
            </div>

            {/* Patient (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente (opcional)</label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Buscar paciente..."
              />
              <select
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin paciente</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.internalId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Link
              href="/dashboard/pendientes"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-center transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Tarea
            </button>
          </div>
        </div>
      </form>

      {/* Task Conflict Dialog */}
      {conflictDialogOpen && taskConflicts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ⚠️ Conflicto de Horario
              </h3>
              <p className="text-gray-700 mb-4">{taskConflicts.error}</p>

              {taskConflicts.taskConflicts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    Pendientes en conflicto:
                  </p>
                  <div className="space-y-2">
                    {taskConflicts.taskConflicts.map((task: any) => (
                      <div key={task.id} className="text-sm text-red-700">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs">
                          {task.dueDate} • {task.startTime} - {task.endTime}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-4">
                Por favor, ajusta el horario de tu tarea o cancela el pendiente existente.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setConflictDialogOpen(false);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_TASK"
          context={{ doctorId: session.user.doctorId }}
          onComplete={handleModalComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionType="NEW_TASK"
          patientId=""
          doctorId={session.user.doctorId}
          context={{ doctorId: session.user.doctorId }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}

      {/* Task Chat IA Panel */}
      {chatPanelOpen && (
        <TaskChatPanel
          onClose={() => setChatPanelOpen(false)}
          accumulatedTasks={accumulatedTasks}
          onUpdateTasks={handleChatTaskUpdates}
          onCreateBatch={handleChatBatchCreate}
        />
      )}
    </div>
  );
}
