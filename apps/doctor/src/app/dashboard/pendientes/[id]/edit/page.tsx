"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { ArrowLeft, Loader2, Save, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    priority: "MEDIA",
    category: "OTRO",
    status: "PENDIENTE",
    patientId: "",
  });

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTask();
      fetchPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medical-records/tasks/${id}`);
      const result = await res.json();

      if (res.ok) {
        const task = result.data;
        setForm({
          title: task.title,
          description: task.description || "",
          dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
          dueTime: task.dueTime || "",
          priority: task.priority,
          category: task.category,
          status: task.status,
          patientId: task.patientId || "",
        });
      } else {
        setError("Tarea no encontrada");
      }
    } catch {
      setError("Error al cargar la tarea");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          dueDate: form.dueDate || null,
          dueTime: form.dueTime || null,
          priority: form.priority,
          category: form.category,
          status: form.status,
          patientId: form.patientId || null,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/pendientes");
      } else {
        const result = await res.json();
        setError(result.error || "Error al actualizar la tarea");
      }
    } catch {
      setError("Error al actualizar la tarea");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETADA" }),
      });
      if (res.ok) {
        router.push("/dashboard/pendientes");
      }
    } catch {
      setError("Error al completar la tarea");
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

  if (authStatus === "loading" || loading) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Tarea</h1>
          {form.status !== "COMPLETADA" && (
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como Completada
            </button>
          )}
        </div>
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
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Priority, Category, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROGRESO">En Progreso</option>
                  <option value="COMPLETADA">Completada</option>
                  <option value="CANCELADA">Cancelada</option>
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
              Guardar Cambios
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
