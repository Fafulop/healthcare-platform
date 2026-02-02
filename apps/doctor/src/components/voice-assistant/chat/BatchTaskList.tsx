'use client';

/**
 * BatchTaskList
 *
 * Component to display and edit multiple tasks in the voice chat sidebar.
 * Used when the LLM detects multiple tasks in a single voice recording.
 */

import { useState } from 'react';
import { Trash2, Edit2, Plus, AlertCircle, Clock, Calendar } from 'lucide-react';
import type { VoiceTaskData } from '@/types/voice-assistant';

interface BatchTaskListProps {
  entries: VoiceTaskData[];
  onUpdateEntries: (entries: VoiceTaskData[]) => void;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ALTA: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  MEDIA: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  BAJA: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
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

export function BatchTaskList({ entries, onUpdateEntries }: BatchTaskListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleRemoveEntry = (index: number) => {
    const updated = entries.filter((_, i) => i !== index);
    onUpdateEntries(updated);
  };

  const handleEditEntry = (index: number) => {
    setEditingIndex(index);
  };

  const handleAddEntry = () => {
    const newEntry: VoiceTaskData = {
      title: null,
      description: null,
      dueDate: null,
      startTime: null,
      endTime: null,
      priority: null,
      category: null,
      patientId: null,
    };
    onUpdateEntries([...entries, newEntry]);
    setEditingIndex(entries.length);
  };

  const formatDate = (dateStr: string) => {
    try {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-MX');
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">
          {entries.length} {entries.length === 1 ? 'Pendiente' : 'Pendientes'} Detectados
        </h3>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>

      {entries.map((entry, index) => {
        const priorityStyle = PRIORITY_COLORS[entry.priority || 'MEDIA'] || PRIORITY_COLORS.MEDIA;

        return (
          <div
            key={index}
            className={`border rounded-lg p-3 ${priorityStyle.border} bg-white`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-500">
                  #{index + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {entry.title || 'Sin título'}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEditEntry(index)}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  title="Editar"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRemoveEntry(index)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {entry.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {entry.description}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {entry.priority && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                  {entry.priority}
                </span>
              )}
              {entry.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  {CATEGORY_LABELS[entry.category] || entry.category}
                </span>
              )}
              {entry.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                  <Calendar className="w-3 h-3" />
                  {formatDate(entry.dueDate)}
                </span>
              )}
              {(entry.startTime || entry.endTime) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  <Clock className="w-3 h-3" />
                  {entry.startTime || '?'} - {entry.endTime || '?'}
                </span>
              )}
              {!entry.title && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
                  <AlertCircle className="w-3 h-3" />
                  Sin título
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
