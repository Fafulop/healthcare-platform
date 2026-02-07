'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LayoutGrid, Plus } from 'lucide-react';
import { useFormBuilder } from './FormBuilderProvider';
import { CanvasField } from './CanvasField';

export function Canvas() {
  const { state, addField } = useFormBuilder();
  const { fields } = state;

  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' });

  const fieldIds = fields.map((f) => f.id);

  // Group by section for display
  const sections = new Map<string, typeof fields>();
  fields
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((f) => {
      const section = f.section || 'General';
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section)!.push(f);
    });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 p-4 overflow-y-auto bg-gray-50 min-h-0 ${
        isOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/50' : ''
      }`}
    >
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <LayoutGrid className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-1">
            Sin campos aun
          </h3>
          <p className="text-sm text-gray-400 mb-4 max-w-xs">
            Arrastra campos desde la paleta a la izquierda, o haz clic en el
            boton de abajo para agregar tu primer campo.
          </p>
          <button
            type="button"
            onClick={() => addField('text')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Agregar Primer Campo
          </button>
        </div>
      ) : (
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-6 max-w-2xl mx-auto">
            {Array.from(sections.entries()).map(([sectionName, sectionFields]) => (
              <div key={sectionName}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    {sectionName}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="space-y-1.5">
                  {sectionFields.map((field) => (
                    <CanvasField key={field.id} field={field} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Add field button at bottom */}
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => addField('text')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Campo
            </button>
          </div>
        </SortableContext>
      )}
    </div>
  );
}
