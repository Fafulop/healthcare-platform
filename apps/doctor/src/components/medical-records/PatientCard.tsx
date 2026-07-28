'use client';

import { User, Phone } from 'lucide-react';
import Link from 'next/link';
import { calculateAge, formatPatientDate, formatSex } from './patient-display';

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
                <User className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-sm text-gray-500">
              ID: {patient.internalId} • {calculateAge(patient.dateOfBirth)} años • {formatSex(patient.sex)}
            </p>

            {/* Contact */}
            {patient.phone && (
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{patient.phone}</span>
              </p>
            )}

            {/* Last Visit */}
            {patient.lastVisitDate && (
              <p className="text-sm text-gray-500 mt-1">
                Última visita: {formatPatientDate(patient.lastVisitDate)}
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
