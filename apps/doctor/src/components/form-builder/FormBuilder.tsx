'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { FieldDefinition, FieldType, CustomEncounterTemplate } from '@/types/custom-encounter';
import { FormBuilderProvider, useFormBuilder } from './FormBuilderProvider';
import { Toolbar } from './Toolbar';
import { FieldPalette } from './FieldPalette';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import { PreviewMode } from './PreviewMode';
import { AIChatPanel } from './AIChatPanel';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';

// =============================================================================
// INNER COMPONENT (has access to context)
// =============================================================================

interface FormBuilderInnerProps {
  onSave: (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    customFields: FieldDefinition[];
  }) => Promise<void>;
}

function FormBuilderInner({ onSave }: FormBuilderInnerProps) {
  const { state, addField, reorderField, validateNow } = useFormBuilder();
  const [saving, setSaving] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [dragActiveType, setDragActiveType] = useState<FieldType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'palette-item') {
      setDragActiveType(data.fieldType as FieldType);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragActiveType(null);
      const { active, over } = event;

      if (!over) return;

      const activeData = active.data.current;

      // Palette → Canvas drop
      if (activeData?.type === 'palette-item') {
        addField(activeData.fieldType as FieldType);
        return;
      }

      // Reorder within canvas
      if (active.id !== over.id) {
        const fields = state.fields;
        const newIndex = fields.findIndex((f) => f.id === over.id);
        if (newIndex !== -1) {
          reorderField(active.id as string, newIndex);
        }
      }
    },
    [state.fields, addField, reorderField]
  );

  const handleSave = async () => {
    const errors = validateNow();
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await onSave({
        name: state.metadata.name,
        description: state.metadata.description || undefined,
        icon: state.metadata.icon,
        color: state.metadata.color,
        customFields: state.fields,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-100">
        {/* Back link */}
        <div className="px-4 pt-3">
          <Link
            href="/dashboard/medical-records/custom-templates"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Plantillas
          </Link>
        </div>

        {/* Toolbar */}
        <Toolbar
          onSave={handleSave}
          saving={saving}
          onToggleAIChat={() => setShowAIChat((v) => !v)}
          showAIChat={showAIChat}
        />

        {/* Main area */}
        <div className="flex flex-1 min-h-0 relative">
          {state.mode === 'edit' ? (
            <>
              {/* Palette (hidden on small screens) */}
              <div className="hidden md:block">
                <FieldPalette />
              </div>

              {/* Canvas */}
              <Canvas />

              {/* Config Panel */}
              <ConfigPanel />

              {/* AI Chat Panel */}
              {showAIChat && (
                <AIChatPanel onClose={() => setShowAIChat(false)} />
              )}
            </>
          ) : (
            <PreviewMode />
          )}
        </div>

        {/* Mobile add field bar */}
        {state.mode === 'edit' && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => addField('text')}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              + Agregar Campo
            </button>
          </div>
        )}
      </div>

      {/* Drag overlay for palette items */}
      <DragOverlay>
        {dragActiveType && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-300 rounded-lg shadow-lg">
            <FieldTypeIcon type={dragActiveType} className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              {getFieldTypeLabel(dragActiveType)}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// =============================================================================
// PUBLIC COMPONENT
// =============================================================================

interface FormBuilderProps {
  initialTemplate?: CustomEncounterTemplate | null;
  onSave: (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    customFields: FieldDefinition[];
  }) => Promise<void>;
}

export function FormBuilder({ initialTemplate, onSave }: FormBuilderProps) {
  return (
    <FormBuilderProvider
      initialMetadata={
        initialTemplate
          ? {
              name: initialTemplate.name,
              description: initialTemplate.description ?? '',
              icon: initialTemplate.icon ?? undefined,
              color: initialTemplate.color ?? undefined,
            }
          : undefined
      }
      initialFields={initialTemplate?.customFields}
    >
      <FormBuilderInner onSave={onSave} />
    </FormBuilderProvider>
  );
}
