'use client';

import { useState } from 'react';
import { useFormBuilder } from './FormBuilderProvider';
import { DynamicFieldRenderer } from '@/components/medical-records/DynamicFieldRenderer';

export function PreviewMode() {
  const { state } = useFormBuilder();
  const [values, setValues] = useState<Record<string, any>>({});

  const handleChange = (fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  if (state.fields.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <p className="text-gray-400 text-sm">
          Agrega campos para ver la vista previa
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Template header */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {state.metadata.name || 'Plantilla sin titulo'}
          </h2>
          {state.metadata.description && (
            <p className="text-sm text-gray-500 mt-1">
              {state.metadata.description}
            </p>
          )}
        </div>

        {/* Render fields using existing DynamicFieldRenderer */}
        <DynamicFieldRenderer
          fields={state.fields}
          values={values}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
