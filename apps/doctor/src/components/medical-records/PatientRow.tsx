'use client';

import { User, Phone } from 'lucide-react';
import Link from 'next/link';
import { calculateAge, formatPatientDate, formatSex } from './patient-display';
import type { Patient } from './PatientCard';

interface PatientRowProps {
  patient: Patient;
}

/**
 * Columns appear at `md:` rather than `sm:`: the Spanish sex labels
 * ("Masculino") need a wide enough cell that at 640px the name column would be
 * squeezed to nothing. Below `md:` the row stacks instead — keep the `md:`
 * breakpoint in sync between the header, the columns and the stacked block, or
 * fields will either duplicate or vanish.
 */
export function PatientRowHeader() {
  return (
    <div className="hidden md:flex items-center gap-4 px-4 py-2 border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
      <span className="w-10 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">Paciente</span>
      <span className="w-40 flex-shrink-0">Edad / Sexo</span>
      <span className="w-40 flex-shrink-0">Teléfono</span>
      <span className="w-36 flex-shrink-0">Última visita</span>
    </div>
  );
}

export function PatientRow({ patient }: PatientRowProps) {
  const age = calculateAge(patient.dateOfBirth);

  return (
    <Link
      href={`/dashboard/medical-records/patients/${patient.id}`}
      className="block border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Photo */}
        <div className="flex-shrink-0">
          {patient.photoUrl ? (
            <img
              src={patient.photoUrl}
              alt={`${patient.firstName} ${patient.lastName}`}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          )}
        </div>

        {/* Name + ID (+ everything else, below md) */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">ID: {patient.internalId}</p>

          {/* The columns below fold back in here on narrow screens */}
          <p className="md:hidden text-xs text-gray-600 mt-1">
            {age} años • {formatSex(patient.sex)}
            {patient.phone && ` • ${patient.phone}`}
          </p>
          {patient.lastVisitDate && (
            <p className="md:hidden text-xs text-gray-500">
              Última visita: {formatPatientDate(patient.lastVisitDate)}
            </p>
          )}

          {patient.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {patient.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  {tag}
                </span>
              ))}
              {patient.tags.length > 3 && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  +{patient.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Columns — md and up */}
        <span className="hidden md:block w-40 flex-shrink-0 truncate text-sm text-gray-600">
          {age} años • {formatSex(patient.sex)}
        </span>
        <span className="hidden md:flex w-40 flex-shrink-0 items-center gap-1.5 text-sm text-gray-600">
          {patient.phone ? (
            <>
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate min-w-0">{patient.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
        <span className="hidden md:block w-36 flex-shrink-0 truncate text-sm text-gray-500">
          {patient.lastVisitDate ? formatPatientDate(patient.lastVisitDate) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
      </div>
    </Link>
  );
}
