/**
 * Encounter Template Types
 *
 * Templates allow doctors to create personalized encounter configurations
 * for different use cases (e.g., "Consulta Dermatología", "Seguimiento Diabetes")
 */

// Field groups for organization
export type FieldGroup = 'basic' | 'vitals' | 'clinical' | 'followUp';

// All available encounter fields
export type EncounterFieldKey =
  // Basic fields
  | 'encounterDate'
  | 'encounterType'
  | 'chiefComplaint'
  | 'location'
  // Vitals fields
  | 'vitalsBloodPressure'
  | 'vitalsHeartRate'
  | 'vitalsTemperature'
  | 'vitalsWeight'
  | 'vitalsHeight'
  | 'vitalsOxygenSat'
  | 'vitalsOther'
  // Clinical fields
  | 'clinicalNotes'
  | 'subjective'
  | 'objective'
  | 'assessment'
  | 'plan'
  // Follow-up fields
  | 'followUpDate'
  | 'followUpNotes';

// Fields that can be hidden (some are always required)
export type HideableFieldKey = Exclude<
  EncounterFieldKey,
  'encounterDate' | 'encounterType' | 'chiefComplaint'
>;

// Fields that can have default values
export type DefaultableFieldKey =
  | 'encounterType'
  | 'location'
  | 'clinicalNotes'
  | 'subjective'
  | 'objective'
  | 'assessment'
  | 'plan'
  | 'followUpNotes';

// Field visibility configuration
export interface FieldVisibility {
  // Basic (location is the only hideable one)
  location: boolean;
  // Vitals (all hideable)
  vitalsBloodPressure: boolean;
  vitalsHeartRate: boolean;
  vitalsTemperature: boolean;
  vitalsWeight: boolean;
  vitalsHeight: boolean;
  vitalsOxygenSat: boolean;
  vitalsOther: boolean;
  // Clinical (all hideable)
  clinicalNotes: boolean;
  subjective: boolean;
  objective: boolean;
  assessment: boolean;
  plan: boolean;
  // Follow-up (all hideable)
  followUpDate: boolean;
  followUpNotes: boolean;
}

// Default values configuration
export interface DefaultValues {
  encounterType?: 'consultation' | 'follow-up' | 'emergency' | 'telemedicine';
  location?: string;
  clinicalNotes?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  followUpNotes?: string;
}

// Available template icons (Lucide icon names)
export type TemplateIcon =
  | 'stethoscope'
  | 'heart-pulse'
  | 'activity'
  | 'thermometer'
  | 'baby'
  | 'brain'
  | 'bone'
  | 'eye'
  | 'ear'
  | 'pill'
  | 'syringe'
  | 'scissors'
  | 'clock'
  | 'calendar'
  | 'clipboard-list'
  | 'user-check';

// Available template colors (Tailwind color names)
export type TemplateColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'indigo'
  | 'pink'
  | 'yellow'
  | 'gray';

// Main template interface
export interface EncounterTemplate {
  id: string;
  doctorId: string;
  name: string;
  description?: string | null;
  icon?: TemplateIcon | null;
  color?: TemplateColor | null;
  fieldVisibility: FieldVisibility;
  defaultValues: DefaultValues;
  useSOAPMode: boolean;
  isCustom: boolean;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  usageCount: number;
  lastUsedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Template creation input
export interface CreateTemplateInput {
  name: string;
  description?: string;
  icon?: TemplateIcon;
  color?: TemplateColor;
  fieldVisibility: FieldVisibility;
  defaultValues: DefaultValues;
  useSOAPMode?: boolean;
  isDefault?: boolean;
}

// Template update input
export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  icon?: TemplateIcon | null;
  color?: TemplateColor | null;
  fieldVisibility?: FieldVisibility;
  defaultValues?: DefaultValues;
  useSOAPMode?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

// Field definition for UI
export interface FieldDefinition {
  key: EncounterFieldKey;
  label: string;
  labelEs: string;
  group: FieldGroup;
  canHide: boolean;
  canSetDefault: boolean;
  defaultType?: 'text' | 'textarea' | 'select';
  selectOptions?: { value: string; label: string }[];
}

// API response types
export interface TemplateListResponse {
  success: boolean;
  data: EncounterTemplate[];
}

export interface TemplateSingleResponse {
  success: boolean;
  data: EncounterTemplate;
}

export interface TemplateDeleteResponse {
  success: boolean;
  message: string;
}

// Template usage tracking
export interface TemplateUsageUpdate {
  templateId: string;
}
