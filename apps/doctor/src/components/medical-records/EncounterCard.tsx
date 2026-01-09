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

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      completed: 'Completada',
      draft: 'Borrador',
      amended: 'Enmendada'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      draft: 'bg-yellow-100 text-yellow-800',
      amended: 'bg-blue-100 text-blue-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Link
      href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounter.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{encounter.chiefComplaint}</p>
          <p className="text-sm text-gray-600 mt-1">
            {encounter.encounterType} • {formatDate(encounter.encounterDate)}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(encounter.status)}`}>
          {getStatusLabel(encounter.status)}
        </span>
      </div>
    </Link>
  );
}
