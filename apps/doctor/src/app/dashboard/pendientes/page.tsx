"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  CheckSquare,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: "ALTA" | "MEDIA" | "BAJA";
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CANCELADA";
  category: string;
  patientId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string } | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: "bg-red-100 text-red-800",
  MEDIA: "bg-yellow-100 text-yellow-800",
  BAJA: "bg-green-100 text-green-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  SEGUIMIENTO: "bg-blue-100 text-blue-800",
  ADMINISTRATIVO: "bg-purple-100 text-purple-800",
  LABORATORIO: "bg-cyan-100 text-cyan-800",
  RECETA: "bg-pink-100 text-pink-800",
  REFERENCIA: "bg-indigo-100 text-indigo-800",
  PERSONAL: "bg-orange-100 text-orange-800",
  OTRO: "bg-gray-100 text-gray-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  SEGUIMIENTO: "Seguimiento",
  ADMINISTRATIVO: "Administrativo",
  LABORATORIO: "Laboratorio",
  RECETA: "Receta",
  REFERENCIA: "Referencia",
  PERSONAL: "Personal",
  OTRO: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En Progreso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export default function PendientesPage() {
  const router = useRouter();
  const { status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPriority) params.set("priority", filterPriority);
      if (filterCategory) params.set("category", filterCategory);

      const res = await fetch(`/api/medical-records/tasks?${params}`);
      const result = await res.json();

      if (res.ok) {
        setTasks(result.data);
        setError(null);
      } else {
        setError(result.error || "Error al cargar pendientes");
      }
    } catch {
      setError("Error al cargar pendientes");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterCategory]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTasks();
    }
  }, [authStatus, fetchTasks]);

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA";
    try {
      const res = await fetch(`/api/medical-records/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch {
      // silent fail
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}"?`)) return;
    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks(tasks.filter((t) => t.id !== id));
      }
    } catch {
      alert("Error al eliminar");
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === "COMPLETADA" || task.status === "CANCELADA") return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const isToday = (task: Task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today.getTime();
  };

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const stats = {
    totalPending: tasks.filter((t) => t.status === "PENDIENTE" || t.status === "EN_PROGRESO").length,
    overdue: tasks.filter(isOverdue).length,
    today: tasks.filter(isToday).length,
    completedThisWeek: tasks.filter((t) => {
      if (t.status !== "COMPLETADA" || !t.completedAt) return false;
      const completed = new Date(t.completedAt);
      return completed >= startOfWeek && completed <= endOfWeek;
    }).length,
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pendientes</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestiona tus tareas y seguimientos</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/pendientes/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 rounded-md font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pendientes</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalPending}</p>
            </div>
            <CheckSquare className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Vencidas</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.overdue}</p>
            </div>
            <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Para Hoy</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.today}</p>
            </div>
            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completadas (Semana)</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.completedThisWeek}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROGRESO">En Progreso</option>
            <option value="COMPLETADA">Completada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todas las prioridades</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todas las categorías</option>
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Task List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">No hay pendientes</p>
            <p className="text-gray-500 mb-4">Crea tu primera tarea para empezar</p>
            <button
              onClick={() => router.push("/dashboard/pendientes/new")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Tarea
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-200">
              {tasks.map((task) => (
                <div key={task.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.status === "COMPLETADA"
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-blue-500"
                      }`}
                    >
                      {task.status === "COMPLETADA" && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${task.status === "COMPLETADA" ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.OTRO}`}>
                          {CATEGORY_LABELS[task.category] || task.category}
                        </span>
                        {task.dueDate && (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue(task) ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                            <Calendar className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                            {task.dueTime && ` ${task.dueTime}`}
                          </span>
                        )}
                      </div>
                      {task.patient && (
                        <p className="text-xs text-gray-500 mt-1">
                          Paciente: {task.patient.firstName} {task.patient.lastName}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => router.push(`/dashboard/pendientes/${task.id}/edit`)}
                        className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id, task.title)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className={`hover:bg-gray-50 transition-colors ${isOverdue(task) ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            task.status === "COMPLETADA"
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-gray-300 hover:border-blue-500"
                          }`}
                        >
                          {task.status === "COMPLETADA" && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${task.status === "COMPLETADA" ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {task.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {task.dueDate ? (
                          <span className={isOverdue(task) ? "text-red-600 font-semibold" : "text-gray-500"}>
                            {new Date(task.dueDate).toLocaleDateString()}
                            {task.dueTime && ` ${task.dueTime}`}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.OTRO}`}>
                          {CATEGORY_LABELS[task.category] || task.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {STATUS_LABELS[task.status] || task.status}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {task.patient ? `${task.patient.firstName} ${task.patient.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => router.push(`/dashboard/pendientes/${task.id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id, task.title)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
