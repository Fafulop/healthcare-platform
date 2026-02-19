"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
// ConflictDialog no longer needed - simplified to inline dialog
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceStructuredData, VoiceTaskData } from '@/types/voice-assistant';
import { TaskChatPanel } from '@/components/tasks/TaskChatPanel';
import type { TaskFormData } from '@/hooks/useTaskChat';

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

// Helper to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to map voice data to form data
function mapVoiceToFormData(voiceData: VoiceTaskData) {
  return {
    title: voiceData.title || '',
    description: voiceData.description || '',
    dueDate: voiceData.dueDate || '',
    startTime: voiceData.startTime || '',
    endTime: voiceData.endTime || '',
    priority: voiceData.priority || 'MEDIA',
    category: voiceData.category || 'OTRO',
    patientId: voiceData.patientId || '',
  };
}

// Simplified conflict handling - server-side only
interface TaskConflictData {
  taskConflicts: any[];
  error: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");

  // Simplified conflict state (server-side only)
  const [taskConflicts, setTaskConflicts] = useState<TaskConflictData | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Voice assistant state
  const [modalOpen, setModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);
  const [voiceDataApplied, setVoiceDataApplied] = useState(false);
  const [showAIBanner, setShowAIBanner] = useState(false);
  const [aiMetadata, setAIMetadata] = useState<{
    sessionId: string;
    transcriptId: string;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);

  // Chat IA state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [accumulatedTasks, setAccumulatedTasks] = useState<VoiceTaskData[]>([]);

  // Auto-open chat panel from hub widget
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    startTime: "",
    endTime: "",
    priority: "MEDIA",
    category: "OTRO",
    patientId: "",
  });

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchPatients();
    }
  }, [authStatus]);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/medical-records/patients?status=active");
      const result = await res.json();
      if (res.ok) {
        setPatients(result.data || []);
      }
    } catch {
      // non-critical
    }
  };

  // Computed form data for chat panel
  const chatFormData: TaskFormData = useMemo(() => ({
    title: form.title,
    description: form.description,
    dueDate: form.dueDate,
    startTime: form.startTime,
    endTime: form.endTime,
    priority: form.priority,
    category: form.category,
  }), [form.title, form.description, form.dueDate, form.startTime, form.endTime, form.priority, form.category]);

  // Chat IA callbacks
  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const handleChatTaskUpdates = useCallback((tasks: VoiceTaskData[]) => {
    setAccumulatedTasks(tasks);
  }, []);

  const handleChatBatchCreate = useCallback(() => {
    if (accumulatedTasks.length === 0) return;
    executeBatchCreation(accumulatedTasks);
    setAccumulatedTasks([]);
    setChatPanelOpen(false);
  }, [accumulatedTasks]);

  // Handle modal completion - transition to sidebar with initial data
  const handleModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoiceTaskData;

    // Calculate extracted fields
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceTaskData] != null &&
           voiceData[k as keyof VoiceTaskData] !== ''
    );

    // Prepare initial data for sidebar
    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    // Close modal, set initial data, and open sidebar
    setModalOpen(false);
    setSidebarInitialData(initialData);
    setSidebarOpen(true);
  }, []);

  // Handle voice chat confirm - populate form or batch create
  const handleVoiceConfirm = useCallback(async (data: VoiceStructuredData) => {
    // Check if this is a batch
    const batchData = data as any;
    if (batchData.isBatch && Array.isArray(batchData.entries) && batchData.entries.length > 0) {
      setSaving(true);
      setError(null);
      setSidebarOpen(false);
      setSidebarInitialData(undefined);

      const entries = batchData.entries as VoiceTaskData[];

      // No client-side conflict checking - server handles it per task
      await executeBatchCreation(entries);
      return;
    }

    // Single task: populate form
    const voiceData = data as VoiceTaskData;
    const mappedData = mapVoiceToFormData(voiceData);

    setForm(mappedData);
    setVoiceDataApplied(true);

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(k => voiceData[k as keyof VoiceTaskData] != null && voiceData[k as keyof VoiceTaskData] !== '');
    const empty = allFields.filter(k => voiceData[k as keyof VoiceTaskData] == null || voiceData[k as keyof VoiceTaskData] === '');

    setAIMetadata({
      sessionId: crypto.randomUUID(),
      transcriptId: crypto.randomUUID(),
      fieldsExtracted: extracted,
      fieldsEmpty: empty,
      confidence: extracted.length > 4 ? 'high' : extracted.length > 2 ? 'medium' : 'low',
    });

    setShowAIBanner(true);
    setSidebarOpen(false);
    setSidebarInitialData(undefined);
  }, [router]);

  // Load voice data from sessionStorage (hub widget flow)
  // Handles both single tasks (pre-fill form) and batch (direct API creation)
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceTaskData');
      if (stored) {
        try {
          const { data } = JSON.parse(stored);
          sessionStorage.removeItem('voiceTaskData');
          handleVoiceConfirm(data);
        } catch (e) {
          console.error('Error parsing voice task data:', e);
        }
      }
    }
  }, [searchParams, handleVoiceConfirm]);

  const executeBatchCreation = async (entries: VoiceTaskData[]) => {
    setSaving(true);
    let successCount = 0;
    const failed: { entry: VoiceTaskData; reason: string }[] = [];

    for (const entry of entries) {
      try {
        const res = await fetch("/api/medical-records/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: (entry.title || "").trim(),
            description: (entry.description || "").trim() || null,
            dueDate: entry.dueDate || null,
            startTime: entry.startTime || null,
            endTime: entry.endTime || null,
            priority: entry.priority || "MEDIA",
            category: entry.category || "OTRO",
            patientId: entry.patientId || null,
          }),
        });

        // Handle both success and 409 conflicts
        if (res.ok) {
          successCount++;
        } else if (res.status === 409) {
          const errData = await res.json().catch(() => null);
          failed.push({
            entry,
            reason: errData?.error || "Conflicto de horario",
          });
        } else {
          const errData = await res.json().catch(() => null);
          failed.push({
            entry,
            reason: errData?.error || `Error ${res.status}`,
          });
        }
      } catch {
        failed.push({ entry, reason: 'Error de conexión' });
      }
    }

    setSaving(false);

    if (failed.length > 0) {
      const failedNames = failed
        .map(f => `• "${f.entry.title}": ${f.reason}`)
        .join('\n');
      setError(
        `Se crearon ${successCount} de ${entries.length} pendientes.\n\nFallaron:\n${failedNames}`
      );
    } else {
      router.push("/dashboard/pendientes");
    }
  };

  // Removed live conflict preview - server handles conflict detection on submission

  const handleStartTimeChange = (value: string) => {
    if (!value) {
      setForm({ ...form, startTime: '', endTime: '' });
    } else {
      setForm({ ...form, startTime: value });
    }
  };

  const handleEndTimeChange = (value: string) => {
    setForm({ ...form, endTime: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El titulo es obligatorio");
      return;
    }

    if (!form.dueDate) {
      setError("La fecha es obligatoria");
      return;
    }

    // Validate startTime/endTime pairing
    if (form.startTime && !form.endTime) {
      setError("Si se proporciona hora de inicio, la hora de fin es obligatoria");
      return;
    }
    if (form.endTime && !form.startTime) {
      setError("Si se proporciona hora de fin, la hora de inicio es obligatoria");
      return;
    }

    // Direct submission - server detects conflicts
    await submitTask();
  };

  const submitTask = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/medical-records/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          dueDate: form.dueDate || null,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          priority: form.priority,
          category: form.category,
          patientId: form.patientId || null,
        }),
      });

      const result = await res.json();

      // Handle 409 Conflict - Task-task conflicts (BLOCKING)
      if (res.status === 409) {
        setTaskConflicts({
          taskConflicts: result.taskConflicts || [],
          error: result.error || "Ya tienes un pendiente a esta hora",
        });
        setConflictDialogOpen(true);
        setSaving(false);
        return;
      }

      if (res.ok) {
        // Task created successfully
        if (result.warning && result.bookedAppointments) {
          // Show success + warning for 3 seconds then redirect
          setSuccessMessage(`Tarea creada exitosamente\n\n${result.warning}`);
          setTimeout(() => {
            router.push("/dashboard/pendientes");
          }, 3000);
        } else {
          // No warning - redirect immediately
          router.push("/dashboard/pendientes");
        }
      } else {
        setError(result.error || "Error al crear la tarea");
      }
    } catch {
      setError("Error al crear la tarea");
    } finally {
      setSaving(false);
    }
  };

  // Override not needed - conflicts must be resolved manually or task rescheduled

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true;
    const search = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search) ||
      p.internalId.toLowerCase().includes(search)
    );
  });

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
          {/* Action buttons */}
          {!voiceDataApplied && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatPanelOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Chat IA
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Draft Banner */}
      {showAIBanner && aiMetadata && (
        <AIDraftBanner
          confidence={aiMetadata.confidence}
          fieldsExtracted={aiMetadata.fieldsExtracted}
          fieldsEmpty={aiMetadata.fieldsEmpty}
          onDismiss={() => setShowAIBanner(false)}
        />
      )}

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

            {/* Date and Time Range */}
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

      {/* Task Conflict Dialog (simple inline) */}
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
                    setTaskConflicts(null);
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
          context={{
            doctorId: session.user.doctorId,
          }}
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
          context={{
            doctorId: session.user.doctorId,
          }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}

      {/* Task Chat IA Panel */}
      {chatPanelOpen && (
        <TaskChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={chatFormData}
          accumulatedTasks={accumulatedTasks}
          onUpdateFields={handleChatFieldUpdates}
          onUpdateTasks={handleChatTaskUpdates}
          onCreateBatch={handleChatBatchCreate}
        />
      )}
    </div>
  );
}
