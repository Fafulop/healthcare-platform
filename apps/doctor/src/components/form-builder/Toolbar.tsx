'use client';

import { Save, Eye, Pencil, Loader2, Sparkles } from 'lucide-react';
import { useFormBuilder } from './FormBuilderProvider';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { ValidationDisplay } from './ValidationDisplay';

interface ToolbarProps {
  onSave: () => void;
  saving: boolean;
  onToggleAIChat?: () => void;
  showAIChat?: boolean;
}

export function Toolbar({ onSave, saving, onToggleAIChat, showAIChat }: ToolbarProps) {
  const { state, setMetadata, setMode, hasErrors } = useFormBuilder();
  const { metadata, mode, validationErrors } = state;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Name */}
        <input
          type="text"
          value={metadata.name}
          onChange={(e) => setMetadata({ name: e.target.value })}
          placeholder="Nombre de la plantilla"
          className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 min-w-[200px] flex-1"
        />

        {/* Description */}
        <input
          type="text"
          value={metadata.description}
          onChange={(e) => setMetadata({ description: e.target.value })}
          placeholder="Descripcion (opcional)"
          className="text-sm text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 min-w-[200px] flex-1"
        />

        {/* Icon */}
        <IconPicker
          value={metadata.icon}
          onChange={(icon) => setMetadata({ icon })}
        />

        {/* Color */}
        <ColorPicker
          value={metadata.color}
          onChange={(color) => setMetadata({ color })}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'preview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            Vista previa
          </button>
        </div>

        {/* AI Chat toggle */}
        {state.mode === 'edit' && onToggleAIChat && (
          <button
            type="button"
            onClick={onToggleAIChat}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAIChat
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
            title="Asistente IA"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">IA</span>
          </button>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || hasErrors}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 text-sm font-medium transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar
            </>
          )}
        </button>
      </div>

      {/* Validation errors */}
      {hasErrors && (
        <div className="mt-3">
          <ValidationDisplay errors={validationErrors} />
        </div>
      )}
    </div>
  );
}
