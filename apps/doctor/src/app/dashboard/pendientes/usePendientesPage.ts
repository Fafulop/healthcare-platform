import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { getLocalDateString, parseLocalDate } from '@/lib/dates';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';

export interface Task {
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

export interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  status: string;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
  bookings?: Booking[];
}

export function usePendientesPage() {
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const [listDate, setListDate] = useState<string>(getLocalDateString(new Date()));
  const [showAllTasks, setShowAllTasks] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarTasks, setCalendarTasks] = useState<Task[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setSelectedIds(new Set());
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
      } else {
        toast.error("Error al actualizar la tarea");
      }
    } catch {
      toast.error("Error al actualizar la tarea");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!await practiceConfirm(`¿Eliminar "${title}"?`)) return;
    try {
      const res = await fetch(`/api/medical-records/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        const result = await res.json();
        toast.error(result.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await practiceConfirm(`¿Eliminar ${selectedIds.size} tarea(s) seleccionada(s)?`)) return;

    setBulkDeleting(true);
    const idsToDelete = Array.from(selectedIds);

    try {
      const res = await fetch(`/api/medical-records/tasks/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: idsToDelete }),
      });

      if (res.ok) {
        setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
      } else {
        const result = await res.json();
        toast.error(result.error || "Error al eliminar las tareas");
      }
    } catch {
      toast.error("Error al eliminar las tareas");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setEditingStatusId(null);
    try {
      const res = await fetch(`/api/medical-records/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
      } else {
        toast.error("Error al actualizar el estado");
      }
    } catch {
      toast.error("Error al actualizar el estado");
    }
  };

  // Derived values
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === "COMPLETADA" || task.status === "CANCELADA") return false;
    const due = parseLocalDate(task.dueDate as string);
    return due < today;
  };

  const isTaskToday = (task: Task) => {
    if (!task.dueDate) return false;
    const due = parseLocalDate(task.dueDate as string);
    return due.getTime() === today.getTime();
  };

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const stats = {
    totalPending: tasks.filter((t) => t.status === "PENDIENTE" || t.status === "EN_PROGRESO").length,
    overdue: tasks.filter(isOverdue).length,
    today: tasks.filter(isTaskToday).length,
    completedThisWeek: tasks.filter((t) => {
      if (t.status !== "COMPLETADA" || !t.completedAt) return false;
      const completed = new Date(t.completedAt);
      return completed >= startOfWeek && completed <= endOfWeek;
    }).length,
  };

  const tasksForListDate = tasks.filter((task) => {
    if (!task.dueDate) return false;
    return task.dueDate.split('T')[0] === listDate;
  });
  const visibleTasks = showAllTasks ? tasks : tasksForListDate;

  const toggleSelectAll = () => {
    const target = viewMode === 'list' ? visibleTasks : tasks;
    const allSelected = target.length > 0 && target.every(t => selectedIds.has(t.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(target.map((t) => t.id)));
    }
  };

  return {
    router,
    authStatus,
    loading,
    error,
    filterStatus, setFilterStatus,
    filterPriority, setFilterPriority,
    filterCategory, setFilterCategory,
    selectedIds, setSelectedIds,
    bulkDeleting,
    viewingTask, setViewingTask,
    editingStatusId, setEditingStatusId,
    listDate, setListDate,
    showAllTasks, setShowAllTasks,
    viewMode, setViewMode,
    currentMonth, setCurrentMonth,
    calendarTasks,
    appointmentSlots,
    selectedDate, setSelectedDate,
    calendarLoading,
    stats,
    visibleTasks,
    isOverdue,
    handleDelete,
    toggleSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleStatusChange,
  };
}
