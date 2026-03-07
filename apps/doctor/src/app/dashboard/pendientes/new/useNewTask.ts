import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceStructuredData, VoiceTaskData } from '@/types/voice-assistant';

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

interface TaskConflictData {
  taskConflicts: any[];
  error: string;
}

export function useNewTask() {
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

  const [taskConflicts, setTaskConflicts] = useState<TaskConflictData | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [accumulatedTasks, setAccumulatedTasks] = useState<VoiceTaskData[]>([]);

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
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

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

  const handleChatTaskUpdates = useCallback((tasks: VoiceTaskData[]) => {
    setAccumulatedTasks(tasks);
  }, []);

  const handleChatBatchCreate = useCallback(() => {
    if (accumulatedTasks.length === 0) return;
    executeBatchCreation(accumulatedTasks);
    setAccumulatedTasks([]);
    setChatPanelOpen(false);
  }, [accumulatedTasks]);

  const handleModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoiceTaskData;

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceTaskData] != null &&
           voiceData[k as keyof VoiceTaskData] !== ''
    );

    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    setModalOpen(false);
    setSidebarInitialData(initialData);
    setSidebarOpen(true);
  }, []);

  const handleVoiceConfirm = useCallback(async (data: VoiceStructuredData) => {
    const batchData = data as any;
    if (batchData.isBatch && Array.isArray(batchData.entries) && batchData.entries.length > 0) {
      setSaving(true);
      setError(null);
      setSidebarOpen(false);
      setSidebarInitialData(undefined);

      const entries = batchData.entries as VoiceTaskData[];
      await executeBatchCreation(entries);
      return;
    }

    const voiceData = data as VoiceTaskData;
    setAccumulatedTasks(prev => [...prev, voiceData]);
    setSidebarOpen(false);
    setSidebarInitialData(undefined);
  }, [router]);

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

        if (res.ok) {
          successCount++;
        } else if (res.status === 409) {
          const errData = await res.json().catch(() => null);
          failed.push({ entry, reason: errData?.error || "Conflicto de horario" });
        } else {
          const errData = await res.json().catch(() => null);
          failed.push({ entry, reason: errData?.error || `Error ${res.status}` });
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
    if (form.startTime && !form.endTime) {
      setError("Si se proporciona hora de inicio, la hora de fin es obligatoria");
      return;
    }
    if (form.endTime && !form.startTime) {
      setError("Si se proporciona hora de fin, la hora de inicio es obligatoria");
      return;
    }
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
        if (result.warning && result.bookedAppointments) {
          setSuccessMessage(`Tarea creada exitosamente\n\n${result.warning}`);
          setTimeout(() => {
            router.push("/dashboard/pendientes");
          }, 3000);
        } else {
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

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true;
    const search = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search) ||
      p.internalId.toLowerCase().includes(search)
    );
  });

  return {
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
  };
}
