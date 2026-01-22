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
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
