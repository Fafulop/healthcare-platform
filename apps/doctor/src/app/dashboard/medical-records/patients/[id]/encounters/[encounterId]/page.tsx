'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Edit, Calendar, MapPin, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  location?: string;
  status: string;
  clinicalNotes?: string;
  followUpDate?: string;
  followUpNotes?: string;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    internalId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    sex: string;
  };
}

export default function EncounterDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  useEffect(() => {
    fetchEncounter();
  }, [patientId, encounterId]);

  const fetchEncounter = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/encounters/${encounterId}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar consulta');
      }

      const data = await res.json();

      if (!data?.data) {
        throw new Error('Invalid response format');
      }

      setEncounter(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading encounter');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEncounterTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'consultation': 'Consulta',
      'follow-up': 'Seguimiento',
      'emergency': 'Emergencia',
      'telemedicine': 'Telemedicina'
    };
    return types[type] || type;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Consulta no encontrada'}</p>
          <Link
            href={`/dashboard/medical-records/patients/${patientId}`}
            className="text-red-600 hover:text-red-800 mt-2 inline-block"
          >
            Volver al paciente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consulta del {formatDate(encounter.encounterDate)}</h1>
            <p className="text-gray-600 mt-1">
              {encounter.patient.firstName} {encounter.patient.lastName} • ID: {encounter.patient.internalId}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}/edit`}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Información Básica</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <label className="text-sm font-medium text-gray-500">Fecha</label>
                <p className="text-gray-900">{formatDate(encounter.encounterDate)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo</label>
                <p className="text-gray-900">{getEncounterTypeLabel(encounter.encounterType)}</p>
              </div>
            </div>

            {encounter.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Ubicación</label>
                  <p className="text-gray-900">{encounter.location}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-1">
                <div className={`w-3 h-3 rounded-full ${
                  encounter.status === 'completed' ? 'bg-green-500' :
                  encounter.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Estado</label>
                <p className="text-gray-900">
                  {encounter.status === 'completed' ? 'Completada' :
                   encounter.status === 'draft' ? 'Borrador' : encounter.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Motivo de Consulta</h2>
          <p className="text-gray-900 whitespace-pre-wrap">{encounter.chiefComplaint}</p>
        </div>

        {/* Clinical Notes */}
        {encounter.clinicalNotes && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas Clínicas</h2>
            <div className="prose max-w-none">
              <p className="text-gray-900 whitespace-pre-wrap">{encounter.clinicalNotes}</p>
            </div>
          </div>
        )}

        {/* Follow-up */}
        {(encounter.followUpDate || encounter.followUpNotes) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Seguimiento
            </h2>
            <div className="space-y-3">
              {encounter.followUpDate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Fecha de Seguimiento</label>
                  <p className="text-gray-900">{formatDate(encounter.followUpDate)}</p>
                </div>
              )}
              {encounter.followUpNotes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Instrucciones</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{encounter.followUpNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Creada: </span>
              <span className="text-gray-900">{formatDateTime(encounter.createdAt)}</span>
            </div>
            <div>
              <span className="text-gray-600">Última actualización: </span>
              <span className="text-gray-900">{formatDateTime(encounter.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>
    </div>
  );
}
