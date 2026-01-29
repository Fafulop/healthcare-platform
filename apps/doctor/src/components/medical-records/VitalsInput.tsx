'use client';

export interface VitalsData {
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
}

export interface VitalsFieldVisibility {
  bloodPressure?: boolean;
  heartRate?: boolean;
  temperature?: boolean;
  weight?: boolean;
  height?: boolean;
  oxygenSat?: boolean;
  other?: boolean;
}

interface VitalsInputProps {
  vitals: VitalsData;
  onChange: (vitals: VitalsData) => void;
  fieldVisibility?: VitalsFieldVisibility;
}

export function VitalsInput({ vitals, onChange, fieldVisibility }: VitalsInputProps) {
  // Default all fields to visible if no visibility config provided
  const visibility = {
    bloodPressure: fieldVisibility?.bloodPressure ?? true,
    heartRate: fieldVisibility?.heartRate ?? true,
    temperature: fieldVisibility?.temperature ?? true,
    weight: fieldVisibility?.weight ?? true,
    height: fieldVisibility?.height ?? true,
    oxygenSat: fieldVisibility?.oxygenSat ?? true,
    other: fieldVisibility?.other ?? true,
  };
  const handleChange = (field: keyof VitalsData, value: string | number) => {
    onChange({
      ...vitals,
      [field]: value === '' ? undefined : value
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Signos Vitales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Blood Pressure */}
        {visibility.bloodPressure && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presión Arterial
            </label>
            <input
              type="text"
              value={vitals.vitalsBloodPressure || ''}
              onChange={(e) => handleChange('vitalsBloodPressure', e.target.value)}
              placeholder="120/80"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">mmHg</p>
          </div>
        )}

        {/* Heart Rate */}
        {visibility.heartRate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frecuencia Cardíaca
            </label>
            <input
              type="number"
              value={vitals.vitalsHeartRate || ''}
              onChange={(e) => handleChange('vitalsHeartRate', e.target.value ? parseInt(e.target.value) : '')}
              placeholder="72"
              min="0"
              max="300"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">lpm (latidos por minuto)</p>
          </div>
        )}

        {/* Temperature */}
        {visibility.temperature && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperatura
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals.vitalsTemperature || ''}
              onChange={(e) => handleChange('vitalsTemperature', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="36.5"
              min="30"
              max="45"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">°C</p>
          </div>
        )}

        {/* Weight */}
        {visibility.weight && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Peso
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals.vitalsWeight || ''}
              onChange={(e) => handleChange('vitalsWeight', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="70.5"
              min="0"
              max="500"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">kg</p>
          </div>
        )}

        {/* Height */}
        {visibility.height && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Altura
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals.vitalsHeight || ''}
              onChange={(e) => handleChange('vitalsHeight', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="170"
              min="0"
              max="300"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">cm</p>
          </div>
        )}

        {/* Oxygen Saturation */}
        {visibility.oxygenSat && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Saturación de Oxígeno
            </label>
            <input
              type="number"
              value={vitals.vitalsOxygenSat || ''}
              onChange={(e) => handleChange('vitalsOxygenSat', e.target.value ? parseInt(e.target.value) : '')}
              placeholder="98"
              min="0"
              max="100"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">% (SpO2)</p>
          </div>
        )}

        {/* Other Vitals */}
        {visibility.other && (
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Otros Signos Vitales
            </label>
            <textarea
              value={vitals.vitalsOther || ''}
              onChange={(e) => handleChange('vitalsOther', e.target.value)}
              rows={2}
              placeholder="Otros signos vitales o notas adicionales..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* BMI Calculation - Show only if both weight and height are visible and have values */}
      {visibility.weight && visibility.height && vitals.vitalsWeight && vitals.vitalsHeight && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Índice de Masa Corporal (IMC):</span>
            <span className="text-lg font-semibold text-blue-700">
              {calculateBMI(vitals.vitalsWeight, vitals.vitalsHeight).toFixed(1)} kg/m²
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {getBMICategory(calculateBMI(vitals.vitalsWeight, vitals.vitalsHeight))}
          </p>
        </div>
      )}
    </div>
  );
}

function calculateBMI(weight: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
}

function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Peso normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}
