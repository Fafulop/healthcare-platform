'use client';

import Link from 'next/link';

export interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  assessment?: string | null;
  status: string;
  createdAt: string;
}

interface EncounterCardProps {
  encounter: Encounter;
  patientId: string;
}

const ENCOUNTER_TYPE_LABELS: Record<string, string> = {
  'consultation': 'Consulta',
  'follow-up': 'Seguimiento',
  'emergency': 'Emergencia',
  'telemedicine': 'Telemedicina',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  draft: 'Borrador',
  amended: 'Enmendada',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  amended: 'bg-blue-100 text-blue-800',
};

export function EncounterCard({ encounter, patientId }: EncounterCardProps) {
  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const description = encounter.chiefComplaint || encounter.assessment || null;
  const typeLabel = ENCOUNTER_TYPE_LABELS[encounter.encounterType] ?? encounter.encounterType;
  const statusLabel = STATUS_LABELS[encounter.status] ?? encounter.status;
  const statusColor = STATUS_COLORS[encounter.status] ?? 'bg-gray-100 text-gray-800';

  return (
    <Link
      href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounter.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {description && (
            <p className="font-medium text-gray-900">{description}</p>
          )}
          <p className={`text-sm text-gray-600 ${description ? 'mt-1' : ''}`}>
            {typeLabel} • {formatDate(encounter.encounterDate)}
          </p>
        </div>
        <span className={`flex-shrink-0 px-2 py-1 text-xs rounded ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}
