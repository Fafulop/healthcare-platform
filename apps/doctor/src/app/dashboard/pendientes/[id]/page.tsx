"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import { ArrowLeft, Loader2, Edit, Trash2, CheckCircle2, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
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

export default function ViewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medical-records/tasks/${id}`);
      const result = await res.json();

      if (res.ok) {
        setTask(result.data);
      } else {
        setError("Tarea no encontrada");
      }
    } catch {
      setError("Error al cargar la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar esta tarea?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard/pendientes");
      } else {
        setError("Error al eliminar la tarea");
      }
    } catch {
      setError("Error al eliminar la tarea");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETADA" }),
      });
      if (res.ok) {
        router.push("/dashboard/pendientes");
      } else {
        setError("Error al completar la tarea");
      }
    } catch {
      setError("Error al completar la tarea");
    } finally {
      setCompleting(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error || "Tarea no encontrada"}</p>
        </div>
        <Link
          href="/dashboard/pendientes"
          className="mt-4 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Pendientes
        </Link>
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                {STATUS_LABELS[task.status]}
              </span>
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                {CATEGORY_LABELS[task.category] || task.category}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {task.status !== "COMPLETADA" && (
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Completar
              </button>
            )}
            <Link
              href={`/dashboard/pendientes/${id}/edit`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold flex items-center gap-2 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Editar
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Task Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 sm:p-6 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Descripción</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {task.dueDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Fecha
                </h3>
                <p className="text-gray-900">
                  {new Date(task.dueDate).toLocaleDateString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}

            {task.startTime && task.endTime && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Horario
                </h3>
                <p className="text-gray-900">{task.startTime} - {task.endTime}</p>
              </div>
            )}
          </div>

          {/* Patient */}
          {task.patient && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Paciente
              </h3>
              <p className="text-gray-900">
                {task.patient.firstName} {task.patient.lastName}
              </p>
            </div>
          )}

          {/* Completion Info */}
          {task.status === "COMPLETADA" && task.completedAt && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Completada</h3>
              <p className="text-gray-900">
                {new Date(task.completedAt).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Creada:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(task.createdAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Actualizada:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(task.updatedAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
