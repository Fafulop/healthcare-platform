import { useReducer, useCallback } from 'react';
import type { FieldDefinition, FieldType } from '@/types/custom-encounter';

// =============================================================================
// STATE
// =============================================================================

export interface FormBuilderMetadata {
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface FormBuilderState {
  metadata: FormBuilderMetadata;
  fields: FieldDefinition[];
  selectedFieldId: string | null;
  mode: 'edit' | 'preview';
  validationErrors: Record<string, string[]>;
}

// =============================================================================
// ACTIONS
// =============================================================================

export type FormBuilderAction =
  | { type: 'SET_METADATA'; payload: Partial<FormBuilderMetadata> }
  | { type: 'ADD_FIELD'; payload: { fieldType: FieldType; insertIndex?: number } }
  | { type: 'UPDATE_FIELD'; payload: { id: string; updates: Partial<FieldDefinition> } }
  | { type: 'REMOVE_FIELD'; payload: string }
  | { type: 'REORDER_FIELD'; payload: { fieldId: string; newIndex: number } }
  | { type: 'SELECT_FIELD'; payload: string | null }
  | { type: 'SET_MODE'; payload: 'edit' | 'preview' }
  | { type: 'SET_FIELDS'; payload: FieldDefinition[] }
  | { type: 'SET_VALIDATION_ERRORS'; payload: Record<string, string[]> }
  | { type: 'CLEAR_VALIDATION_ERRORS' };

// =============================================================================
// HELPERS
// =============================================================================

let fieldCounter = 0;

function generateFieldId(): string {
  fieldCounter++;
  return `field_${Date.now()}_${fieldCounter}`;
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

const FIELD_DEFAULTS: Record<FieldType, Partial<FieldDefinition>> = {
  text: { placeholder: '' },
  textarea: { placeholder: '' },
  number: { min: undefined, max: undefined, step: 1 },
  date: {},
  time: {},
  dropdown: { options: ['Opcion 1', 'Opcion 2'] },
  radio: { options: ['Opcion 1', 'Opcion 2'] },
  checkbox: {},
  file: {},
};

function createField(fieldType: FieldType, order: number): FieldDefinition {
  const id = generateFieldId();
  const typeLabels: Record<FieldType, string> = {
    text: 'Campo de Texto',
    textarea: 'Texto Largo',
    number: 'Campo Numerico',
    date: 'Campo de Fecha',
    time: 'Campo de Hora',
    dropdown: 'Desplegable',
    radio: 'Seleccion',
    checkbox: 'Casilla',
    file: 'Archivo',
  };
  const label = typeLabels[fieldType] || fieldType;

  return {
    id,
    name: toCamelCase(label),
    label,
    labelEs: '',
    type: fieldType,
    required: false,
    order,
    width: 'full',
    section: 'General',
    ...FIELD_DEFAULTS[fieldType],
  };
}

// =============================================================================
// REDUCER
// =============================================================================

function formBuilderReducer(
  state: FormBuilderState,
  action: FormBuilderAction
): FormBuilderState {
  switch (action.type) {
    case 'SET_METADATA':
      return {
        ...state,
        metadata: { ...state.metadata, ...action.payload },
      };

    case 'ADD_FIELD': {
      const { fieldType, insertIndex } = action.payload;
      const newField = createField(fieldType, state.fields.length);

      let fields: FieldDefinition[];
      if (insertIndex !== undefined && insertIndex >= 0) {
        fields = [...state.fields];
        fields.splice(insertIndex, 0, newField);
        // Reindex order
        fields = fields.map((f, i) => ({ ...f, order: i }));
      } else {
        fields = [...state.fields, newField];
      }

      return {
        ...state,
        fields,
        selectedFieldId: newField.id,
      };
    }

    case 'UPDATE_FIELD': {
      const { id, updates } = action.payload;
      return {
        ...state,
        fields: state.fields.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      };
    }

    case 'REMOVE_FIELD': {
      const idToRemove = action.payload;
      const filtered = state.fields
        .filter((f) => f.id !== idToRemove)
        .map((f, i) => ({ ...f, order: i }));

      return {
        ...state,
        fields: filtered,
        selectedFieldId:
          state.selectedFieldId === idToRemove ? null : state.selectedFieldId,
      };
    }

    case 'REORDER_FIELD': {
      const { fieldId, newIndex } = action.payload;
      const oldIndex = state.fields.findIndex((f) => f.id === fieldId);
      if (oldIndex === -1 || oldIndex === newIndex) return state;

      const fields = [...state.fields];
      const [moved] = fields.splice(oldIndex, 1);
      fields.splice(newIndex, 0, moved);

      return {
        ...state,
        fields: fields.map((f, i) => ({ ...f, order: i })),
      };
    }

    case 'SELECT_FIELD':
      return { ...state, selectedFieldId: action.payload };

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'SET_FIELDS':
      return {
        ...state,
        fields: action.payload.map((f, i) => ({ ...f, order: i })),
      };

    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };

    case 'CLEAR_VALIDATION_ERRORS':
      return { ...state, validationErrors: {} };

    default:
      return state;
  }
}

// =============================================================================
// HOOK
// =============================================================================

interface UseFormBuilderStateOptions {
  initialMetadata?: Partial<FormBuilderMetadata>;
  initialFields?: FieldDefinition[];
}

export function useFormBuilderState(options: UseFormBuilderStateOptions = {}) {
  const initialState: FormBuilderState = {
    metadata: {
      name: options.initialMetadata?.name ?? '',
      description: options.initialMetadata?.description ?? '',
      icon: options.initialMetadata?.icon,
      color: options.initialMetadata?.color,
    },
    fields: options.initialFields ?? [],
    selectedFieldId: null,
    mode: 'edit',
    validationErrors: {},
  };

  const [state, dispatch] = useReducer(formBuilderReducer, initialState);

  // Action creators
  const setMetadata = useCallback(
    (metadata: Partial<FormBuilderMetadata>) =>
      dispatch({ type: 'SET_METADATA', payload: metadata }),
    []
  );

  const addField = useCallback(
    (fieldType: FieldType, insertIndex?: number) =>
      dispatch({ type: 'ADD_FIELD', payload: { fieldType, insertIndex } }),
    []
  );

  const updateField = useCallback(
    (id: string, updates: Partial<FieldDefinition>) =>
      dispatch({ type: 'UPDATE_FIELD', payload: { id, updates } }),
    []
  );

  const removeField = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_FIELD', payload: id }),
    []
  );

  const reorderField = useCallback(
    (fieldId: string, newIndex: number) =>
      dispatch({ type: 'REORDER_FIELD', payload: { fieldId, newIndex } }),
    []
  );

  const selectField = useCallback(
    (id: string | null) => dispatch({ type: 'SELECT_FIELD', payload: id }),
    []
  );

  const setMode = useCallback(
    (mode: 'edit' | 'preview') =>
      dispatch({ type: 'SET_MODE', payload: mode }),
    []
  );

  const setFields = useCallback(
    (fields: FieldDefinition[]) =>
      dispatch({ type: 'SET_FIELDS', payload: fields }),
    []
  );

  const setValidationErrors = useCallback(
    (errors: Record<string, string[]>) =>
      dispatch({ type: 'SET_VALIDATION_ERRORS', payload: errors }),
    []
  );

  const clearValidationErrors = useCallback(
    () => dispatch({ type: 'CLEAR_VALIDATION_ERRORS' }),
    []
  );

  // Derived state
  const selectedField = state.fields.find(
    (f) => f.id === state.selectedFieldId
  ) ?? null;

  const hasErrors = Object.keys(state.validationErrors).length > 0;

  const sections = Array.from(
    new Set(state.fields.map((f) => f.section || 'General'))
  );

  return {
    state,
    dispatch,
    // Actions
    setMetadata,
    addField,
    updateField,
    removeField,
    reorderField,
    selectField,
    setMode,
    setFields,
    setValidationErrors,
    clearValidationErrors,
    // Derived
    selectedField,
    hasErrors,
    sections,
  };
}

export type FormBuilderActions = ReturnType<typeof useFormBuilderState>;
