'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm, type EncounterFormData } from '@/components/medical-records/EncounterForm';

export default function EditEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const [encounter, setEncounter] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEncounter();
  }, [patientId, encounterId]);

  const fetchEncounter = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/encounters/${encounterId}`);

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

  const handleSubmit = async (formData: EncounterFormData) => {
    const res = await fetch(`/api/medical-records/patients/${patientId}/encounters/${encounterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al actualizar consulta');
    }

    // Redirect to encounter detail
    router.push(`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando consulta...</p>
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la Consulta
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar Consulta</h1>
        <p className="text-gray-600 mt-1">
          {encounter.patient?.firstName} {encounter.patient?.lastName} • {encounter.chiefComplaint}
        </p>
      </div>

      <EncounterForm
        patientId={patientId}
        initialData={encounter}
        onSubmit={handleSubmit}
        submitLabel="Guardar Cambios"
        cancelHref={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
        isEditing={true}
      />
    </div>
  );
}
