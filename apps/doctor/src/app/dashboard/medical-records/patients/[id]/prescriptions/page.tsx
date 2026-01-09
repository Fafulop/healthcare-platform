'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Filter } from 'lucide-react';
import Link from 'next/link';
import { PrescriptionCard, type Prescription } from '@/components/medical-records/PrescriptionCard';

export default function PrescriptionsListPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchPrescriptions();
  }, [patientId, statusFilter]);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter) {
        queryParams.append('status', statusFilter);
      }

      const url = `/api/medical-records/patients/${patientId}/prescriptions${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;

      const res = await fetch(url);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar prescripciones');
      }

      const data = await res.json();
      setPrescriptions(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar prescripciones');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando prescripciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Paciente
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prescripciones</h1>
            <p className="text-gray-600 mt-1">Gestiona las prescripciones del paciente</p>
          </div>

          <Link
            href={`/dashboard/medical-records/patients/${patientId}/prescriptions/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Prescripción
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borradores</option>
            <option value="issued">Emitidas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Prescriptions List */}
      {prescriptions.length > 0 ? (
        <div className="space-y-3">
          {prescriptions.map((prescription) => (
            <PrescriptionCard
              key={prescription.id}
              prescription={prescription}
              patientId={patientId}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">
            {statusFilter
              ? 'No se encontraron prescripciones con este filtro'
              : 'No hay prescripciones registradas'}
          </p>
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/prescriptions/new`}
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Crear Primera Prescripción
          </Link>
        </div>
      )}
    </div>
  );
}
