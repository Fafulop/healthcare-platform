'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Plus, FileText, User, Clock, Image, Pill, Loader2, Trash2, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { EncounterCard } from '@/components/medical-records/EncounterCard';
import { usePatientProfile } from '../_components/usePatientProfile';

interface RecentNote {
  id: string;
  content: string;
  updatedAt: string;
}

function parseNoteTitle(content: string): string {
  const first = content.split('\n').map((l) => l.trim()).find((l) => l !== '');
  return first || 'Nota vacía';
}

export default function PatientProfilePage() {
  const {
    patientId,
    sessionStatus,
    patient,
    loading,
    error,
    isArchiving,
    calculateAge,
    formatDate,
    handleArchive,
  } = usePatientProfile();

  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);

  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/medical-records/patients/${patientId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRecentNotes(d.data.slice(0, 3));
      })
      .catch(() => {});
  }, [patientId]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando paciente...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Paciente no encontrado'}</p>
          <Link href="/dashboard/medical-records" className="text-red-600 hover:text-red-800 mt-2 inline-block">
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/medical-records"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Pacientes
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Photo */}
            {patient.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}

            {/* Basic Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/edit`}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-gray-600 flex-shrink-0"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Editar
                </Link>
              </div>
              <p className="text-gray-600 mt-1">
                ID: {patient.internalId} • {calculateAge(patient.dateOfBirth)} años • {patient.sex}
              </p>
              {patient.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {patient.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/timeline`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Línea de Tiempo</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/media`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Image className="w-4 h-4 flex-shrink-0" />
              <span>Docs y Galería</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/prescriptions`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Pill className="w-4 h-4 flex-shrink-0" />
              <span>Prescripciones</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/notas`}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <NotebookPen className="w-4 h-4 flex-shrink-0" />
              <span>Notas</span>
            </Link>
            <Link
              href={`/dashboard/medical-records/patients/${patient.id}/encounters/new`}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Nueva Consulta</span>
            </Link>
            <div className="w-px h-6 bg-gray-200 hidden sm:block" />
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              <span>{isArchiving ? 'Archivando...' : 'Archivar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información de Contacto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Teléfono</label>
                <p className="text-gray-900">{patient.phone || 'No registrado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{patient.email || 'No registrado'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">Dirección</label>
                <p className="text-gray-900">
                  {patient.address ? (
                    <>
                      {patient.address}
                      {patient.city && `, ${patient.city}`}
                      {patient.state && `, ${patient.state}`}
                      {patient.postalCode && ` ${patient.postalCode}`}
                    </>
                  ) : (
                    'No registrada'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          {patient.emergencyContactName && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contacto de Emergencia</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre</label>
                  <p className="text-gray-900">{patient.emergencyContactName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Teléfono</label>
                  <p className="text-gray-900">{patient.emergencyContactPhone || 'No registrado'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Relación</label>
                  <p className="text-gray-900">{patient.emergencyContactRelation || 'No especificada'}</p>
                </div>
              </div>
            </div>
          )}

          {/* General Notes */}
          {patient.generalNotes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas Generales</h2>
              <p className="text-gray-900 whitespace-pre-wrap">{patient.generalNotes}</p>
            </div>
          )}

          {/* Recent Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <NotebookPen className="w-5 h-5" />
                Notas Recientes
              </h2>
              <Link
                href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Ver todas
              </Link>
            </div>
            {recentNotes.length > 0 ? (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                    className="block px-3 py-2.5 rounded-md border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {parseNoteTitle(note.content)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(note.updatedAt).toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <NotebookPen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No hay notas</p>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/notas`}
                  className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                >
                  Crear primera nota
                </Link>
              </div>
            )}
          </div>

          {/* Encounters List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              Historial de Consultas
            </h2>

            {patient.encounters && patient.encounters.length > 0 ? (
              <div className="space-y-3">
                {patient.encounters.map(encounter => (
                  <EncounterCard key={encounter.id} encounter={encounter} patientId={patient.id} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No hay consultas registradas</p>
                <Link
                  href={`/dashboard/medical-records/patients/${patient.id}/encounters/new`}
                  className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                >
                  Crear primera consulta
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6 order-1 lg:order-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Rápida</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Nacimiento</span>
                <span className="font-medium">{formatDate(patient.dateOfBirth)}</span>
              </div>
              {patient.firstVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Primera Visita</span>
                  <span className="font-medium">{formatDate(patient.firstVisitDate)}</span>
                </div>
              )}
              {patient.lastVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Última Visita</span>
                  <span className="font-medium">{formatDate(patient.lastVisitDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  patient.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {patient.status === 'active' ? 'Activo' : patient.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
