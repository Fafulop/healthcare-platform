'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type {
  EncounterTemplate,
  FieldVisibility,
  DefaultValues,
  TemplateIcon,
  TemplateColor,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '@/types/encounter-template';
import {
  ENCOUNTER_FIELDS,
  FIELDS_BY_GROUP,
  GROUP_LABELS,
  TEMPLATE_ICONS,
  TEMPLATE_COLORS,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_VALUES,
  getColorClasses,
  validateTemplateName,
  validateFieldVisibility,
} from '@/constants/encounter-fields';
import { ICON_COMPONENTS } from './TemplateSelector';

interface TemplateEditorProps {
  template?: EncounterTemplate; // Existing template for editing, undefined for create
  onSave: (data: CreateTemplateInput | UpdateTemplateInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isLoading = false,
}: TemplateEditorProps) {
  const isEditing = !!template;

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [icon, setIcon] = useState<TemplateIcon | undefined>(
    template?.icon as TemplateIcon | undefined
  );
  const [color, setColor] = useState<TemplateColor | undefined>(
    template?.color as TemplateColor | undefined
  );
  const [fieldVisibility, setFieldVisibility] = useState<FieldVisibility>(
    (template?.fieldVisibility as FieldVisibility) || { ...DEFAULT_FIELD_VISIBILITY }
  );
  const [defaultValues, setDefaultValues] = useState<DefaultValues>(
    (template?.defaultValues as DefaultValues) || { ...DEFAULT_VALUES }
  );
  const [useSOAPMode, setUseSOAPMode] = useState(template?.useSOAPMode ?? true);
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle field visibility toggle
  const toggleFieldVisibility = (fieldKey: keyof FieldVisibility) => {
    setFieldVisibility((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  // Handle default value change
  const updateDefaultValue = (fieldKey: keyof DefaultValues, value: string) => {
    setDefaultValues((prev) => ({
      ...prev,
      [fieldKey]: value || undefined,
    }));
  };

  // Toggle all vitals
  const toggleAllVitals = (show: boolean) => {
    setFieldVisibility((prev) => ({
      ...prev,
      vitalsBloodPressure: show,
      vitalsHeartRate: show,
      vitalsTemperature: show,
      vitalsWeight: show,
      vitalsHeight: show,
      vitalsOxygenSat: show,
      vitalsOther: show,
    }));
  };

  // Toggle all clinical fields
  const toggleAllClinical = (show: boolean) => {
    setFieldVisibility((prev) => ({
      ...prev,
      clinicalNotes: show,
      subjective: show,
      objective: show,
      assessment: show,
      plan: show,
    }));
  };

  // Toggle all follow-up fields
  const toggleAllFollowUp = (show: boolean) => {
    setFieldVisibility((prev) => ({
      ...prev,
      followUpDate: show,
      followUpNotes: show,
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateTemplateName(name);
    if (nameError) newErrors.name = nameError;

    const visibilityError = validateFieldVisibility(fieldVisibility);
    if (visibilityError) newErrors.visibility = visibilityError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data: CreateTemplateInput | UpdateTemplateInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      fieldVisibility,
      defaultValues,
      useSOAPMode,
      isDefault,
    };

    await onSave(data);
  };

  // Render field toggle
  const renderFieldToggle = (field: typeof ENCOUNTER_FIELDS[0]) => {
    if (!field.canHide) return null;

    const fieldKey = field.key as keyof FieldVisibility;
    const isVisible = fieldVisibility[fieldKey];

    return (
      <div key={field.key} className="flex items-center justify-between py-2">
        <label htmlFor={`field-${field.key}`} className="text-sm text-gray-700 cursor-pointer">
          {field.labelEs}
        </label>
        <button
          type="button"
          id={`field-${field.key}`}
          onClick={() => toggleFieldVisibility(fieldKey)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isVisible ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isVisible ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  };

  // Render default value input
  const renderDefaultValueInput = (field: typeof ENCOUNTER_FIELDS[0]) => {
    if (!field.canSetDefault) return null;

    const fieldKey = field.key as keyof DefaultValues;
    const value = defaultValues[fieldKey] || '';

    if (field.defaultType === 'select' && field.selectOptions) {
      return (
        <div key={field.key} className="py-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.labelEs}
          </label>
          <select
            value={value}
            onChange={(e) => updateDefaultValue(fieldKey, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin valor predeterminado</option>
            {field.selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.defaultType === 'textarea') {
      return (
        <div key={field.key} className="py-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.labelEs}
          </label>
          <textarea
            value={value}
            onChange={(e) => updateDefaultValue(fieldKey, e.target.value)}
            rows={2}
            placeholder="Texto predeterminado (opcional)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }

    return (
      <div key={field.key} className="py-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.labelEs}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => updateDefaultValue(fieldKey, e.target.value)}
          placeholder="Valor predeterminado (opcional)"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de la Plantilla</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Consulta Dermatología"
              maxLength={100}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción breve de la plantilla (opcional)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_ICONS.map((iconOption) => {
                const IconComponent = ICON_COMPONENTS[iconOption.value];
                const isSelected = icon === iconOption.value;
                return (
                  <button
                    key={iconOption.value}
                    type="button"
                    onClick={() => setIcon(iconOption.value)}
                    title={iconOption.label}
                    className={`p-2 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_COLORS.map((colorOption) => {
                const isSelected = color === colorOption.value;
                return (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => setColor(colorOption.value)}
                    title={colorOption.label}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${colorOption.bgClass} ${
                      isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : 'border-transparent'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Field Visibility */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Campos Visibles</h2>
        <p className="text-sm text-gray-600 mb-4">
          Seleccione qué campos se mostrarán al usar esta plantilla. Los campos obligatorios
          (fecha, tipo, motivo) siempre están visibles.
        </p>

        {errors.visibility && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{errors.visibility}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Vitals Group */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">{GROUP_LABELS.vitals.es}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllVitals(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mostrar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllVitals(false)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Ocultar todos
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-4">
              {FIELDS_BY_GROUP.vitals.map(renderFieldToggle)}
            </div>
          </div>

          {/* Clinical Group */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">{GROUP_LABELS.clinical.es}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllClinical(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mostrar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllClinical(false)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Ocultar todos
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-4">
              {FIELDS_BY_GROUP.clinical.filter((f) => f.canHide).map(renderFieldToggle)}
            </div>
          </div>

          {/* Follow-up Group */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">{GROUP_LABELS.followUp.es}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllFollowUp(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mostrar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllFollowUp(false)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Ocultar todos
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-4">
              {FIELDS_BY_GROUP.followUp.map(renderFieldToggle)}
            </div>
          </div>

          {/* Location (Basic Group) */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">{GROUP_LABELS.basic.es}</h3>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-4">
              {FIELDS_BY_GROUP.basic.filter((f) => f.canHide).map(renderFieldToggle)}
            </div>
          </div>
        </div>
      </div>

      {/* Default Values */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Valores Predeterminados</h2>
        <p className="text-sm text-gray-600 mb-4">
          Defina valores que se llenarán automáticamente al usar esta plantilla.
        </p>

        <div className="space-y-4">
          {ENCOUNTER_FIELDS.filter((f) => f.canSetDefault).map(renderDefaultValueInput)}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h2>

        <div className="space-y-4">
          {/* SOAP Mode */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="soap-mode" className="text-sm font-medium text-gray-700">
                Usar formato SOAP
              </label>
              <p className="text-sm text-gray-500">
                Mostrar campos estructurados (Subjetivo, Objetivo, Evaluación, Plan)
              </p>
            </div>
            <button
              type="button"
              id="soap-mode"
              onClick={() => setUseSOAPMode(!useSOAPMode)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                useSOAPMode ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  useSOAPMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Default Template */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="is-default" className="text-sm font-medium text-gray-700">
                Plantilla predeterminada
              </label>
              <p className="text-sm text-gray-500">
                Usar esta plantilla por defecto al crear consultas
              </p>
            </div>
            <button
              type="button"
              id="is-default"
              onClick={() => setIsDefault(!isDefault)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isDefault ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDefault ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {isEditing ? 'Guardar Cambios' : 'Crear Plantilla'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
