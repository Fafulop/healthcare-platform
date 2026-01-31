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
  Eye,
} from "lucide-react";

// Helper function to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  currentBookings: number;
  maxBookings: number;
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

  // Calendar view state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarTasks, setCalendarTasks] = useState<Task[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

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

  const fetchCalendarData = useCallback(async () => {
    try {
      setCalendarLoading(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const res = await fetch(`/api/medical-records/tasks/calendar?startDate=${startDateStr}&endDate=${endDateStr}`);
      const result = await res.json();

      if (res.ok) {
        setCalendarTasks(result.data.tasks || []);
        setAppointmentSlots(result.data.appointmentSlots || []);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (authStatus === "authenticated" && viewMode === 'calendar') {
      fetchCalendarData();
    }
  }, [authStatus, viewMode, fetchCalendarData]);

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

  // Extract YYYY-MM-DD from ISO string to avoid timezone shifts
  const toLocalDate = (isoStr: string): Date => {
    const dateStr = isoStr.split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === "COMPLETADA" || task.status === "CANCELADA") return false;
    const due = toLocalDate(task.dueDate as string);
    return due < today;
  };

  const isToday = (task: Task) => {
    if (!task.dueDate) return false;
    const due = toLocalDate(task.dueDate as string);
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
        <div className="flex justify-between items-center mb-4">
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

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Calendario
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

      {/* List View: Filters */}
      {viewMode === 'list' && (
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
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="mb-6">
          {/* Calendar Navigation */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const newMonth = new Date(currentMonth);
                  newMonth.setMonth(currentMonth.getMonth() - 1);
                  setCurrentMonth(newMonth);
                }}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <span className="text-xl">&lt;</span>
              </button>
              <h2 className="text-lg font-semibold">
                {currentMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => {
                  const newMonth = new Date(currentMonth);
                  newMonth.setMonth(currentMonth.getMonth() + 1);
                  setCurrentMonth(newMonth);
                }}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <span className="text-xl">&gt;</span>
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {calendarLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">Cargando calendario...</p>
              </div>
            ) : (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-700">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days: React.ReactElement[] = [];

                    // Empty cells before month starts
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<div key={`empty-${i}`} className="p-2 border-b border-r border-gray-200 bg-gray-50 h-24" />);
                    }

                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      const dateStr = getLocalDateString(date);
                      // Normalize task dueDate to YYYY-MM-DD for comparison
                      const dayTasks = calendarTasks.filter(t => {
                        if (!t.dueDate) return false;
                        const taskDateStr = typeof t.dueDate === 'string'
                          ? t.dueDate.split('T')[0]
                          : getLocalDateString(new Date(t.dueDate));
                        return taskDateStr === dateStr;
                      });
                      const daySlots = appointmentSlots.filter(s => s.date.startsWith(dateStr));
                      const isToday = dateStr === getLocalDateString(new Date());
                      const isSelected = selectedDate && getLocalDateString(selectedDate) === dateStr;

                      // Detect time overlaps between tasks and slots on this day
                      const timedTasks = dayTasks.filter(t => t.startTime && t.endTime);
                      const activeSlots = daySlots.filter(s => s.status === 'AVAILABLE' || s.status === 'BOOKED');
                      let hasOverlap = false;

                      // Check task-vs-slot overlaps
                      for (const task of timedTasks) {
                        for (const slot of activeSlots) {
                          if (task.startTime! < slot.endTime && task.endTime! > slot.startTime) {
                            hasOverlap = true;
                            break;
                          }
                        }
                        if (hasOverlap) break;
                      }

                      // Check task-vs-task overlaps
                      if (!hasOverlap && timedTasks.length > 1) {
                        for (let i = 0; i < timedTasks.length; i++) {
                          for (let j = i + 1; j < timedTasks.length; j++) {
                            if (timedTasks[i].startTime! < timedTasks[j].endTime! && timedTasks[i].endTime! > timedTasks[j].startTime!) {
                              hasOverlap = true;
                              break;
                            }
                          }
                          if (hasOverlap) break;
                        }
                      }

                      days.push(
                        <button
                          key={day}
                          onClick={() => setSelectedDate(date)}
                          className={`p-2 border-b border-r border-gray-200 h-24 text-left hover:bg-blue-50 transition-colors ${
                            isToday ? 'bg-blue-50' : ''
                          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                        >
                          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                            {day}
                          </div>
                          <div className="space-y-1">
                            {hasOverlap && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span className="text-xs text-red-600 font-medium">Conflicto</span>
                              </div>
                            )}
                            {dayTasks.length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-xs text-gray-600">{dayTasks.length} tarea{dayTasks.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {daySlots.filter(s => s.status === 'AVAILABLE').length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-xs text-gray-600">Disponible</span>
                              </div>
                            )}
                            {daySlots.filter(s => s.status === 'BOOKED').length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                <span className="text-xs text-gray-600">Citas</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    }

                    return days;
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Day Details Panel */}
          {selectedDate && (
            <div className="bg-white rounded-lg shadow p-4 mt-4">
              <h3 className="text-lg font-semibold mb-4">
                Detalles del día - {selectedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              </h3>

              {/* Tasks for selected day */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Pendientes</h4>
                {(() => {
                  const selectedDateStr = getLocalDateString(selectedDate);
                  const tasksForDay = calendarTasks.filter(t => {
                    if (!t.dueDate) return false;
                    const taskDateStr = typeof t.dueDate === 'string'
                      ? t.dueDate.split('T')[0]
                      : getLocalDateString(new Date(t.dueDate));
                    return taskDateStr === selectedDateStr;
                  });
                  const selectedSlots = appointmentSlots.filter(s => s.date.startsWith(selectedDateStr));
                  const selectedActiveSlots = selectedSlots.filter(s => s.status === 'AVAILABLE' || s.status === 'BOOKED');

                  // Build set of task IDs that have overlaps
                  const overlappingTaskIds = new Set<string>();
                  for (const task of tasksForDay) {
                    if (!task.startTime || !task.endTime) continue;
                    // Check against slots
                    for (const slot of selectedActiveSlots) {
                      if (task.startTime < slot.endTime && task.endTime > slot.startTime) {
                        overlappingTaskIds.add(task.id);
                        break;
                      }
                    }
                    // Check against other tasks
                    for (const other of tasksForDay) {
                      if (other.id === task.id || !other.startTime || !other.endTime) continue;
                      if (task.startTime < other.endTime && task.endTime > other.startTime) {
                        overlappingTaskIds.add(task.id);
                        overlappingTaskIds.add(other.id);
                      }
                    }
                  }

                  return tasksForDay.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin tareas pendientes</p>
                ) : (
                  <div className="space-y-2">
                    {tasksForDay
                      .map(task => {
                        const isConflicting = overlappingTaskIds.has(task.id);
                        return (
                        <div key={task.id} className={`border rounded p-3 transition-colors ${
                          isConflicting
                            ? 'border-red-300 bg-red-50 hover:border-red-400'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <button
                                onClick={() => router.push(`/dashboard/pendientes/${task.id}`)}
                                className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors"
                              >
                                {task.title}
                              </button>
                              {task.startTime && task.endTime && (
                                <p className={`text-sm mt-1 ${isConflicting ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                  {task.startTime} - {task.endTime}
                                  {isConflicting && ' — Conflicto de horario'}
                                </p>
                              )}
                              {task.patient && (
                                <p className="text-sm text-gray-500 mt-1">
                                  Paciente: {task.patient.firstName} {task.patient.lastName}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        );
                      })}
                  </div>
                );
                })()}
              </div>

              {/* Appointments for selected day */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Citas</h4>
                {(() => {
                  const sDateStr = getLocalDateString(selectedDate);
                  const slotsForDay = appointmentSlots.filter(s => s.date.startsWith(sDateStr));
                  const timedTasksForDay = calendarTasks.filter(t => {
                    if (!t.dueDate || !t.startTime || !t.endTime) return false;
                    const tds = typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : getLocalDateString(new Date(t.dueDate));
                    return tds === sDateStr;
                  });

                  // Build set of slot IDs that overlap with tasks
                  const overlappingSlotIds = new Set<string>();
                  for (const slot of slotsForDay) {
                    if (slot.status !== 'AVAILABLE' && slot.status !== 'BOOKED') continue;
                    for (const task of timedTasksForDay) {
                      if (task.startTime! < slot.endTime && task.endTime! > slot.startTime) {
                        overlappingSlotIds.add(slot.id);
                        break;
                      }
                    }
                  }

                  return slotsForDay.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin citas programadas</p>
                  ) : (
                    <div className="space-y-2">
                      {slotsForDay.map(slot => {
                        const isConflicting = overlappingSlotIds.has(slot.id);
                        return (
                          <div key={slot.id} className={`border rounded p-3 ${
                            isConflicting
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`font-medium ${isConflicting ? 'text-red-700' : 'text-gray-900'}`}>
                                  {slot.startTime} - {slot.endTime}
                                  {isConflicting && ' — Conflicto con pendiente'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {slot.currentBookings} / {slot.maxBookings} reservado{slot.maxBookings > 1 ? 's' : ''}
                                </p>
                              </div>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                slot.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {slot.status === 'AVAILABLE' ? 'Disponible' : 'Reservado'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && viewMode === 'list' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Task List */}
      {viewMode === 'list' && (
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
                            {toLocalDate(task.dueDate as string).toLocaleDateString()}
                            {task.startTime && task.endTime && ` ${task.startTime}-${task.endTime}`}
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
                        onClick={() => router.push(`/dashboard/pendientes/${task.id}`)}
                        className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/pendientes/${task.id}/edit`)}
                        className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id, task.title)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar"
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora Fin</th>
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
                            {toLocalDate(task.dueDate as string).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {task.startTime || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {task.endTime || "—"}
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
                            onClick={() => router.push(`/dashboard/pendientes/${task.id}`)}
                            className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/pendientes/${task.id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id, task.title)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
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
      )}
    </div>
  );
}
