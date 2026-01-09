'use client';

import { Plus, X, GripVertical } from 'lucide-react';

export interface Medication {
  id?: number;
  drugName: string;
  presentation?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions: string;
  warnings?: string;
  order?: number;
}

interface MedicationListProps {
  medications: Medication[];
  onChange: (medications: Medication[]) => void;
  readOnly?: boolean;
}

export function MedicationList({ medications, onChange, readOnly = false }: MedicationListProps) {
  const addMedication = () => {
    const newMedication: Medication = {
      drugName: '',
      dosage: '',
      frequency: '',
      instructions: '',
      order: medications.length,
    };
    onChange([...medications, newMedication]);
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = medications.map((med, i) => {
      if (i === index) {
        return { ...med, [field]: value };
      }
      return med;
    });
    onChange(updated);
  };

  if (readOnly && medications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay medicamentos en esta prescripción
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {medications.map((medication, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded-lg p-4 bg-white"
        >
          <div className="flex items-start gap-3">
            {!readOnly && (
              <div className="flex-shrink-0 pt-2">
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>
            )}

            <div className="flex-1 space-y-3">
              {/* Medication Name & Presentation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medicamento *
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.drugName}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.drugName}
                      onChange={(e) => updateMedication(index, 'drugName', e.target.value)}
                      placeholder="Ej: Paracetamol"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Presentación
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.presentation || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.presentation || ''}
                      onChange={(e) => updateMedication(index, 'presentation', e.target.value)}
                      placeholder="Ej: Tableta, Jarabe, Inyección"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Dosage & Frequency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosis *
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.dosage}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      placeholder="Ej: 500mg, 10ml"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia *
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.frequency}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      placeholder="Ej: Cada 8 horas, 2 veces al día"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Duration & Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.duration || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.duration || ''}
                      onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                      placeholder="Ej: 7 días, 2 semanas"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad
                  </label>
                  {readOnly ? (
                    <p className="text-gray-900">{medication.quantity || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={medication.quantity || ''}
                      onChange={(e) => updateMedication(index, 'quantity', e.target.value)}
                      placeholder="Ej: 21 tabletas, 1 frasco"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Indicaciones *
                </label>
                {readOnly ? (
                  <p className="text-gray-900">{medication.instructions}</p>
                ) : (
                  <textarea
                    value={medication.instructions}
                    onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                    placeholder="Ej: Tomar con alimentos"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                )}
              </div>

              {/* Warnings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Advertencias
                </label>
                {readOnly ? (
                  medication.warnings ? (
                    <p className="text-red-600">{medication.warnings}</p>
                  ) : (
                    <p className="text-gray-500">-</p>
                  )
                ) : (
                  <textarea
                    value={medication.warnings || ''}
                    onChange={(e) => updateMedication(index, 'warnings', e.target.value)}
                    placeholder="Ej: No conducir, No consumir alcohol"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>

            {!readOnly && (
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => removeMedication(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar medicamento"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addMedication}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Agregar Medicamento
        </button>
      )}
    </div>
  );
}
