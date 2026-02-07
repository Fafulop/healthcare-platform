import { useEffect, useRef, useCallback } from 'react';
import type { FieldDefinition } from '@/types/custom-encounter';
import type { FormBuilderMetadata } from './useFormBuilderState';

const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;

export interface ValidationErrors {
  [fieldIdOrKey: string]: string[];
}

function validateField(
  field: FieldDefinition,
  allFields: FieldDefinition[]
): string[] {
  const errors: string[] = [];

  if (!field.name.trim()) {
    errors.push('El nombre del campo es requerido');
  } else if (!CAMEL_CASE_REGEX.test(field.name)) {
    errors.push('El nombre debe ser camelCase (ej: motivoConsulta)');
  }

  // Check uniqueness
  const duplicates = allFields.filter(
    (f) => f.id !== field.id && f.name === field.name
  );
  if (duplicates.length > 0) {
    errors.push('El nombre del campo debe ser unico');
  }

  if (!field.label.trim()) {
    errors.push('La etiqueta es requerida');
  }

  if (!field.labelEs.trim()) {
    errors.push('La etiqueta en espanol es requerida');
  }

  if (
    (field.type === 'dropdown' || field.type === 'radio') &&
    (!field.options || field.options.length === 0)
  ) {
    errors.push('Se requiere al menos una opcion para campos desplegables');
  }

  if (
    field.type === 'number' &&
    field.min !== undefined &&
    field.max !== undefined &&
    field.min >= field.max
  ) {
    errors.push('El valor minimo debe ser menor que el maximo');
  }

  return errors;
}

function validateTemplate(
  metadata: FormBuilderMetadata,
  fields: FieldDefinition[]
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!metadata.name.trim()) {
    errors['_template'] = ['El nombre de la plantilla es requerido'];
  }

  if (fields.length === 0) {
    errors['_fields'] = ['Se requiere al menos un campo'];
  }

  fields.forEach((field) => {
    const fieldErrors = validateField(field, fields);
    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors;
    }
  });

  return errors;
}

export function useFieldValidation(
  metadata: FormBuilderMetadata,
  fields: FieldDefinition[],
  onValidationChange: (errors: ValidationErrors) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const errors = validateTemplate(metadata, fields);
      onValidationChangeRef.current(errors);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [metadata, fields]);

  const validateNow = useCallback((): ValidationErrors => {
    return validateTemplate(metadata, fields);
  }, [metadata, fields]);

  return { validateNow };
}
