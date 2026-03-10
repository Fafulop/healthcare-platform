import { Activity, Heart, Thermometer, Weight, Ruler, Wind } from 'lucide-react';
import type { Encounter } from './encounter-types';

type Props = Pick<Encounter,
  'vitalsBloodPressure' | 'vitalsHeartRate' | 'vitalsTemperature' |
  'vitalsWeight' | 'vitalsHeight' | 'vitalsOxygenSat' | 'vitalsOther'
>;

export function EncounterVitalsCard(props: Props) {
  const {
    vitalsBloodPressure, vitalsHeartRate, vitalsTemperature,
    vitalsWeight, vitalsHeight, vitalsOxygenSat, vitalsOther,
  } = props;

  const hasVitals = vitalsBloodPressure || vitalsHeartRate || vitalsTemperature ||
    vitalsWeight || vitalsHeight || vitalsOxygenSat || vitalsOther;

  if (!hasVitals) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <Activity className="w-4 h-4 text-blue-600" />
        Signos Vitales
      </h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {vitalsBloodPressure && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Heart className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsBloodPressure}</p>
            <p className="text-xs text-gray-500">P.A. mmHg</p>
          </div>
        )}
        {vitalsHeartRate && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Activity className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsHeartRate}</p>
            <p className="text-xs text-gray-500">FC lpm</p>
          </div>
        )}
        {vitalsTemperature && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Thermometer className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsTemperature}</p>
            <p className="text-xs text-gray-500">Temp °C</p>
          </div>
        )}
        {vitalsWeight && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Weight className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsWeight}</p>
            <p className="text-xs text-gray-500">Peso kg</p>
          </div>
        )}
        {vitalsHeight && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Ruler className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsHeight}</p>
            <p className="text-xs text-gray-500">Altura cm</p>
          </div>
        )}
        {vitalsOxygenSat && (
          <div className="bg-gray-50 rounded p-2.5 text-center">
            <Wind className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">{vitalsOxygenSat}</p>
            <p className="text-xs text-gray-500">SpO₂ %</p>
          </div>
        )}
      </div>
      {vitalsOther && (
        <p className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-700">
          <span className="font-medium">Otros:</span> {vitalsOther}
        </p>
      )}
    </div>
  );
}
