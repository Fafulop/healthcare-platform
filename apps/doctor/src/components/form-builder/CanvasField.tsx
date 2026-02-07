'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, AlertCircle } from 'lucide-react';
import type { FieldDefinition } from '@/types/custom-encounter';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';
import { useFormBuilder } from './FormBuilderProvider';

interface CanvasFieldProps {
  field: FieldDefinition;
}

export function CanvasField({ field }: CanvasFieldProps) {
  const { state, selectField, removeField } = useFormBuilder();
  const isSelected = state.selectedFieldId === field.id;
  const errors = state.validationErrors[field.id] || [];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => selectField(field.id)}
      className={`group flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      } ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${errors.length > 0 ? 'border-red-300 bg-red-50' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <FieldTypeIcon type={field.type} className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate">
            {field.label || 'Campo sin titulo'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {field.required && (
            <span className="text-xs text-red-500 font-medium">Requerido</span>
          )}
          <span className="text-xs text-gray-400">
            {getFieldTypeLabel(field.type)}
          </span>
          {field.section && field.section !== 'General' && (
            <span className="text-xs text-gray-400">
              &middot; {field.section}
            </span>
          )}
        </div>
      </div>

      {/* Error indicator */}
      {errors.length > 0 && (
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          removeField(field.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
