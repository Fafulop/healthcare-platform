/**
 * Custom Encounter Template System - Type Definitions
 *
 * Enables doctors to create fully customizable encounter forms
 * with dynamic fields and voice assistant integration.
 */

// =============================================================================
// FIELD TYPES
// =============================================================================

/**
 * Supported field types for custom forms
 */
export type FieldType =
  | 'text'        // Single line text input
  | 'textarea'    // Multi-line text input
  | 'number'      // Numeric input
  | 'date'        // Date picker
  | 'time'        // Time picker
  | 'dropdown'    // Select dropdown
  | 'radio'       // Radio button group
  | 'checkbox'    // Single checkbox
  | 'file';       // File upload

/**
 * Definition of a single form field
 */
export interface FieldDefinition {
  id: string;                    // Unique field ID
  name: string;                  // camelCase field name (e.g., "lesionType")
  label: string;                 // Display label (e.g., "Tipo de Lesión")
  labelEs: string;               // Spanish label for voice assistant
  type: FieldType;
  required: boolean;
  order: number;                 // Display order (0-indexed)

  // Type-specific properties
  options?: string[];            // For dropdown, radio
  min?: number;                  // For number
  max?: number;
  step?: number;                 // For number (e.g., 0.1)
  placeholder?: string;          // For text, textarea
  helpText?: string;             // Help text shown below field
  defaultValue?: any;            // Default value

  // Validation
  validation?: {
    pattern?: string;            // Regex pattern for text fields
    minLength?: number;
    maxLength?: number;
    customMessage?: string;      // Custom validation error message
  };

  // UI Layout
  section?: string;              // Group related fields in sections
  width?: 'full' | 'half' | 'third';  // Width hint for responsive layout
}

// =============================================================================
// TEMPLATE
// =============================================================================

/**
 * Custom encounter template (from database)
 */
export interface CustomEncounterTemplate {
  id: string;
  doctorId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;

  // Custom template specific
  isCustom: true;
  customFields: FieldDefinition[];

  // Settings
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;

  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date | string | null;

  // Timestamps
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Input for creating a custom template
 */
export interface CreateCustomTemplateInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  customFields: FieldDefinition[];
  isDefault?: boolean;
}

/**
 * Input for updating a custom template
 */
export interface UpdateCustomTemplateInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  customFields?: FieldDefinition[];
  isDefault?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

// =============================================================================
// ENCOUNTER DATA
// =============================================================================

/**
 * Data collected from a custom encounter form
 * Keys are dynamic based on field.name values
 */
export type CustomEncounterData = Record<string, any>;

/**
 * Complete encounter with custom data
 */
export interface CustomEncounter {
  id: string;
  patientId: string;
  doctorId: string;
  templateId: string;

  // Standard fields (always present)
  encounterDate: Date | string;
  encounterType: string;
  chiefComplaint: string;
  status: string;

  // Custom fields data
  customData: CustomEncounterData;

  // Template reference
  template?: CustomEncounterTemplate;

  // Timestamps
  createdAt: Date | string;
  updatedAt: Date | string;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Response from GET /api/custom-templates
 */
export interface CustomTemplateListResponse {
  success: boolean;
  data: CustomEncounterTemplate[];
}

/**
 * Response from GET /api/custom-templates/[id]
 */
export interface CustomTemplateSingleResponse {
  success: boolean;
  data: CustomEncounterTemplate;
}

/**
 * Response from DELETE /api/custom-templates/[id]
 */
export interface CustomTemplateDeleteResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// FORM BUILDER TYPES
// =============================================================================

/**
 * State for form builder
 */
export interface FormBuilderState {
  template: {
    name: string;
    description: string;
    icon?: string;
    color?: string;
    fields: FieldDefinition[];
  };
  editingField: FieldDefinition | null;
  previewMode: boolean;
}

/**
 * Field configuration for form builder palette
 */
export interface FieldTypeConfig {
  type: FieldType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  defaultConfig: Partial<FieldDefinition>;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validation error for a field
 */
export interface FieldValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Generate form data type from field definitions
 */
export type FormDataFromFields<T extends ReadonlyArray<FieldDefinition>> = {
  [K in T[number]['name']]: any;
};

/**
 * Section grouping for organizing fields
 */
export interface FieldSection {
  name: string;
  fields: FieldDefinition[];
}
