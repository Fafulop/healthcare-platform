"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

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

  // Check for conflicts when date and times are filled
  useEffect(() => {
    const checkConflicts = async () => {
      if (!form.dueDate || !form.startTime || !form.endTime) {
        setConflicts([]);
        return;
      }

      setCheckingConflicts(true);
      try {
        const res = await fetch(
          `/api/medical-records/tasks/conflicts?date=${form.dueDate}&startTime=${form.startTime}&endTime=${form.endTime}`
        );
        const result = await res.json();
        if (res.ok) {
          setConflicts(result.data.conflicts || []);
        }
      } catch {
        // non-critical
      } finally {
        setCheckingConflicts(false);
      }
    };

    const timeoutId = setTimeout(checkConflicts, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [form.dueDate, form.startTime, form.endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }

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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Tarea</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-red-500">*</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de fin</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Conflict Warning */}
            {conflicts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-yellow-800">
                      Advertencia: Conflicto con citas
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Esta pendiente se superpone con {conflicts.length} cita(s) programada(s).
                      Puedes guardarla de todas formas.
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
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
    </div>
  );
}
