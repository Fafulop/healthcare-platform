'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { PatientCard, type Patient } from '@/components/medical-records/PatientCard';
import { PatientSearchBar } from '@/components/medical-records/PatientSearchBar';
import { VoiceButton } from '@/components/voice-assistant';
import type { VoicePatientData } from '@/types/voice-assistant';

export default function PatientsPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Handle voice assistant completion
  const handleVoiceComplete = (
    data: VoicePatientData,
    sessionId: string,
    transcriptId: string
  ) => {
    // Store voice data for the form page to pick up
    sessionStorage.setItem('voicePatientData', JSON.stringify({
      data,
      sessionId,
      transcriptId,
    }));
    // Navigate to form with voice flag
    router.push('/dashboard/medical-records/patients/new?voice=true');
  };

  useEffect(() => {
    fetchPatients();
  }, [statusFilter, session]);

  const fetchPatients = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        ...(search && { search })
      });

      const res = await fetch(`/api/medical-records/patients?${params}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error fetching patients');
      }

      const data = await res.json();

      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format');
      }

      setPatients(data.data);
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Error loading patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients();
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando expedientes médicos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expedientes Médicos</h1>
            <p className="text-gray-600 mt-1">
              Gestiona los expedientes de tus pacientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/medical-records/patients/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Paciente
            </Link>
            <VoiceButton
              sessionType="NEW_PATIENT"
              onComplete={handleVoiceComplete}
              variant="outline"
              label="Voz"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <PatientSearchBar
        search={search}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onSubmit={handleSearch}
      />

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Lista de Pacientes */}
      {patients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No se encontraron pacientes</p>
          <p className="text-gray-400 text-sm mb-4">
            Comienza agregando tu primer paciente
          </p>
          <Link
            href="/dashboard/medical-records/patients/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Paciente
          </Link>
        </div>
      )}
    </div>
  );
}
