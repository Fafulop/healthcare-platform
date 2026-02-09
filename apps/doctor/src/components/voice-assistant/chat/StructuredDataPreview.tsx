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
  type VoiceAppointmentSlotsData,
  type VoiceLedgerEntryData,
  type VoiceSaleData,
  type VoicePurchaseData,
} from '@/types/voice-assistant';
import type { FieldDefinition } from '@/types/custom-encounter';
import { SaleDataPreview } from './SaleDataPreview';
import { PurchaseDataPreview } from './PurchaseDataPreview';

interface Client {
  id: number;
  businessName: string;
  contactName?: string | null;
}

interface Supplier {
  id: number;
  businessName: string;
  contactName?: string | null;
}

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: string | null;
}

interface StructuredDataPreviewProps {
  data: VoiceStructuredData;
  sessionType: VoiceSessionType;
  fieldsExtracted?: string[];
  compact?: boolean;
  showMissing?: boolean; // Show fields that haven't been captured yet
  customFields?: FieldDefinition[]; // For custom encounter templates
  // For CREATE_SALE session type
  clients?: Client[];
  products?: Product[];
  // For CREATE_PURCHASE session type
  suppliers?: Supplier[];
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

const APPOINTMENT_SLOTS_GROUPS = {
  dateConfig: {
    label: 'Configuración de Fechas',
    fields: ['startDate', 'endDate', 'daysOfWeek'],
  },
  timeSettings: {
    label: 'Configuración de Horario',
    fields: ['startTime', 'endTime', 'duration', 'breakStart', 'breakEnd'],
  },
  pricing: {
    label: 'Precios',
    fields: ['basePrice', 'discount', 'discountType'],
  },
};

const TASK_GROUPS = {
  basic: {
    label: 'Información del Pendiente',
    fields: ['title', 'description'],
  },
  schedule: {
    label: 'Fecha y Hora',
    fields: ['dueDate', 'startTime', 'endTime'],
  },
  details: {
    label: 'Detalles',
    fields: ['priority', 'category', 'patientId'],
  },
};

const LEDGER_ENTRY_GROUPS = {
  basic: {
    label: 'Información Básica',
    fields: ['entryType', 'amount', 'transactionDate', 'concept'],
  },
  transaction: {
    label: 'Detalles de Transacción',
    fields: ['transactionType', 'paymentStatus', 'amountPaid'],
  },
  categorization: {
    label: 'Categorización',
    fields: ['area', 'subarea'],
  },
  payment: {
    label: 'Detalles de Pago',
    fields: ['formaDePago', 'bankAccount', 'bankMovementId'],
  },
};

/**
 * Generate field groups from custom template fields
 */
function generateCustomFieldGroups(customFields: FieldDefinition[]): Record<string, { label: string; fields: string[] }> {
  // Group by section
  const sections: Record<string, FieldDefinition[]> = {};

  customFields.forEach(field => {
    const section = field.section || 'General';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(field);
  });

  // Convert to group format
  const groups: Record<string, { label: string; fields: string[] }> = {};

  Object.entries(sections).forEach(([sectionName, fields]) => {
    // Sort by order
    const sortedFields = fields.sort((a, b) => a.order - b.order);
    groups[sectionName] = {
      label: sectionName,
      fields: sortedFields.map(f => f.name),
    };
  });

  return groups;
}

export function StructuredDataPreview({
  data,
  sessionType,
  fieldsExtracted = [],
  compact = false,
  showMissing = false,
  customFields,
  clients = [],
  products = [],
  suppliers = [],
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

  if (sessionType === 'CREATE_APPOINTMENT_SLOTS') {
    return (
      <AppointmentSlotsPreview
        data={data as VoiceAppointmentSlotsData}
        fieldsExtracted={fieldsExtracted}
        compact={compact}
        showMissing={showMissing}
      />
    );
  }

  if (sessionType === 'CREATE_LEDGER_ENTRY') {
    return (
      <LedgerEntryPreview
        data={data as VoiceLedgerEntryData}
        fieldsExtracted={fieldsExtracted}
        compact={compact}
        showMissing={showMissing}
      />
    );
  }

  if (sessionType === 'CREATE_SALE') {
    return (
      <SaleDataPreview
        data={data as VoiceSaleData}
        fieldsExtracted={fieldsExtracted}
        compact={compact}
        showMissing={showMissing}
        clients={clients}
        products={products}
      />
    );
  }

  if (sessionType === 'CREATE_PURCHASE') {
    return (
      <PurchaseDataPreview
        data={data as VoicePurchaseData}
        fieldsExtracted={fieldsExtracted}
        compact={compact}
        showMissing={showMissing}
        suppliers={suppliers}
        products={products}
      />
    );
  }

  // Use custom field groups if provided for NEW_ENCOUNTER, otherwise use predefined groups
  const groups = sessionType === 'NEW_ENCOUNTER' && customFields
    ? generateCustomFieldGroups(customFields)
    : sessionType === 'NEW_ENCOUNTER'
    ? ENCOUNTER_GROUPS
    : sessionType === 'NEW_TASK'
    ? TASK_GROUPS
    : PATIENT_GROUPS;

  // Build custom label map if custom fields provided
  const customLabelMap: Record<string, string> = {};
  if (customFields) {
    customFields.forEach(field => {
      customLabelMap[field.name] = field.labelEs || field.label;
    });
  }

  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {Object.entries(groups).map(([key, group]) => {
        // Separate filled and missing fields
        const filledFields = group.fields.filter((field) => {
          const value = (data as any)[field];
          return value !== null && value !== undefined && value !== '';
        });

        const missingFields = showMissing
          ? group.fields.filter((field) => {
              const value = (data as any)[field];
              return value === null || value === undefined || value === '';
            })
          : [];

        // Skip group if no fields to show
        if (filledFields.length === 0 && missingFields.length === 0) return null;

        return (
          <div key={key} className="border-l-2 border-blue-200 pl-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {group.label}
              {showMissing && (
                <span className="ml-2 font-normal">
                  ({filledFields.length}/{group.fields.length})
                </span>
              )}
            </h4>
            <div className="space-y-1">
              {/* Show filled fields first */}
              {filledFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={(data as any)[field]}
                  isExtracted={fieldsExtracted.includes(field)}
                  isMissing={false}
                  compact={compact}
                  customLabelMap={customLabelMap}
                />
              ))}
              {/* Show missing fields */}
              {missingFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={null}
                  customLabelMap={customLabelMap}
                  isExtracted={false}
                  isMissing={true}
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
  isMissing,
  compact,
  customLabelMap = {},
}: {
  field: string;
  value: any;
  isExtracted: boolean;
  isMissing: boolean;
  compact: boolean;
  customLabelMap?: Record<string, string>;
}) {
  const label = customLabelMap[field] || FIELD_LABELS_ES[field] || field;
  const displayValue = isMissing ? 'Sin capturar' : formatValue(field, value);

  return (
    <div className={`flex items-start gap-2 ${isMissing ? 'opacity-60' : ''}`}>
      {isMissing ? (
        <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
      ) : isExtracted ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      )}
      <div className={compact ? 'flex gap-1 flex-wrap' : ''}>
        <span className={`text-xs ${isMissing ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}:
        </span>
        <span className={`${isMissing ? 'text-gray-400 italic' : 'text-gray-900'} ${compact ? 'text-xs' : 'text-sm'}`}>
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

  // Appointment slots specific formatting
  if (field === 'daysOfWeek' && Array.isArray(value)) {
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return value.map(day => dayNames[day] || day).join(', ');
  }

  if (field === 'duration') {
    return `${value} minutos`;
  }

  if (field === 'basePrice' || field === 'discount') {
    return `$${value}`;
  }

  if (field === 'discountType') {
    return value === 'PERCENTAGE' ? 'Porcentaje' : 'Cantidad Fija';
  }

  // Ledger entry specific formatting
  if (field === 'entryType') {
    return value === 'ingreso' ? 'Ingreso' : 'Egreso';
  }

  if (field === 'amount' || field === 'amountPaid') {
    return `$${value.toLocaleString('es-MX')} MXN`;
  }

  if (field === 'transactionType') {
    const typeMap: Record<string, string> = {
      'N/A': 'Simple',
      'COMPRA': 'Compra a Proveedor',
      'VENTA': 'Venta a Cliente',
    };
    return typeMap[value] || value;
  }

  if (field === 'paymentStatus') {
    const statusMap: Record<string, string> = {
      'PENDING': 'Pendiente',
      'PARTIAL': 'Pago Parcial',
      'PAID': 'Pagado',
    };
    return statusMap[value] || value;
  }

  if (field === 'formaDePago') {
    const methodMap: Record<string, string> = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia',
      'tarjeta': 'Tarjeta',
      'cheque': 'Cheque',
      'deposito': 'Depósito',
    };
    return methodMap[value] || value;
  }

  if (field === 'priority') {
    const priorityMap: Record<string, string> = {
      'ALTA': 'Alta',
      'MEDIA': 'Media',
      'BAJA': 'Baja',
    };
    return priorityMap[value] || value;
  }

  if (field.includes('Time')) {
    return value; // Already in HH:mm format
  }

  if (field.includes('Date') && typeof value === 'string') {
    try {
      // Parse date string (YYYY-MM-DD) without timezone conversion
      // new Date("2026-01-23") parses as UTC midnight, which shifts the day in local time
      // Instead, parse the components directly
      // Extract just the date part (YYYY-MM-DD) from ISO timestamp (2026-01-23T00:00:00.000Z)
      const datePart = value.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return value;
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

/**
 * Appointment Slots-specific preview
 */
function AppointmentSlotsPreview({
  data,
  fieldsExtracted,
  compact,
  showMissing,
}: {
  data: VoiceAppointmentSlotsData;
  fieldsExtracted: string[];
  compact: boolean;
  showMissing: boolean;
}) {
  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {Object.entries(APPOINTMENT_SLOTS_GROUPS).map(([key, group]) => {
        // Separate filled and missing fields
        const filledFields = group.fields.filter((field) => {
          const value = (data as any)[field];
          return value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
        });

        const missingFields = showMissing
          ? group.fields.filter((field) => {
              const value = (data as any)[field];
              return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
            })
          : [];

        // Skip group if no fields to show
        if (filledFields.length === 0 && missingFields.length === 0) return null;

        return (
          <div key={key} className="border-l-2 border-blue-200 pl-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {group.label}
              {showMissing && (
                <span className="ml-2 font-normal">
                  ({filledFields.length}/{group.fields.length})
                </span>
              )}
            </h4>
            <div className="space-y-1">
              {/* Show filled fields first */}
              {filledFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={(data as any)[field]}
                  isExtracted={fieldsExtracted.includes(field)}
                  isMissing={false}
                  compact={compact}

                />
              ))}
              {/* Show missing fields */}
              {missingFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={null}

                  isExtracted={false}
                  isMissing={true}
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
 * Ledger Entry-specific preview
 */
function LedgerEntryPreview({
  data,
  fieldsExtracted,
  compact,
  showMissing,
}: {
  data: VoiceLedgerEntryData;
  fieldsExtracted: string[];
  compact: boolean;
  showMissing: boolean;
}) {
  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {/* Warning if transaction date is missing */}
      {!data.transactionDate && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs text-amber-800">
            <strong>Falta fecha de transacción.</strong> Responde en el chat indicando la fecha.
          </div>
        </div>
      )}
      {Object.entries(LEDGER_ENTRY_GROUPS).map(([key, group]) => {
        // Separate filled and missing fields
        const filledFields = group.fields.filter((field) => {
          const value = (data as any)[field];
          return value !== null && value !== undefined && value !== '';
        });

        const missingFields = showMissing
          ? group.fields.filter((field) => {
              const value = (data as any)[field];
              return value === null || value === undefined || value === '';
            })
          : [];

        // Skip group if no fields to show
        if (filledFields.length === 0 && missingFields.length === 0) return null;

        return (
          <div key={key} className="border-l-2 border-blue-200 pl-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {group.label}
              {showMissing && (
                <span className="ml-2 font-normal">
                  ({filledFields.length}/{group.fields.length})
                </span>
              )}
            </h4>
            <div className="space-y-1">
              {/* Show filled fields first */}
              {filledFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={(data as any)[field]}
                  isExtracted={fieldsExtracted.includes(field)}
                  isMissing={false}
                  compact={compact}

                />
              ))}
              {/* Show missing fields */}
              {missingFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={null}

                  isExtracted={false}
                  isMissing={true}
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

export default StructuredDataPreview;
