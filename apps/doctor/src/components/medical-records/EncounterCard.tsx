'use client';

import Link from 'next/link';

export interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  status: string;
  createdAt: string;
}

interface EncounterCardProps {
  encounter: Encounter;
  patientId: string;
}

export function EncounterCard({ encounter, patientId }: EncounterCardProps) {
  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
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

  return (
    <Link
      href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounter.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div>
        <p className="font-medium text-gray-900">{encounter.chiefComplaint}</p>
        <p className="text-sm text-gray-600 mt-1">
          {encounter.encounterType} • {formatDate(encounter.encounterDate)}
        </p>
      </div>
    </Link>
  );
}
