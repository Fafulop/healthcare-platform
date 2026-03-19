'use client';

import { useState } from 'react';
import { Clock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { TaskDetailModal, type Task } from './TaskDetailModal';
import { AppointmentDetailModal, type AppointmentSlot } from './AppointmentDetailModal';

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  BAJA: 'bg-green-100 text-green-800',
};

function getSlotDisplayStatus(slot: AppointmentSlot) {
  if (!slot.isOpen) return { label: 'Cerrado', color: 'bg-gray-200 text-gray-700' };
  if (slot.currentBookings >= slot.maxBookings) return { label: 'Lleno', color: 'bg-blue-100 text-blue-700' };
  if (slot.currentBookings > 0) return { label: 'Reservado', color: 'bg-orange-100 text-orange-800' };
  return { label: 'Disponible', color: 'bg-green-100 text-green-800' };
}

interface Props {
  tasks: Task[];
  slots: AppointmentSlot[];
  loading: boolean;
  onToggleComplete?: (taskId: string, currentStatus: string) => void;
}

export function DayItineraryContent({ tasks, slots, loading, onToggleComplete }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);

  // Conflict detection
  const taskTaskConflictIds = new Set<string>();
  const bookedAppointmentWarningIds = new Set<string>();
  const slotTaskOverlapIds = new Set<string>();

  for (const task of tasks) {
    if (!task.startTime || !task.endTime) continue;
    for (const other of tasks) {
      if (other.id === task.id || !other.startTime || !other.endTime) continue;
      if (task.startTime < other.endTime && task.endTime > other.startTime) {
        taskTaskConflictIds.add(task.id);
        taskTaskConflictIds.add(other.id);
      }
    }
  }

  const openSlots = slots.filter(s => s.isOpen);
  for (const task of tasks) {
    if (!task.startTime || !task.endTime || taskTaskConflictIds.has(task.id)) continue;
    for (const slot of openSlots) {
      if (slot.currentBookings > 0 && task.startTime < slot.endTime && task.endTime > slot.startTime) {
        bookedAppointmentWarningIds.add(task.id);
        break;
      }
    }
  }

  for (const slot of slots) {
    if (!slot.isOpen || slot.currentBookings === 0) continue;
    for (const task of tasks) {
      if (!task.startTime || !task.endTime) continue;
      if (task.startTime < slot.endTime && task.endTime > slot.startTime) {
        slotTaskOverlapIds.add(slot.id);
        break;
      }
    }
  }

  type TimelineItem = { type: 'task' | 'appointment'; startTime: string; endTime: string; data: Task | AppointmentSlot };

  const timelineItems: TimelineItem[] = [
    ...tasks.filter(t => t.startTime && t.endTime).map(t => ({
      type: 'task' as const, startTime: t.startTime!, endTime: t.endTime!, data: t,
    })),
    ...slots.filter(s => s.currentBookings > 0).map(s => ({
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

  const tasksWithoutTime = tasks.filter(t => !t.startTime || !t.endTime);
  const hasContent = timelineItems.length > 0 || tasksWithoutTime.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin pendientes ni citas para este día</p>
      </div>
    );
  }

  return (
    <>
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
                {items.map(item => {
                  if (item.type === 'task') {
                    const task = item.data as Task;
                    const hasTaskConflict = taskTaskConflictIds.has(task.id);
                    const hasBookedWarning = bookedAppointmentWarningIds.has(task.id);
                    const borderColor = hasTaskConflict
                      ? 'border-red-300 bg-red-50'
                      : hasBookedWarning
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30';
                    return (
                      <div
                        key={`task-${task.id}`}
                        className={`border rounded-lg p-3 transition-colors cursor-pointer ${borderColor}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">Pendiente</span>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                            </div>
                            <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                            {(hasTaskConflict || hasBookedWarning) && (
                              <p className={`text-xs mt-1 font-medium ${hasTaskConflict ? 'text-red-600' : 'text-blue-600'}`}>
                                {hasTaskConflict ? '⚠️ Conflicto con otro pendiente' : 'ℹ️ Cita reservada a esta hora'}
                              </p>
                            )}
                            {task.patient && (
                              <p className="text-xs text-gray-500 mt-1">Paciente: {task.patient.firstName} {task.patient.lastName}</p>
                            )}
                          </div>
                          {onToggleComplete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, task.status); }}
                              className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${task.status === 'COMPLETADA' ? 'text-green-600 hover:text-green-800 hover:bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                              title={task.status === 'COMPLETADA' ? 'Marcar pendiente' : 'Completar'}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    const slot = item.data as AppointmentSlot;
                    const hasTaskOverlap = slotTaskOverlapIds.has(slot.id);
                    const slotStatus = getSlotDisplayStatus(slot);
                    const activeBookings = slot.bookings?.filter(b => b.status !== 'CANCELLED') ?? [];
                    return (
                      <div
                        key={`slot-${slot.id}`}
                        className={`border rounded-lg p-3 transition-colors cursor-pointer ${hasTaskOverlap ? 'border-blue-300 bg-blue-50 hover:border-blue-400' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/30'}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800">Cita</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${slotStatus.color}`}>{slotStatus.label}</span>
                        </div>
                        <p className={`font-medium text-sm ${hasTaskOverlap ? 'text-blue-700' : 'text-gray-900'}`}>
                          {slot.currentBookings} / {slot.maxBookings} reservado{slot.maxBookings > 1 ? 's' : ''}
                        </p>
                        {activeBookings.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {activeBookings.map(booking => (
                              <p key={booking.id} className="text-xs text-gray-600 truncate">• {booking.patientName}</p>
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
              {tasksWithoutTime.map(task => (
                <div
                  key={`task-notime-${task.id}`}
                  className="border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">Pendiente</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      {task.patient && (
                        <p className="text-xs text-gray-500 mt-1">Paciente: {task.patient.firstName} {task.patient.lastName}</p>
                      )}
                    </div>
                    {onToggleComplete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, task.status); }}
                        className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${task.status === 'COMPLETADA' ? 'text-green-600 hover:text-green-800 hover:bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={task.status === 'COMPLETADA' ? 'Marcar pendiente' : 'Completar'}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onToggleComplete={onToggleComplete}
      />
      <AppointmentDetailModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </>
  );
}
