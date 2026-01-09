'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Patient {
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="archived">Archivados</option>
          </select>

          <button
            type="submit"
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

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
            <Link
              key={patient.id}
              href={`/dashboard/medical-records/patients/${patient.id}`}
            >
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
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ID: {patient.internalId} • {calculateAge(patient.dateOfBirth)} años • {patient.sex}
                    </p>

                    {/* Contact */}
                    {patient.phone && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        📱 {patient.phone}
                      </p>
                    )}

                    {/* Last Visit */}
                    {patient.lastVisitDate && (
                      <p className="text-sm text-gray-500 mt-1">
                        Última visita: {formatDate(patient.lastVisitDate)}
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
