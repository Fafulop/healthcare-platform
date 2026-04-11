'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ClipboardList, Loader2, ArrowRight, UserSquare2 } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';

interface FormLinkRow {
  id: string;
  patientName: string;
  patientEmail: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  templateName: string | null;
  submittedAt: string | null;
  linkedPatient?: { id: string; firstName: string; lastName: string } | null;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FormulariosPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect('/login'); },
  });

  const [formLinks, setFormLinks] = useState<FormLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchFormLinks() {
      try {
        const res = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/appointments/form-links`
        );
        const data = await res.json();
        if (data.success) {
          setFormLinks(data.data);
        } else {
          setError(data.error || 'Error al cargar los formularios');
        }
      } catch {
        setError('Error al cargar los formularios');
      } finally {
        setLoading(false);
      }
    }

    fetchFormLinks();
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando formularios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Formularios Pre-Cita</h1>
            <p className="text-gray-600 mt-1 text-sm">Formularios enviados por pacientes antes de su cita</p>
          </div>
          <Link
            href="/dashboard/medical-records"
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors self-start"
          >
            ← Expedientes
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {formLinks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-1">No hay formularios recibidos todavía</p>
          <p className="text-gray-400 text-sm">
            Los formularios aparecerán aquí cuando los pacientes los completen.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Paciente</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Fecha Cita</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Plantilla</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Expediente</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Recibido</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formLinks.map((fl) => (
                  <tr key={fl.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{fl.patientName}</p>
                      <p className="text-xs text-gray-500">{fl.patientEmail}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {fl.appointmentDate ? (
                        <>
                          <p>{formatDate(fl.appointmentDate)}</p>
                          {fl.appointmentTime && (
                            <p className="text-xs text-gray-500">{fl.appointmentTime}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {fl.templateName ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {fl.linkedPatient ? (
                        <Link
                          href={`/dashboard/medical-records/patients/${fl.linkedPatient.id}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <UserSquare2 className="w-3 h-3 shrink-0" />
                          {fl.linkedPatient.firstName} {fl.linkedPatient.lastName}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {fl.submittedAt ? formatDateTime(fl.submittedAt) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/medical-records/formularios/${fl.id}`}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md font-medium transition-colors"
                      >
                        Ver y adjuntar <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {formLinks.map((fl) => (
              <div key={fl.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{fl.patientName}</p>
                    {fl.appointmentDate && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(fl.appointmentDate)}
                        {fl.appointmentTime && ` · ${fl.appointmentTime}`}
                      </p>
                    )}
                    {fl.templateName && (
                      <p className="text-xs text-blue-600 mt-0.5">{fl.templateName}</p>
                    )}
                    {fl.linkedPatient && (
                      <Link
                        href={`/dashboard/medical-records/patients/${fl.linkedPatient.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5"
                      >
                        <UserSquare2 className="w-3 h-3 shrink-0" />
                        {fl.linkedPatient.firstName} {fl.linkedPatient.lastName}
                      </Link>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/medical-records/formularios/${fl.id}`}
                    className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md font-medium flex-shrink-0 ml-2"
                  >
                    Ver →
                  </Link>
                </div>
                {fl.submittedAt && (
                  <p className="text-xs text-gray-400">{formatDateTime(fl.submittedAt)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
