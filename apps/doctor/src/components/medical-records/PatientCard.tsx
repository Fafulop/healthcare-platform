'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';

export interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone?: string;
  email?: string;
  lastVisitDate?: string;
  tags: string[];
  photoUrl?: string;
}

interface PatientCardProps {
  patient: Patient;
}

export function PatientCard({ patient }: PatientCardProps) {
  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  return (
    <Link href={`/dashboard/medical-records/patients/${patient.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="flex-shrink-0">
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-sm text-gray-500">
              ID: {patient.internalId} • {calculateAge(patient.dateOfBirth)} años • {patient.sex}
            </p>

            {/* Contact */}
            {patient.phone && (
              <p className="text-sm text-gray-600 mt-1 truncate">
                📱 {patient.phone}
              </p>
            )}

            {/* Last Visit */}
            {patient.lastVisitDate && (
              <p className="text-sm text-gray-500 mt-1">
                Última visita: {formatDate(patient.lastVisitDate)}
              </p>
            )}

            {/* Tags */}
            {patient.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {patient.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {patient.tags.length > 3 && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    +{patient.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
