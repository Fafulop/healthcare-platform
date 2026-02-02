'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Clock, AlertCircle, User, Phone, Mail, Calendar as CalendarIcon } from 'lucide-react';
import { MiniCalendar } from './MiniCalendar';

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
  patient: { id: string; firstName: string; lastName: string } | null;
}

interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  status: string;
}

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
  bookings?: Booking[];
}

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  slots: AppointmentSlot[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  loading?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: "bg-red-100 text-red-800",
  MEDIA: "bg-yellow-100 text-yellow-800",
  BAJA: "bg-green-100 text-green-800",
};

// Helper function to get local date string
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DayDetailsModal({ isOpen, onClose, tasks, slots, selectedDate, onDateChange, loading = false }: DayDetailsModalProps) {
  const router = useRouter();
  const [showCalendar, setShowCalendar] = useState(false);

  if (!isOpen) return null;

  const todayStr = getLocalDateString(selectedDate);

  // Get tasks for today
  const tasksForDay = tasks.filter(t => {
    if (!t.dueDate) return false;
    const taskDateStr = typeof t.dueDate === 'string'
      ? t.dueDate.split('T')[0]
      : getLocalDateString(new Date(t.dueDate));
    return taskDateStr === todayStr;
  });

  // Get appointment slots for today
  const slotsForDay = slots.filter(s => {
    const slotDateStr = typeof s.date === 'string'
      ? s.date.split('T')[0]
      : getLocalDateString(new Date(s.date));
    return slotDateStr === todayStr;
  });

  // Build conflict detection sets
  const taskTaskConflictIds = new Set<string>();
  const bookedAppointmentWarningIds = new Set<string>();
  const slotTaskOverlapIds = new Set<string>();

  // Check task-task conflicts
  for (const task of tasksForDay) {
    if (!task.startTime || !task.endTime) continue;
    for (const other of tasksForDay) {
      if (other.id === task.id || !other.startTime || !other.endTime) continue;
      if (task.startTime < other.endTime && task.endTime > other.startTime) {
        taskTaskConflictIds.add(task.id);
        taskTaskConflictIds.add(other.id);
      }
    }
  }

  // Check task-appointment overlaps
  const openSlots = slotsForDay.filter(s => s.isOpen);
  for (const task of tasksForDay) {
    if (!task.startTime || !task.endTime) continue;
    if (!taskTaskConflictIds.has(task.id)) {
      for (const slot of openSlots) {
        const isBooked = slot.currentBookings > 0;
        if (isBooked && task.startTime < slot.endTime && task.endTime > slot.startTime) {
          bookedAppointmentWarningIds.add(task.id);
          break;
        }
      }
    }
  }

  // Check slot-task overlaps
  for (const slot of slotsForDay) {
    if (!slot.isOpen) continue;
    const isBooked = slot.currentBookings > 0;
    if (isBooked) {
      for (const task of tasksForDay) {
        if (!task.startTime || !task.endTime) continue;
        if (task.startTime < slot.endTime && task.endTime > slot.startTime) {
          slotTaskOverlapIds.add(slot.id);
          break;
        }
      }
    }
  }

  // Helper to get slot status
  const getSlotDisplayStatus = (slot: AppointmentSlot) => {
    const isFull = slot.currentBookings >= slot.maxBookings;
    if (!slot.isOpen) {
      return { label: "Cerrado", color: "bg-gray-200 text-gray-700" };
    }
    if (isFull) {
      return { label: "Lleno", color: "bg-blue-100 text-blue-700" };
    }
    if (slot.currentBookings > 0) {
      return { label: "Reservado", color: "bg-orange-100 text-orange-800" };
    }
    return { label: "Disponible", color: "bg-green-100 text-green-800" };
  };

  // Combine tasks and appointments into timeline items
  type TimelineItem = {
    type: 'task' | 'appointment';
    startTime: string;
    endTime: string;
    data: Task | AppointmentSlot;
  };

  const timelineItems: TimelineItem[] = [
    ...tasksForDay
      .filter(t => t.startTime && t.endTime)
      .map(t => ({
        type: 'task' as const,
        startTime: t.startTime!,
        endTime: t.endTime!,
        data: t
      })),
    // Only show appointments that have bookings
    ...slotsForDay
      .filter(s => s.currentBookings > 0)
      .map(s => ({
        type: 'appointment' as const,
        startTime: s.startTime,
        endTime: s.endTime,
        data: s
      }))
  ];

  // Sort by start time, then by type
  timelineItems.sort((a, b) => {
    const timeCompare = a.startTime.localeCompare(b.startTime);
    if (timeCompare !== 0) return timeCompare;
    return a.type.localeCompare(b.type);
  });

  // Group by unique time slots
  const timeSlots = new Map<string, TimelineItem[]>();
  for (const item of timelineItems) {
    const key = `${item.startTime}-${item.endTime}`;
    if (!timeSlots.has(key)) {
      timeSlots.set(key, []);
    }
    timeSlots.get(key)!.push(item);
  }

  // Get tasks without times
  const tasksWithoutTime = tasksForDay.filter(t => !t.startTime || !t.endTime);

  const hasContent = timelineItems.length > 0 || tasksWithoutTime.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Detalles del día
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Date Display and Calendar Toggle */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {selectedDate.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showCalendar
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              {showCalendar ? 'Ocultar calendario' : 'Cambiar fecha'}
            </button>
          </div>
        </div>

        {/* Calendar Picker (Collapsible) */}
        {showCalendar && (
          <div className="border-b border-gray-200 p-4 bg-gray-50">
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                onDateChange(date);
                setShowCalendar(false);
              }}
            />
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
              <p className="text-sm text-gray-500">Cargando datos...</p>
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Sin pendientes ni citas programadas para hoy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline items grouped by time */}
              {Array.from(timeSlots.entries()).map(([timeKey, items]) => {
                const [startTime, endTime] = timeKey.split('-');
                return (
                  <div key={timeKey} className="border-l-4 border-yellow-400 pl-4">
                    {/* Time Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <h4 className="font-semibold text-gray-900">
                        {startTime} - {endTime}
                      </h4>
                    </div>

                    {/* Items at this time */}
                    <div className="space-y-2">
                      {items.map((item) => {
                        if (item.type === 'task') {
                          const task = item.data as Task;
                          const hasTaskConflict = taskTaskConflictIds.has(task.id);
                          const hasBookedWarning = bookedAppointmentWarningIds.has(task.id);
                          const borderColor = hasTaskConflict
                            ? 'border-red-300 bg-red-50 hover:border-red-400'
                            : hasBookedWarning
                            ? 'border-blue-300 bg-blue-50 hover:border-blue-400'
                            : 'border-gray-200 hover:border-blue-300';

                          return (
                            <div key={`task-${task.id}`} className={`border rounded-lg p-3 transition-colors ${borderColor}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                      Pendiente
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                                      {task.priority}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      router.push(`/dashboard/pendientes/${task.id}`);
                                      onClose();
                                    }}
                                    className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors"
                                  >
                                    {task.title}
                                  </button>
                                  {(hasTaskConflict || hasBookedWarning) && (
                                    <p className={`text-sm mt-1 ${
                                      hasTaskConflict ? 'text-red-600 font-medium' :
                                      'text-blue-600 font-medium'
                                    }`}>
                                      {hasTaskConflict && '⚠️ Conflicto con otro pendiente'}
                                      {hasBookedWarning && 'ℹ️ Cita reservada a esta hora'}
                                    </p>
                                  )}
                                  {task.patient && (
                                    <p className="text-sm text-gray-500 mt-1">
                                      Paciente: {task.patient.firstName} {task.patient.lastName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          const slot = item.data as AppointmentSlot;
                          const hasTaskOverlap = slotTaskOverlapIds.has(slot.id);
                          const slotStatus = getSlotDisplayStatus(slot);
                          const activeBookings = slot.bookings?.filter(b => b.status !== 'CANCELLED') || [];

                          return (
                            <div key={`slot-${slot.id}`} className={`border rounded-lg p-3 ${
                              hasTaskOverlap
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200'
                            }`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800">
                                      Cita
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${slotStatus.color}`}>
                                      {slotStatus.label}
                                    </span>
                                  </div>
                                  <p className={`font-medium ${hasTaskOverlap ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {slot.currentBookings} / {slot.maxBookings} reservado{slot.maxBookings > 1 ? 's' : ''}
                                  </p>
                                  {/* Patient Info from Bookings */}
                                  {activeBookings.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {activeBookings.map((booking) => (
                                        <div key={booking.id} className="bg-white border border-gray-100 rounded p-2">
                                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                            <User className="w-3 h-3 text-gray-500" />
                                            {booking.patientName}
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                              <Mail className="w-3 h-3" />
                                              {booking.patientEmail}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                              <Phone className="w-3 h-3" />
                                              {booking.patientPhone}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {hasTaskOverlap && (
                                    <p className="text-sm text-blue-600 font-medium mt-1">
                                      ℹ️ Pendiente a esta hora
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Tasks without time (at the end) */}
              {tasksWithoutTime.length > 0 && (
                <div className="border-l-4 border-gray-300 pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <h4 className="font-semibold text-gray-700">Sin hora específica</h4>
                  </div>
                  <div className="space-y-2">
                    {tasksWithoutTime.map(task => (
                      <div key={`task-notime-${task.id}`} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                Pendiente
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                                {task.priority}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                router.push(`/dashboard/pendientes/${task.id}`);
                                onClose();
                              }}
                              className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors"
                            >
                              {task.title}
                            </button>
                            {task.patient && (
                              <p className="text-sm text-gray-500 mt-1">
                                Paciente: {task.patient.firstName} {task.patient.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
