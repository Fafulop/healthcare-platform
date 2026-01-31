"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Loader2, Save, Mic } from "lucide-react";
import Link from "next/link";
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import ConflictDialog from '@/components/ConflictDialog';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceStructuredData } from '@/types/voice-assistant';

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

interface VoiceTaskData {
  title?: string;
  description?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  priority?: "ALTA" | "MEDIA" | "BAJA";
  category?: string;
  patientId?: string;
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

interface ConflictData {
  appointmentConflicts: any[];
  taskConflicts: any[];
  hasBookedAppointments: boolean;
  appointmentCheckFailed?: boolean;
  taskCheckFailed?: boolean;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  // Pending submission data (stored when conflicts block creation)
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);
  // Batch conflict state
  const [batchConflictData, setBatchConflictData] = useState<{
    results: any[];
    entries: VoiceTaskData[];
  } | null>(null);

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

      // Check conflicts for entries that have time ranges
      const timedEntries = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.startTime && entry.endTime && entry.dueDate);

      if (timedEntries.length > 0) {
        try {
          const conflictRes = await fetch("/api/medical-records/tasks/conflicts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entries: timedEntries.map(({ entry }) => ({
                date: entry.dueDate,
                startTime: entry.startTime,
                endTime: entry.endTime,
              })),
            }),
          });
          const conflictResult = await conflictRes.json();

          if (conflictRes.ok) {
            const results = conflictResult.data.results || [];
            const hasAnyConflicts = results.some(
              (r: any) => r.appointmentConflicts.length > 0 || r.taskConflicts.length > 0
            );

            if (hasAnyConflicts) {
              // Store batch conflict data and show dialog
              setBatchConflictData({ results, entries });

              // Aggregate all conflicts for the dialog
              const allAppointmentConflicts: any[] = [];
              const allTaskConflicts: any[] = [];
              let hasBooked = false;
              let apptFailed = false;
              let taskFailed = false;
              for (const r of results) {
                allAppointmentConflicts.push(...r.appointmentConflicts);
                allTaskConflicts.push(...r.taskConflicts);
                if (r.hasBookedAppointments) hasBooked = true;
                if (r.appointmentCheckFailed) apptFailed = true;
                if (r.taskCheckFailed) taskFailed = true;
              }
              // Deduplicate by id
              const uniqueAppts = Array.from(new Map(allAppointmentConflicts.map(a => [a.id, a])).values());
              const uniqueTasks = Array.from(new Map(allTaskConflicts.map(t => [t.id, t])).values());

              setConflictData({
                appointmentConflicts: uniqueAppts,
                taskConflicts: uniqueTasks,
                hasBookedAppointments: hasBooked,
                appointmentCheckFailed: apptFailed,
                taskCheckFailed: taskFailed,
              });
              setConflictDialogOpen(true);
              setSaving(false);
              return;
            }

            // No conflicts but check failures — warn
            const hasAnyFailures = results.some(
              (r: any) => r.appointmentCheckFailed || r.taskCheckFailed
            );
            if (hasAnyFailures) {
              setError('No se pudo verificar todos los conflictos. Algunos servicios no están disponibles. Si continúas, podrían crearse horarios duplicados.');
              setSaving(false);
              return;
            }
          }
        } catch {
          setError('No se pudo verificar conflictos. El servicio no está disponible. Si continúas, podrían crearse horarios duplicados.');
          setSaving(false);
          return;
        }
      }

      // No conflicts — proceed with batch creation
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

  const executeBatchCreation = async (entries: VoiceTaskData[], skipConflictCheck = false) => {
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
            skipConflictCheck,
          }),
        });
        if (res.ok) {
          successCount++;
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

  // Check for conflicts when date and times are filled (live preview)
  useEffect(() => {
    const checkConflicts = async () => {
      if (!form.dueDate || !form.startTime || !form.endTime) {
        setConflictData(null);
        return;
      }

      setCheckingConflicts(true);
      try {
        const res = await fetch(
          `/api/medical-records/tasks/conflicts?date=${form.dueDate}&startTime=${form.startTime}&endTime=${form.endTime}`
        );
        const result = await res.json();
        if (res.ok) {
          const data = result.data;
          const hasConflicts =
            (data.appointmentConflicts?.length || 0) > 0 ||
            (data.taskConflicts?.length || 0) > 0;
          const hasFailures = data.appointmentCheckFailed || data.taskCheckFailed;
          if (hasConflicts || hasFailures) {
            setConflictData(data);
          } else {
            setConflictData(null);
          }
        }
      } catch {
        setConflictData({
          appointmentConflicts: [],
          taskConflicts: [],
          hasBookedAppointments: false,
          appointmentCheckFailed: true,
          taskCheckFailed: true,
        });
      } finally {
        setCheckingConflicts(false);
      }
    };

    const timeoutId = setTimeout(checkConflicts, 300);
    return () => clearTimeout(timeoutId);
  }, [form.dueDate, form.startTime, form.endTime]);

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

    // Validate startTime/endTime pairing
    if (form.startTime && !form.endTime) {
      setError("Si se proporciona hora de inicio, la hora de fin es obligatoria");
      return;
    }
    if (form.endTime && !form.startTime) {
      setError("Si se proporciona hora de fin, la hora de inicio es obligatoria");
      return;
    }

    // If there are conflicts, show dialog instead of submitting
    if (form.startTime && form.endTime && conflictData &&
        (conflictData.appointmentConflicts.length > 0 || conflictData.taskConflicts.length > 0)) {
      setPendingSubmit({
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        priority: form.priority,
        category: form.category,
        patientId: form.patientId || null,
      });
      setConflictDialogOpen(true);
      return;
    }

    await submitTask();
  };

  const submitTask = async (skipConflictCheck = false) => {
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
          skipConflictCheck,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/pendientes");
      } else {
        const result = await res.json();
        setError(result.error || "Error al crear la tarea");
      }
    } catch {
      setError("Error al crear la tarea");
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!conflictData) return;

    setOverrideLoading(true);

    // Collect IDs to override (exclude BOOKED appointments)
    const slotIdsToBlock = conflictData.appointmentConflicts
      .filter(s => s.status === 'AVAILABLE')
      .map(s => s.id);
    const taskIdsToCancel = conflictData.taskConflicts.map(t => t.id);

    try {
      const res = await fetch("/api/medical-records/tasks/conflicts/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIdsToCancel, slotIdsToBlock }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setError(errorData?.error || "Error al anular conflictos");
        setOverrideLoading(false);
        setConflictDialogOpen(false);
        return;
      }

      setConflictDialogOpen(false);
      setConflictData(null);

      // Now proceed with creation
      if (batchConflictData) {
        // Batch flow — skip conflict check since we just overrode
        await executeBatchCreation(batchConflictData.entries, true);
        setBatchConflictData(null);
      } else {
        // Single task flow — skip conflict check since we just overrode
        await submitTask(true);
      }
    } catch {
      setError("Error al anular conflictos");
    } finally {
      setOverrideLoading(false);
      setPendingSubmit(null);
    }
  };

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

  const hasConflicts = conflictData &&
    (conflictData.appointmentConflicts.length > 0 || conflictData.taskConflicts.length > 0);
  const hasCheckFailures = conflictData &&
    (conflictData.appointmentCheckFailed || conflictData.taskCheckFailed);

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
          {/* Voice Assistant Button - hidden after data is applied */}
          {!voiceDataApplied && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mic className="w-5 h-5" />
              Asistente de Voz
            </button>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de inicio
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
                  Hora de fin
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

            {/* Conflict Warning (inline preview) */}
            {hasConflicts && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-yellow-800">
                      Conflictos de horario detectados
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {conflictData!.appointmentConflicts.length > 0 &&
                        `${conflictData!.appointmentConflicts.length} cita(s)`}
                      {conflictData!.appointmentConflicts.length > 0 && conflictData!.taskConflicts.length > 0 && ' y '}
                      {conflictData!.taskConflicts.length > 0 &&
                        `${conflictData!.taskConflicts.length} pendiente(s)`}
                      {' '}en conflicto. Al guardar podras anular los conflictos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {checkingConflicts && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando conflictos...
              </div>
            )}

            {hasCheckFailures && !hasConflicts && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-red-800">
                      No se pudo verificar conflictos
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      {conflictData?.appointmentCheckFailed && conflictData?.taskCheckFailed
                        ? 'No se pudo conectar con el servicio de citas ni verificar pendientes existentes.'
                        : conflictData?.appointmentCheckFailed
                        ? 'No se pudo conectar con el servicio de citas para verificar conflictos.'
                        : 'No se pudo verificar conflictos con pendientes existentes.'}
                      {' '}Si continúas, podrían crearse horarios duplicados.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Conflict Dialog */}
      {conflictData && (
        <ConflictDialog
          isOpen={conflictDialogOpen}
          onClose={() => {
            setConflictDialogOpen(false);
            setPendingSubmit(null);
            setBatchConflictData(null);
          }}
          appointmentConflicts={conflictData.appointmentConflicts}
          taskConflicts={conflictData.taskConflicts}
          hasBookedAppointments={conflictData.hasBookedAppointments}
          onOverride={handleOverride}
          loading={overrideLoading}
        />
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
    </div>
  );
}
