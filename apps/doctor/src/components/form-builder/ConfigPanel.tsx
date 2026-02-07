'use client';

import { X, Trash2, Plus } from 'lucide-react';
import { useFormBuilder } from './FormBuilderProvider';
import { FieldTypeIcon, getFieldTypeLabel } from './FieldTypeIcon';

export function ConfigPanel() {
  const { state, selectedField, updateField, removeField, selectField, sections } =
    useFormBuilder();

  if (!selectedField) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4 flex-shrink-0 hidden lg:flex flex-col items-center justify-center text-center">
        <p className="text-sm text-gray-400">
          Selecciona un campo para editar sus propiedades
        </p>
      </div>
    );
  }

  const errors = state.validationErrors[selectedField.id] || [];
  const field = selectedField;

  const handleUpdate = (updates: Partial<typeof field>) => {
    updateField(field.id, updates);
  };

  const handleOptionsChange = (index: number, value: string) => {
    const options = [...(field.options || [])];
    options[index] = value;
    handleUpdate({ options });
  };

  const handleAddOption = () => {
    const options = [...(field.options || []), `Opcion ${(field.options?.length || 0) + 1}`];
    handleUpdate({ options });
  };

  const handleRemoveOption = (index: number) => {
    const options = (field.options || []).filter((_, i) => i !== index);
    handleUpdate({ options });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex-shrink-0 hidden lg:flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FieldTypeIcon type={field.type} className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            Propiedades de {getFieldTypeLabel(field.type)}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => selectField(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {errors.map((err, i) => (
            <div key={i}>&bull; {err}</div>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Field Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Nombre del campo (camelCase)
          </label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            placeholder="e.g., chiefComplaint"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Etiqueta
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => handleUpdate({ label: e.target.value })}
            placeholder="Etiqueta visible"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Label ES */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Etiqueta (Espanol)
          </label>
          <input
            type="text"
            value={field.labelEs}
            onChange={(e) => handleUpdate({ labelEs: e.target.value })}
            placeholder="Etiqueta en español"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Required */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="field-required"
            checked={field.required}
            onChange={(e) => handleUpdate({ required: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="field-required" className="text-sm text-gray-700">
            Requerido
          </label>
        </div>

        {/* Section */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Seccion
          </label>
          <input
            type="text"
            value={field.section || ''}
            onChange={(e) => handleUpdate({ section: e.target.value })}
            placeholder="General"
            list="sections-list"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="sections-list">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Width */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Ancho
          </label>
          <div className="flex gap-2">
            {(['full', 'half', 'third'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => handleUpdate({ width: w })}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  field.width === w
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {w === 'full' ? 'Completo' : w === 'half' ? 'Mitad' : 'Tercio'}
              </button>
            ))}
          </div>
        </div>

        {/* Placeholder (text, textarea) */}
        {(field.type === 'text' || field.type === 'textarea') && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Texto de ejemplo
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => handleUpdate({ placeholder: e.target.value })}
              placeholder="Texto de ejemplo"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Number-specific: min, max, step */}
        {field.type === 'number' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Min.
              </label>
              <input
                type="number"
                value={field.min ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max.
              </label>
              <input
                type="number"
                value={field.max ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Step
              </label>
              <input
                type="number"
                value={field.step ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    step: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Options (dropdown, radio) */}
        {(field.type === 'dropdown' || field.type === 'radio') && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Opciones
            </label>
            <div className="space-y-1.5">
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionsChange(i, e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(i)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Opcion
              </button>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Texto de ayuda
          </label>
          <input
            type="text"
            value={field.helpText || ''}
            onChange={(e) => handleUpdate({ helpText: e.target.value })}
            placeholder="Texto de ayuda opcional"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => {
            removeField(field.id);
          }}
          className="flex items-center gap-2 w-full justify-center px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar Campo
        </button>
      </div>
    </div>
  );
}
