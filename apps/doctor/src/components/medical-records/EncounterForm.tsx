'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { VitalsInput, type VitalsData } from './VitalsInput';
import { SOAPNoteEditor, type SOAPNoteData } from './SOAPNoteEditor';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import type { FieldVisibility, DefaultValues } from '@/types/encounter-template';
import type { CustomEncounterTemplate } from '@/types/custom-encounter';
import { DEFAULT_FIELD_VISIBILITY } from '@/constants/encounter-fields';

export interface EncounterFormData {
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  location?: string;
  clinicalNotes?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
  followUpDate?: string;
  followUpNotes?: string;
  status: string;
  customData?: Record<string, any>; // For custom template fields
  templateId?: string; // Reference to the template used
}

// Template configuration for conditional rendering
export interface TemplateConfig {
  fieldVisibility: FieldVisibility;
  defaultValues: DefaultValues;
  useSOAPMode: boolean;
}

interface EncounterFormProps {
  patientId: string;
  initialData?: Partial<EncounterFormData>;
  onSubmit: (data: EncounterFormData) => Promise<void>;
  submitLabel?: string;
  cancelHref?: string;
  isEditing?: boolean;
  templateConfig?: TemplateConfig; // Template-based configuration
  selectedTemplate?: CustomEncounterTemplate | null; // For custom templates
}

export function EncounterForm({
  patientId,
  initialData = {},
  onSubmit,
  submitLabel = 'Crear Consulta',
  cancelHref,
  isEditing = false,
  templateConfig,
  selectedTemplate,
}: EncounterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if using custom template
  const isCustomTemplate = selectedTemplate?.isCustom === true;

  // State for custom field values
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(
    initialData?.customData || {}
  );

  // Field visibility from template or show all by default
  const fieldVisibility = templateConfig?.fieldVisibility || DEFAULT_FIELD_VISIBILITY;

  // Initialize SOAP mode from template config or detect from initial data
  const [useSOAP, setUseSOAP] = useState(
    templateConfig?.useSOAPMode ??
    !!(initialData.subjective || initialData.objective || initialData.assessment || initialData.plan)
  );

  const defaultCancelHref = cancelHref || `/dashboard/medical-records/patients/${patientId}`;

  // Helper to get local date string (fixes timezone issues)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Merge template default values with initial data (voice data overrides template defaults)
  const templateDefaults = templateConfig?.defaultValues || {};

  const [formData, setFormData] = useState<EncounterFormData>({
    encounterDate: initialData.encounterDate ? initialData.encounterDate.split('T')[0] : getLocalDateString(new Date()),
    encounterType: initialData.encounterType || templateDefaults.encounterType || 'consultation',
    chiefComplaint: initialData.chiefComplaint || '',
    location: initialData.location || templateDefaults.location || '',
    clinicalNotes: initialData.clinicalNotes || templateDefaults.clinicalNotes || '',
    subjective: initialData.subjective || templateDefaults.subjective || '',
    objective: initialData.objective || templateDefaults.objective || '',
    assessment: initialData.assessment || templateDefaults.assessment || '',
    plan: initialData.plan || templateDefaults.plan || '',
    vitalsBloodPressure: initialData.vitalsBloodPressure || '',
    vitalsHeartRate: initialData.vitalsHeartRate,
    vitalsTemperature: initialData.vitalsTemperature,
    vitalsWeight: initialData.vitalsWeight,
    vitalsHeight: initialData.vitalsHeight,
    vitalsOxygenSat: initialData.vitalsOxygenSat,
    vitalsOther: initialData.vitalsOther || '',
    followUpDate: initialData.followUpDate ? initialData.followUpDate.split('T')[0] : '',
    followUpNotes: initialData.followUpNotes || templateDefaults.followUpNotes || '',
    status: initialData.status || 'draft',
  });

  // Sync form state when initialData changes (e.g., from voice assistant)
  useEffect(() => {
    // Only update if initialData has meaningful content
    const hasContent = initialData && Object.values(initialData).some(
      v => v !== undefined && v !== null && v !== ''
    );

    if (hasContent) {
      setFormData(prev => ({
        encounterDate: initialData.encounterDate ? initialData.encounterDate.split('T')[0] : prev.encounterDate,
        encounterType: initialData.encounterType || prev.encounterType,
        chiefComplaint: initialData.chiefComplaint || prev.chiefComplaint,
        location: initialData.location ?? prev.location,
        clinicalNotes: initialData.clinicalNotes ?? prev.clinicalNotes,
        subjective: initialData.subjective ?? prev.subjective,
        objective: initialData.objective ?? prev.objective,
        assessment: initialData.assessment ?? prev.assessment,
        plan: initialData.plan ?? prev.plan,
        vitalsBloodPressure: initialData.vitalsBloodPressure ?? prev.vitalsBloodPressure,
        vitalsHeartRate: initialData.vitalsHeartRate ?? prev.vitalsHeartRate,
        vitalsTemperature: initialData.vitalsTemperature ?? prev.vitalsTemperature,
        vitalsWeight: initialData.vitalsWeight ?? prev.vitalsWeight,
        vitalsHeight: initialData.vitalsHeight ?? prev.vitalsHeight,
        vitalsOxygenSat: initialData.vitalsOxygenSat ?? prev.vitalsOxygenSat,
        vitalsOther: initialData.vitalsOther ?? prev.vitalsOther,
        followUpDate: initialData.followUpDate ? initialData.followUpDate.split('T')[0] : prev.followUpDate,
        followUpNotes: initialData.followUpNotes ?? prev.followUpNotes,
        status: initialData.status || prev.status,
      }));

      // Auto-enable SOAP mode if SOAP fields are populated
      if (initialData.subjective || initialData.objective || initialData.assessment || initialData.plan) {
        setUseSOAP(true);
      }
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleVitalsChange = (vitals: VitalsData) => {
    setFormData({
      ...formData,
      ...vitals
    });
  };

  const handleSOAPChange = (soapNotes: SOAPNoteData) => {
    setFormData({
      ...formData,
      ...soapNotes
    });
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData: EncounterFormData = {
        ...formData,
        ...(isCustomTemplate && {
          customData: customFieldValues,
          templateId: selectedTemplate?.id,
        }),
      };
      await onSubmit(submitData);
    } catch (err: any) {
      setError(err.message || 'Error al guardar consulta');
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Custom Template Fields */}
        {isCustomTemplate && selectedTemplate?.customFields ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {selectedTemplate.name}
              </h2>
              {selectedTemplate.description && (
                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
              )}
            </div>
            <DynamicFieldRenderer
              fields={selectedTemplate.customFields}
              values={customFieldValues}
              onChange={handleCustomFieldChange}
            />
          </div>
        ) : (
          <>
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Consulta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="encounterDate"
                    value={formData.encounterDate}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Consulta <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="encounterType"
                    value={formData.encounterType}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consultation">Consulta</option>
                    <option value="follow-up">Seguimiento</option>
                    <option value="emergency">Emergencia</option>
                    <option value="telemedicine">Telemedicina</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo de Consulta <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="chiefComplaint"
                    value={formData.chiefComplaint}
                    onChange={handleChange}
                    required
                    rows={3}
                    placeholder="¿Por qué acude el paciente?"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {fieldVisibility.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Consultorio, En línea, etc."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

        {/* Vitals Section - Show if any vitals field is visible */}
        {(fieldVisibility.vitalsBloodPressure ||
          fieldVisibility.vitalsHeartRate ||
          fieldVisibility.vitalsTemperature ||
          fieldVisibility.vitalsWeight ||
          fieldVisibility.vitalsHeight ||
          fieldVisibility.vitalsOxygenSat ||
          fieldVisibility.vitalsOther) && (
          <VitalsInput
            vitals={{
              vitalsBloodPressure: formData.vitalsBloodPressure,
              vitalsHeartRate: formData.vitalsHeartRate,
              vitalsTemperature: formData.vitalsTemperature,
              vitalsWeight: formData.vitalsWeight,
              vitalsHeight: formData.vitalsHeight,
              vitalsOxygenSat: formData.vitalsOxygenSat,
              vitalsOther: formData.vitalsOther,
            }}
            onChange={handleVitalsChange}
            fieldVisibility={{
              bloodPressure: fieldVisibility.vitalsBloodPressure,
              heartRate: fieldVisibility.vitalsHeartRate,
              temperature: fieldVisibility.vitalsTemperature,
              weight: fieldVisibility.vitalsWeight,
              height: fieldVisibility.vitalsHeight,
              oxygenSat: fieldVisibility.vitalsOxygenSat,
              other: fieldVisibility.vitalsOther,
            }}
          />
        )}

        {/* Clinical Notes - Toggle between simple and SOAP */}
        {/* Show if any clinical field is visible */}
        {(fieldVisibility.clinicalNotes ||
          fieldVisibility.subjective ||
          fieldVisibility.objective ||
          fieldVisibility.assessment ||
          fieldVisibility.plan) && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Documentación Clínica</h2>
              {/* Only show toggle if both modes have visible fields */}
              {fieldVisibility.clinicalNotes &&
                (fieldVisibility.subjective || fieldVisibility.objective || fieldVisibility.assessment || fieldVisibility.plan) && (
                  <button
                    type="button"
                    onClick={() => setUseSOAP(!useSOAP)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {useSOAP ? '← Usar notas simples' : 'Usar notas SOAP →'}
                  </button>
                )}
            </div>

            {useSOAP ? (
              <SOAPNoteEditor
                soapNotes={{
                  subjective: formData.subjective,
                  objective: formData.objective,
                  assessment: formData.assessment,
                  plan: formData.plan,
                }}
                onChange={handleSOAPChange}
                fieldVisibility={{
                  subjective: fieldVisibility.subjective,
                  objective: fieldVisibility.objective,
                  assessment: fieldVisibility.assessment,
                  plan: fieldVisibility.plan,
                }}
              />
            ) : (
              fieldVisibility.clinicalNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas Clínicas
                  </label>
                  <textarea
                    name="clinicalNotes"
                    value={formData.clinicalNotes}
                    onChange={handleChange}
                    rows={8}
                    placeholder="Descripción de la consulta, hallazgos, tratamiento, etc."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {(fieldVisibility.subjective || fieldVisibility.objective || fieldVisibility.assessment || fieldVisibility.plan) && (
                    <p className="text-sm text-gray-500 mt-2">
                      Considere usar <button type="button" onClick={() => setUseSOAP(true)} className="text-blue-600 hover:underline">notas estructuradas SOAP</button> para mejor organización
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Follow-up - Show if any follow-up field is visible */}
        {(fieldVisibility.followUpDate || fieldVisibility.followUpNotes) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seguimiento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldVisibility.followUpDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Seguimiento
                  </label>
                  <input
                    type="date"
                    name="followUpDate"
                    value={formData.followUpDate}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {fieldVisibility.followUpNotes && (
                <div className={fieldVisibility.followUpDate ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas de Seguimiento
                  </label>
                  <textarea
                    name="followUpNotes"
                    value={formData.followUpNotes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Instrucciones para la próxima visita"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href={defaultCancelHref}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
