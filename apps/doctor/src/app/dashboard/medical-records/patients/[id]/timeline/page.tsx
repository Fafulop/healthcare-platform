'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Plus, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { TimelineView } from '@/components/medical-records/TimelineView';
import Sidebar from '@/components/layout/Sidebar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

export default function PatientTimelinePage() {
  const params = useParams();
  const patientId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

  useEffect(() => {
    fetchTimeline();
  }, [patientId]);

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
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
      </main>
    </div>
  );
}
