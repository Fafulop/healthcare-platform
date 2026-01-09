'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PatientCard, type Patient } from '@/components/medical-records/PatientCard';
import { PatientSearchBar } from '@/components/medical-records/PatientSearchBar';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatients();
  }, [statusFilter]);

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

  return (
    <div className="p-6">
      {/* Back to Dashboard Link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver al Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expedientes Médicos</h1>
          <p className="text-gray-600 mt-1">
            Gestiona los expedientes de tus pacientes
          </p>
        </div>
        <Link
          href="/dashboard/medical-records/patients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Paciente
        </Link>
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

      {/* Patient List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando pacientes...</p>
        </div>
      ) : patients.length > 0 ? (
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
