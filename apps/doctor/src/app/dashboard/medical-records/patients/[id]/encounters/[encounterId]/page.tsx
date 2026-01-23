'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Edit, Calendar, MapPin, FileText, Loader2, Activity, Heart, Thermometer, Weight, Ruler, Wind, ClipboardList, Stethoscope } from 'lucide-react';
import Link from 'next/link';

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
  // SOAP Notes
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  // Vitals
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
  // Follow-up
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
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Paciente
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Consulta del {formatDate(encounter.encounterDate)}</h1>
            <p className="text-sm text-gray-600">
              {encounter.patient.firstName} {encounter.patient.lastName} • ID: {encounter.patient.internalId}
            </p>
          </div>
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}/edit`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            Editar
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Basic Info + Chief Complaint Combined */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm mb-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{formatDate(encounter.encounterDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{getEncounterTypeLabel(encounter.encounterType)}</span>
            </div>
            {encounter.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{encounter.location}</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motivo de Consulta</h3>
            <p className="text-gray-900 whitespace-pre-wrap">{encounter.chiefComplaint}</p>
          </div>
        </div>

        {/* Vitals Section - Compact */}
        {(encounter.vitalsBloodPressure || encounter.vitalsHeartRate || encounter.vitalsTemperature ||
          encounter.vitalsWeight || encounter.vitalsHeight || encounter.vitalsOxygenSat || encounter.vitalsOther) && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              Signos Vitales
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {encounter.vitalsBloodPressure && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Heart className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsBloodPressure}</p>
                  <p className="text-xs text-gray-500">P.A. mmHg</p>
                </div>
              )}
              {encounter.vitalsHeartRate && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Activity className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsHeartRate}</p>
                  <p className="text-xs text-gray-500">FC lpm</p>
                </div>
              )}
              {encounter.vitalsTemperature && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Thermometer className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsTemperature}</p>
                  <p className="text-xs text-gray-500">Temp °C</p>
                </div>
              )}
              {encounter.vitalsWeight && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Weight className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsWeight}</p>
                  <p className="text-xs text-gray-500">Peso kg</p>
                </div>
              )}
              {encounter.vitalsHeight && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Ruler className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsHeight}</p>
                  <p className="text-xs text-gray-500">Altura cm</p>
                </div>
              )}
              {encounter.vitalsOxygenSat && (
                <div className="bg-gray-50 rounded p-2.5 text-center">
                  <Wind className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-semibold text-gray-900">{encounter.vitalsOxygenSat}</p>
                  <p className="text-xs text-gray-500">SpO₂ %</p>
                </div>
              )}
            </div>
            {encounter.vitalsOther && (
              <p className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-700">
                <span className="font-medium">Otros:</span> {encounter.vitalsOther}
              </p>
            )}
          </div>
        )}

        {/* SOAP Notes Section - Compact */}
        {(encounter.subjective || encounter.objective || encounter.assessment || encounter.plan) && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-green-600" />
              Notas SOAP
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {encounter.subjective && (
                <div className="border-l-3 border-blue-500 pl-3 py-1">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase mb-1">S - Subjetivo</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.subjective}</p>
                </div>
              )}
              {encounter.objective && (
                <div className="border-l-3 border-green-500 pl-3 py-1">
                  <h4 className="text-xs font-semibold text-green-700 uppercase mb-1">O - Objetivo</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.objective}</p>
                </div>
              )}
              {encounter.assessment && (
                <div className="border-l-3 border-yellow-500 pl-3 py-1">
                  <h4 className="text-xs font-semibold text-yellow-700 uppercase mb-1">A - Evaluación</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.assessment}</p>
                </div>
              )}
              {encounter.plan && (
                <div className="border-l-3 border-purple-500 pl-3 py-1">
                  <h4 className="text-xs font-semibold text-purple-700 uppercase mb-1">P - Plan</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.plan}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clinical Notes - Compact */}
        {encounter.clinicalNotes && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-gray-600" />
              Notas Clínicas
            </h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.clinicalNotes}</p>
          </div>
        )}

        {/* Follow-up - Compact */}
        {(encounter.followUpDate || encounter.followUpNotes) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Seguimiento
              {encounter.followUpDate && (
                <span className="ml-auto text-sm font-normal text-blue-700">
                  {formatDate(encounter.followUpDate)}
                </span>
              )}
            </h3>
            {encounter.followUpNotes && (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{encounter.followUpNotes}</p>
            )}
          </div>
        )}

        {/* Metadata - Compact inline */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-1">
          <span>Creada: {formatDateTime(encounter.createdAt)}</span>
          <span>Actualizada: {formatDateTime(encounter.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
