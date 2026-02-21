'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, AlertCircle, User, Phone, Mail,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Loader2,
} from 'lucide-react';
import { useDayDetails } from '@/hooks/useDayDetails';
import { MiniCalendar } from './MiniCalendar';

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  BAJA: 'bg-green-100 text-green-800',
};

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA';
  category: string;
  patientId: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
}

function getSlotDisplayStatus(slot: AppointmentSlot) {
  if (!slot.isOpen) return { label: 'Cerrado', color: 'bg-gray-200 text-gray-700' };
  if (slot.currentBookings >= slot.maxBookings) return { label: 'Lleno', color: 'bg-blue-100 text-blue-700' };
  if (slot.currentBookings > 0) return { label: 'Reservado', color: 'bg-orange-100 text-orange-800' };
  return { label: 'Disponible', color: 'bg-green-100 text-green-800' };
}

export function DayDetailsSection() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const { data, loading, refetch } = useDayDetails();

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    refetch(newDate);
  };

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    handleDateChange(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    handleDateChange(d);
  };

  const todayStr = getLocalDateString(selectedDate);

  const tasksForDay = (data?.tasks ?? []).filter((t: Task) => {
    if (!t.dueDate) return false;
    return (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : getLocalDateString(new Date(t.dueDate))) === todayStr;
  });

  const slotsForDay = (data?.slots ?? []).filter((s: AppointmentSlot) => {
    return (typeof s.date === 'string' ? s.date.split('T')[0] : getLocalDateString(new Date(s.date))) === todayStr;
  });

  // Conflict detection
  const taskTaskConflictIds = new Set<string>();
  const bookedAppointmentWarningIds = new Set<string>();
  const slotTaskOverlapIds = new Set<string>();

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

  const openSlots = slotsForDay.filter((s: AppointmentSlot) => s.isOpen);
  for (const task of tasksForDay) {
    if (!task.startTime || !task.endTime || taskTaskConflictIds.has(task.id)) continue;
    for (const slot of openSlots) {
      if (slot.currentBookings > 0 && task.startTime < slot.endTime && task.endTime > slot.startTime) {
        bookedAppointmentWarningIds.add(task.id);
        break;
      }
    }
  }

  for (const slot of slotsForDay) {
    if (!slot.isOpen || slot.currentBookings === 0) continue;
    for (const task of tasksForDay) {
      if (!task.startTime || !task.endTime) continue;
      if (task.startTime < slot.endTime && task.endTime > slot.startTime) {
        slotTaskOverlapIds.add(slot.id);
        break;
      }
    }
  }

  type TimelineItem = { type: 'task' | 'appointment'; startTime: string; endTime: string; data: Task | AppointmentSlot };

  const timelineItems: TimelineItem[] = [
    ...tasksForDay.filter((t: Task) => t.startTime && t.endTime).map((t: Task) => ({
      type: 'task' as const, startTime: t.startTime!, endTime: t.endTime!, data: t,
    })),
    ...slotsForDay.filter((s: AppointmentSlot) => s.currentBookings > 0).map((s: AppointmentSlot) => ({
      type: 'appointment' as const, startTime: s.startTime, endTime: s.endTime, data: s,
    })),
  ];
  timelineItems.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.type.localeCompare(b.type));

  const timeSlots = new Map<string, TimelineItem[]>();
  for (const item of timelineItems) {
    const key = `${item.startTime}-${item.endTime}`;
    if (!timeSlots.has(key)) timeSlots.set(key, []);
    timeSlots.get(key)!.push(item);
  }

  const tasksWithoutTime = tasksForDay.filter((t: Task) => !t.startTime || !t.endTime);
  const hasContent = timelineItems.length > 0 || tasksWithoutTime.length > 0;
  const itemCount = tasksForDay.length + slotsForDay.filter((s: AppointmentSlot) => s.currentBookings > 0).length;

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          {/* Date nav */}
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={goToPrevDay} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-800 capitalize truncate">
              {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button onClick={goToNextDay} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {itemCount > 0 && (
              <span className="text-xs font-medium text-gray-500 mr-1">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            )}
            <button
              onClick={() => { setShowCalendar(v => !v); if (collapsed) setCollapsed(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showCalendar ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Fecha
            </button>
            <button onClick={() => setCollapsed(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mini calendar */}
        {showCalendar && !collapsed && (
          <div className="mt-3">
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                handleDateChange(date);
                setShowCalendar(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
              <Clock className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Sin pendientes ni citas para este día</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(timeSlots.entries()).map(([timeKey, items]) => {
                const [startTime, endTime] = timeKey.split('-');
                return (
                  <div key={timeKey} className="border-l-4 border-yellow-400 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <h4 className="font-semibold text-gray-900">{startTime} - {endTime}</h4>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => {
                        if (item.type === 'task') {
                          const task = item.data as Task;
                          const hasTaskConflict = taskTaskConflictIds.has(task.id);
                          const hasBookedWarning = bookedAppointmentWarningIds.has(task.id);
                          const borderColor = hasTaskConflict
                            ? 'border-red-300 bg-red-50'
                            : hasBookedWarning
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300';
                          return (
                            <div key={`task-${task.id}`} className={`border rounded-lg p-3 transition-colors ${borderColor}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">Pendiente</span>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                              </div>
                              <button
                                onClick={() => router.push(`/dashboard/pendientes/${task.id}`)}
                                className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors text-sm"
                              >
                                {task.title}
                              </button>
                              {(hasTaskConflict || hasBookedWarning) && (
                                <p className={`text-xs mt-1 font-medium ${hasTaskConflict ? 'text-red-600' : 'text-blue-600'}`}>
                                  {hasTaskConflict ? '⚠️ Conflicto con otro pendiente' : 'ℹ️ Cita reservada a esta hora'}
                                </p>
                              )}
                              {task.patient && (
                                <p className="text-xs text-gray-500 mt-1">Paciente: {task.patient.firstName} {task.patient.lastName}</p>
                              )}
                            </div>
                          );
                        } else {
                          const slot = item.data as AppointmentSlot;
                          const hasTaskOverlap = slotTaskOverlapIds.has(slot.id);
                          const slotStatus = getSlotDisplayStatus(slot);
                          const activeBookings = slot.bookings?.filter(b => b.status !== 'CANCELLED') ?? [];
                          return (
                            <div key={`slot-${slot.id}`} className={`border rounded-lg p-3 ${hasTaskOverlap ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800">Cita</span>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${slotStatus.color}`}>{slotStatus.label}</span>
                              </div>
                              <p className={`font-medium text-sm ${hasTaskOverlap ? 'text-blue-700' : 'text-gray-900'}`}>
                                {slot.currentBookings} / {slot.maxBookings} reservado{slot.maxBookings > 1 ? 's' : ''}
                              </p>
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
                                          <Mail className="w-3 h-3" />{booking.patientEmail}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <Phone className="w-3 h-3" />{booking.patientPhone}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {hasTaskOverlap && (
                                <p className="text-xs text-blue-600 font-medium mt-1">ℹ️ Pendiente a esta hora</p>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}

              {tasksWithoutTime.length > 0 && (
                <div className="border-l-4 border-gray-300 pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <h4 className="font-semibold text-gray-700">Sin hora específica</h4>
                  </div>
                  <div className="space-y-2">
                    {tasksWithoutTime.map((task: Task) => (
                      <div key={`task-notime-${task.id}`} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">Pendiente</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                        </div>
                        <button
                          onClick={() => router.push(`/dashboard/pendientes/${task.id}`)}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors text-sm"
                        >
                          {task.title}
                        </button>
                        {task.patient && (
                          <p className="text-xs text-gray-500 mt-1">Paciente: {task.patient.firstName} {task.patient.lastName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
