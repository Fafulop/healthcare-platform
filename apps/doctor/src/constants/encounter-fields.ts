/**
 * Encounter Field Definitions & Template Presets
 *
 * Defines which fields can be hidden/shown in templates,
 * which can have default values, and provides preset configurations.
 */

import type {
  FieldDefinition,
  FieldVisibility,
  DefaultValues,
  TemplateIcon,
  TemplateColor,
  EncounterTemplate,
} from '@/types/encounter-template';

// =============================================================================
// FIELD DEFINITIONS
// =============================================================================

export const ENCOUNTER_FIELDS: FieldDefinition[] = [
  // Basic Information Group
  {
    key: 'encounterDate',
    label: 'Encounter Date',
    labelEs: 'Fecha de Consulta',
    group: 'basic',
    canHide: false,
    canSetDefault: false,
  },
  {
    key: 'encounterType',
    label: 'Encounter Type',
    labelEs: 'Tipo de Consulta',
    group: 'basic',
    canHide: false,
    canSetDefault: true,
    defaultType: 'select',
    selectOptions: [
      { value: 'consultation', label: 'Consulta' },
      { value: 'follow-up', label: 'Seguimiento' },
      { value: 'emergency', label: 'Emergencia' },
      { value: 'telemedicine', label: 'Telemedicina' },
    ],
  },
  {
    key: 'chiefComplaint',
    label: 'Chief Complaint',
    labelEs: 'Motivo de Consulta',
    group: 'basic',
    canHide: false,
    canSetDefault: false,
  },
  {
    key: 'location',
    label: 'Location',
    labelEs: 'Ubicación',
    group: 'basic',
    canHide: true,
    canSetDefault: true,
    defaultType: 'text',
  },

  // Vitals Group
  {
    key: 'vitalsBloodPressure',
    label: 'Blood Pressure',
    labelEs: 'Presión Arterial',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsHeartRate',
    label: 'Heart Rate',
    labelEs: 'Frecuencia Cardíaca',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsTemperature',
    label: 'Temperature',
    labelEs: 'Temperatura',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsWeight',
    label: 'Weight',
    labelEs: 'Peso',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsHeight',
    label: 'Height',
    labelEs: 'Altura',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsOxygenSat',
    label: 'Oxygen Saturation',
    labelEs: 'Saturación de Oxígeno',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'vitalsOther',
    label: 'Other Vitals',
    labelEs: 'Otros Signos Vitales',
    group: 'vitals',
    canHide: true,
    canSetDefault: false,
  },

  // Clinical Group
  {
    key: 'clinicalNotes',
    label: 'Clinical Notes',
    labelEs: 'Notas Clínicas',
    group: 'clinical',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },
  {
    key: 'subjective',
    label: 'Subjective (S)',
    labelEs: 'Subjetivo (S)',
    group: 'clinical',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },
  {
    key: 'objective',
    label: 'Objective (O)',
    labelEs: 'Objetivo (O)',
    group: 'clinical',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },
  {
    key: 'assessment',
    label: 'Assessment (A)',
    labelEs: 'Evaluación (A)',
    group: 'clinical',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },
  {
    key: 'plan',
    label: 'Plan (P)',
    labelEs: 'Plan (P)',
    group: 'clinical',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },

  // Follow-up Group
  {
    key: 'followUpDate',
    label: 'Follow-up Date',
    labelEs: 'Fecha de Seguimiento',
    group: 'followUp',
    canHide: true,
    canSetDefault: false,
  },
  {
    key: 'followUpNotes',
    label: 'Follow-up Notes',
    labelEs: 'Notas de Seguimiento',
    group: 'followUp',
    canHide: true,
    canSetDefault: true,
    defaultType: 'textarea',
  },
];

// Group fields by their group for UI organization
export const FIELDS_BY_GROUP = {
  basic: ENCOUNTER_FIELDS.filter((f) => f.group === 'basic'),
  vitals: ENCOUNTER_FIELDS.filter((f) => f.group === 'vitals'),
  clinical: ENCOUNTER_FIELDS.filter((f) => f.group === 'clinical'),
  followUp: ENCOUNTER_FIELDS.filter((f) => f.group === 'followUp'),
};

// Group labels for UI
export const GROUP_LABELS = {
  basic: { en: 'Basic Information', es: 'Información Básica' },
  vitals: { en: 'Vitals', es: 'Signos Vitales' },
  clinical: { en: 'Clinical Documentation', es: 'Documentación Clínica' },
  followUp: { en: 'Follow-up', es: 'Seguimiento' },
};

// =============================================================================
// ICON & COLOR OPTIONS
// =============================================================================

export const TEMPLATE_ICONS: { value: TemplateIcon; label: string }[] = [
  { value: 'stethoscope', label: 'Estetoscopio' },
  { value: 'heart-pulse', label: 'Pulso Cardíaco' },
  { value: 'activity', label: 'Actividad' },
  { value: 'thermometer', label: 'Termómetro' },
  { value: 'baby', label: 'Bebé' },
  { value: 'brain', label: 'Cerebro' },
  { value: 'bone', label: 'Hueso' },
  { value: 'eye', label: 'Ojo' },
  { value: 'ear', label: 'Oído' },
  { value: 'pill', label: 'Píldora' },
  { value: 'syringe', label: 'Jeringa' },
  { value: 'scissors', label: 'Tijeras' },
  { value: 'clock', label: 'Reloj' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'clipboard-list', label: 'Lista' },
  { value: 'user-check', label: 'Usuario' },
];

export const TEMPLATE_COLORS: { value: TemplateColor; label: string; bgClass: string; textClass: string }[] = [
  { value: 'blue', label: 'Azul', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  { value: 'green', label: 'Verde', bgClass: 'bg-green-100', textClass: 'text-green-600' },
  { value: 'purple', label: 'Morado', bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
  { value: 'orange', label: 'Naranja', bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  { value: 'red', label: 'Rojo', bgClass: 'bg-red-100', textClass: 'text-red-600' },
  { value: 'teal', label: 'Verde Azulado', bgClass: 'bg-teal-100', textClass: 'text-teal-600' },
  { value: 'indigo', label: 'Índigo', bgClass: 'bg-indigo-100', textClass: 'text-indigo-600' },
  { value: 'pink', label: 'Rosa', bgClass: 'bg-pink-100', textClass: 'text-pink-600' },
  { value: 'yellow', label: 'Amarillo', bgClass: 'bg-yellow-100', textClass: 'text-yellow-600' },
  { value: 'gray', label: 'Gris', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
];

// Helper to get color classes
export function getColorClasses(color: TemplateColor | null | undefined) {
  const found = TEMPLATE_COLORS.find((c) => c.value === color);
  return found || { bgClass: 'bg-gray-100', textClass: 'text-gray-600' };
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

// All fields visible by default
export const DEFAULT_FIELD_VISIBILITY: FieldVisibility = {
  location: true,
  vitalsBloodPressure: true,
  vitalsHeartRate: true,
  vitalsTemperature: true,
  vitalsWeight: true,
  vitalsHeight: true,
  vitalsOxygenSat: true,
  vitalsOther: true,
  clinicalNotes: true,
  subjective: true,
  objective: true,
  assessment: true,
  plan: true,
  followUpDate: true,
  followUpNotes: true,
};

// Empty default values
export const DEFAULT_VALUES: DefaultValues = {};

// Default "Consulta General" template (seeded for new doctors)
export const DEFAULT_TEMPLATE: Omit<EncounterTemplate, 'id' | 'doctorId' | 'createdAt' | 'updatedAt'> = {
  name: 'Consulta General',
  description: 'Plantilla completa para consultas médicas generales',
  icon: 'stethoscope',
  color: 'blue',
  fieldVisibility: DEFAULT_FIELD_VISIBILITY,
  defaultValues: {
    encounterType: 'consultation',
  },
  useSOAPMode: true,
  isDefault: true,
  isActive: true,
  displayOrder: 0,
  usageCount: 0,
  lastUsedAt: null,
};

// =============================================================================
// PRESET TEMPLATES
// =============================================================================

export const TEMPLATE_PRESETS = {
  // Quick follow-up - minimal fields
  quickFollowUp: {
    name: 'Seguimiento Rápido',
    description: 'Plantilla simplificada para seguimientos breves',
    icon: 'clock' as TemplateIcon,
    color: 'green' as TemplateColor,
    fieldVisibility: {
      ...DEFAULT_FIELD_VISIBILITY,
      vitalsOther: false,
      clinicalNotes: false, // Use SOAP instead
    },
    defaultValues: {
      encounterType: 'follow-up' as const,
    },
    useSOAPMode: true,
  },

  // Telemedicine consultation
  telemedicine: {
    name: 'Telemedicina',
    description: 'Plantilla para consultas en línea',
    icon: 'activity' as TemplateIcon,
    color: 'purple' as TemplateColor,
    fieldVisibility: {
      ...DEFAULT_FIELD_VISIBILITY,
      // Hide vitals that can't be measured remotely
      vitalsBloodPressure: false,
      vitalsHeartRate: false,
      vitalsTemperature: false,
      vitalsOxygenSat: false,
      vitalsOther: false,
    },
    defaultValues: {
      encounterType: 'telemedicine' as const,
      location: 'Consulta en línea',
    },
    useSOAPMode: true,
  },

  // Emergency/Urgency
  emergency: {
    name: 'Urgencia',
    description: 'Plantilla para atención de urgencias',
    icon: 'heart-pulse' as TemplateIcon,
    color: 'red' as TemplateColor,
    fieldVisibility: {
      ...DEFAULT_FIELD_VISIBILITY,
      followUpNotes: false, // Focus on immediate care
    },
    defaultValues: {
      encounterType: 'emergency' as const,
    },
    useSOAPMode: false, // Quick notes mode
  },

  // Pediatric consultation
  pediatric: {
    name: 'Consulta Pediátrica',
    description: 'Plantilla para consultas pediátricas con énfasis en crecimiento',
    icon: 'baby' as TemplateIcon,
    color: 'pink' as TemplateColor,
    fieldVisibility: DEFAULT_FIELD_VISIBILITY,
    defaultValues: {
      encounterType: 'consultation' as const,
    },
    useSOAPMode: true,
  },
};

// =============================================================================
// TEMPLATE LIMITS
// =============================================================================

export const MAX_TEMPLATES_PER_DOCTOR = 3; // 1 default + 2 custom

// =============================================================================
// VALIDATION
// =============================================================================

export function validateTemplateName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'El nombre es requerido';
  }
  if (name.length > 100) {
    return 'El nombre no puede exceder 100 caracteres';
  }
  return null;
}

export function validateFieldVisibility(visibility: FieldVisibility): string | null {
  // At least one clinical field should be visible
  const hasClinical =
    visibility.clinicalNotes ||
    visibility.subjective ||
    visibility.objective ||
    visibility.assessment ||
    visibility.plan;

  if (!hasClinical) {
    return 'Al menos un campo de documentación clínica debe estar visible';
  }
  return null;
}
