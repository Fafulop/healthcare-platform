'use client';

/**
 * StructuredDataPreview
 *
 * Displays extracted data in a formatted, readable card.
 * Groups data by sections (Vitals, SOAP, etc.) with Spanish labels.
 */

import { CheckCircle2, Circle } from 'lucide-react';
import {
  FIELD_LABELS_ES,
  type VoiceStructuredData,
  type VoiceSessionType,
  type VoiceEncounterData,
  type VoicePrescriptionData,
  type VoiceMedicationData,
} from '@/types/voice-assistant';

interface StructuredDataPreviewProps {
  data: VoiceStructuredData;
  sessionType: VoiceSessionType;
  fieldsExtracted?: string[];
  compact?: boolean;
}

// Field groupings for display
const ENCOUNTER_GROUPS = {
  vitals: {
    label: 'Signos Vitales',
    fields: [
      'vitalsBloodPressure',
      'vitalsHeartRate',
      'vitalsTemperature',
      'vitalsWeight',
      'vitalsHeight',
      'vitalsOxygenSat',
      'vitalsOther',
    ],
  },
  soap: {
    label: 'Notas SOAP',
    fields: ['subjective', 'objective', 'assessment', 'plan'],
  },
  general: {
    label: 'Información General',
    fields: ['encounterType', 'chiefComplaint', 'clinicalNotes'],
  },
  followUp: {
    label: 'Seguimiento',
    fields: ['followUpDate', 'followUpNotes'],
  },
};

const PATIENT_GROUPS = {
  identification: {
    label: 'Identificación',
    fields: ['firstName', 'lastName', 'dateOfBirth', 'sex', 'bloodType'],
  },
  contact: {
    label: 'Contacto',
    fields: ['phone', 'email', 'address', 'city', 'state', 'postalCode'],
  },
  emergency: {
    label: 'Contacto de Emergencia',
    fields: ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'],
  },
  medical: {
    label: 'Información Médica',
    fields: ['currentAllergies', 'currentChronicConditions', 'currentMedications', 'generalNotes'],
  },
};

export function StructuredDataPreview({
  data,
  sessionType,
  fieldsExtracted = [],
  compact = false,
}: StructuredDataPreviewProps) {
  if (sessionType === 'NEW_PRESCRIPTION') {
    return (
      <PrescriptionPreview
        data={data as VoicePrescriptionData}
        fieldsExtracted={fieldsExtracted}
        compact={compact}
      />
    );
  }

  const groups = sessionType === 'NEW_ENCOUNTER' ? ENCOUNTER_GROUPS : PATIENT_GROUPS;

  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {Object.entries(groups).map(([key, group]) => {
        const groupFields = group.fields.filter((field) => {
          const value = (data as any)[field];
          return value !== null && value !== undefined && value !== '';
        });

        if (groupFields.length === 0) return null;

        return (
          <div key={key} className="border-l-2 border-blue-200 pl-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {group.label}
            </h4>
            <div className="space-y-1">
              {groupFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={(data as any)[field]}
                  isExtracted={fieldsExtracted.includes(field)}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Single field row display
 */
function FieldRow({
  field,
  value,
  isExtracted,
  compact,
}: {
  field: string;
  value: any;
  isExtracted: boolean;
  compact: boolean;
}) {
  const label = FIELD_LABELS_ES[field] || field;
  const displayValue = formatValue(field, value);

  return (
    <div className="flex items-start gap-2">
      {isExtracted ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
      )}
      <div className={compact ? 'flex gap-1' : ''}>
        <span className="text-gray-500 text-xs">{label}:</span>
        <span className={`text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}

/**
 * Format value for display
 */
function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return '—';

  // Format specific field types
  if (field === 'sex') {
    const sexMap: Record<string, string> = {
      male: 'Masculino',
      female: 'Femenino',
      other: 'Otro',
    };
    return sexMap[value] || value;
  }

  if (field === 'encounterType') {
    const typeMap: Record<string, string> = {
      consultation: 'Consulta',
      'follow-up': 'Seguimiento',
      emergency: 'Urgencia',
      telemedicine: 'Telemedicina',
    };
    return typeMap[value] || value;
  }

  if (field.includes('Date') && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return value;
    }
  }

  if (field === 'vitalsHeartRate') return `${value} lpm`;
  if (field === 'vitalsTemperature') return `${value}°C`;
  if (field === 'vitalsWeight') return `${value} kg`;
  if (field === 'vitalsHeight') return `${value} cm`;
  if (field === 'vitalsOxygenSat') return `${value}%`;
  if (field === 'vitalsBloodPressure') return `${value} mmHg`;

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
}

/**
 * Prescription-specific preview
 */
function PrescriptionPreview({
  data,
  fieldsExtracted,
  compact,
}: {
  data: VoicePrescriptionData;
  fieldsExtracted: string[];
  compact: boolean;
}) {
  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {/* Diagnosis */}
      {data.diagnosis && (
        <div className="border-l-2 border-blue-200 pl-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Diagnóstico
          </h4>
          <p className="text-gray-900">{data.diagnosis}</p>
        </div>
      )}

      {/* Medications */}
      {data.medications && data.medications.length > 0 && (
        <div className="border-l-2 border-green-200 pl-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Medicamentos ({data.medications.length})
          </h4>
          <div className="space-y-2">
            {data.medications.map((med, index) => (
              <MedicationCard key={index} medication={med} index={index} compact={compact} />
            ))}
          </div>
        </div>
      )}

      {/* Clinical Notes */}
      {data.clinicalNotes && (
        <div className="border-l-2 border-gray-200 pl-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Notas
          </h4>
          <p className="text-gray-700 text-sm">{data.clinicalNotes}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Single medication card
 */
function MedicationCard({
  medication,
  index,
  compact,
}: {
  medication: VoiceMedicationData;
  index: number;
  compact: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded">
          {index + 1}
        </span>
        <span className="font-medium text-gray-900">{medication.drugName}</span>
        {medication.presentation && (
          <span className="text-gray-500 text-xs">({medication.presentation})</span>
        )}
      </div>
      <div className={`mt-1 text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="font-medium">{medication.dosage}</span>
        {medication.frequency && <span> • {medication.frequency}</span>}
        {medication.duration && <span> • {medication.duration}</span>}
      </div>
      {medication.instructions && (
        <p className="mt-1 text-gray-500 text-xs italic">{medication.instructions}</p>
      )}
      {medication.warnings && (
        <p className="mt-1 text-amber-600 text-xs">⚠️ {medication.warnings}</p>
      )}
    </div>
  );
}

export default StructuredDataPreview;
