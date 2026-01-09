'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Clock } from 'lucide-react';
import Link from 'next/link';
import { TimelineView } from '@/components/medical-records/TimelineView';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface TimelineData {
  timeline: any[];
  patient: Patient;
}

export default function PatientTimelinePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTimeline();
  }, [patientId]);

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/timeline`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar línea de tiempo');
      }

      const data = await res.json();
      setTimelineData(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading timeline');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando línea de tiempo...</p>
        </div>
      </div>
    );
  }

  if (error || !timelineData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'No se pudo cargar la línea de tiempo'}</p>
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

  const { timeline, patient } = timelineData;

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Línea de Tiempo Clínica
              </h1>
              <p className="text-gray-600 mt-1">
                {patient.firstName} {patient.lastName} • {calculateAge(patient.dateOfBirth)} años
              </p>
            </div>
          </div>

          <Link
            href={`/dashboard/medical-records/patients/${patientId}/encounters/new`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Consulta
          </Link>
        </div>
      </div>

      {/* Stats summary */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{timeline.length}</div>
              <div className="text-sm text-gray-600 mt-1">Total de Consultas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {timeline.filter((item: any) => item.data.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Completadas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {timeline.filter((item: any) => item.data.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Borradores</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <TimelineView timeline={timeline} patientId={patientId} />
    </div>
  );
}
