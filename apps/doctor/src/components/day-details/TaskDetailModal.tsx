'use client';

import { X, Clock, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  BAJA: 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  EN_PROGRESO: 'bg-blue-100 text-blue-800',
  COMPLETADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En Progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

const CATEGORY_LABELS: Record<string, string> = {
  SEGUIMIENTO: 'Seguimiento',
  ADMINISTRATIVO: 'Administrativo',
  LABORATORIO: 'Laboratorio',
  RECETA: 'Receta',
  REFERENCIA: 'Referencia',
  PERSONAL: 'Personal',
  OTRO: 'Otro',
};

export interface Task {
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

interface Props {
  task: Task | null;
  onClose: () => void;
  onToggleComplete?: (taskId: string, currentStatus: string) => void;
  zIndex?: string;
}

export function TaskDetailModal({ task, onClose, onToggleComplete, zIndex = 'z-50' }: Props) {
  if (!task) return null;

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 leading-snug">{task.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              {CATEGORY_LABELS[task.category] ?? task.category}
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
          )}

          {/* Time */}
          {task.startTime && task.endTime && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 flex-shrink-0 text-yellow-600" />
              <span>{task.startTime} – {task.endTime}</span>
            </div>
          )}

          {/* Due date */}
          {task.dueDate && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Vence:</span>{' '}
              {task.dueDate.split('T')[0]}
            </p>
          )}

          {/* Patient */}
          {task.patient && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span>{task.patient.firstName} {task.patient.lastName}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-2">
          {onToggleComplete && task.status !== 'CANCELADA' && (
            <button
              onClick={() => { onToggleComplete(task.id, task.status); onClose(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                task.status === 'COMPLETADA'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {task.status === 'COMPLETADA' ? 'Marcar pendiente' : 'Completar'}
            </button>
          )}
          <Link
            href={`/dashboard/pendientes/${task.id}`}
            className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex-shrink-0"
          >
            Ver tarea
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
