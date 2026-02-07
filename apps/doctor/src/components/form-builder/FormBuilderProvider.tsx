'use client';

import { createContext, useContext } from 'react';
import {
  useFormBuilderState,
  type FormBuilderActions,
  type FormBuilderState,
} from './hooks/useFormBuilderState';
import { useFieldValidation } from './hooks/useFieldValidation';
import type { FieldDefinition } from '@/types/custom-encounter';

interface FormBuilderContextValue extends FormBuilderActions {
  validateNow: () => Record<string, string[]>;
}

const FormBuilderContext = createContext<FormBuilderContextValue | null>(null);

interface FormBuilderProviderProps {
  children: React.ReactNode;
  initialMetadata?: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  };
  initialFields?: FieldDefinition[];
}

export function FormBuilderProvider({
  children,
  initialMetadata,
  initialFields,
}: FormBuilderProviderProps) {
  const formBuilder = useFormBuilderState({
    initialMetadata,
    initialFields,
  });

  const { validateNow } = useFieldValidation(
    formBuilder.state.metadata,
    formBuilder.state.fields,
    formBuilder.setValidationErrors
  );

  return (
    <FormBuilderContext.Provider value={{ ...formBuilder, validateNow }}>
      {children}
    </FormBuilderContext.Provider>
  );
}

export function useFormBuilder(): FormBuilderContextValue {
  const context = useContext(FormBuilderContext);
  if (!context) {
    throw new Error('useFormBuilder must be used within a FormBuilderProvider');
  }
  return context;
}
