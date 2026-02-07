'use client';

import { useDraggable } from '@dnd-kit/core';
import type { FieldType } from '@/types/custom-encounter';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';
import { useFormBuilder } from './FormBuilderProvider';

const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'dropdown',
  'radio',
  'checkbox',
  'file',
];

function DraggableFieldType({ type }: { type: FieldType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type: 'palette-item', fieldType: type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50 transition-colors select-none ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <FieldTypeIcon type={type} className="w-4 h-4 text-gray-500" />
      <span className="text-sm font-medium text-gray-700">
        {getFieldTypeLabel(type)}
      </span>
    </div>
  );
}

function ClickableFieldType({ type }: { type: FieldType }) {
  const { addField } = useFormBuilder();

  return (
    <button
      type="button"
      onClick={() => addField(type)}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left w-full"
    >
      <FieldTypeIcon type={type} className="w-4 h-4 text-gray-500" />
      <span className="text-sm font-medium text-gray-700">
        {getFieldTypeLabel(type)}
      </span>
    </button>
  );
}

export function FieldPalette() {
  return (
    <div className="w-60 bg-white border-r border-gray-200 p-4 overflow-y-auto flex-shrink-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Tipos de Campo
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Arrastra al lienzo o haz clic para agregar
      </p>
      <div className="space-y-1.5">
        {FIELD_TYPES.map((type) => (
          <div key={type}>
            {/* Show draggable on desktop, clickable as fallback */}
            <div className="hidden md:block">
              <DraggableFieldType type={type} />
            </div>
            <div className="md:hidden">
              <ClickableFieldType type={type} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
