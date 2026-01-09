'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm, type EncounterFormData } from '@/components/medical-records/EncounterForm';

export default function NewEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const handleSubmit = async (formData: EncounterFormData) => {
    const res = await fetch(`/api/medical-records/patients/${patientId}/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear consulta');
    }

    const data = await res.json();

    if (!data?.data?.id) {
      throw new Error('Invalid response format');
    }

    // Redirect to encounter detail
    router.push(`/dashboard/medical-records/patients/${patientId}/encounters/${data.data.id}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Consulta</h1>
        <p className="text-gray-600 mt-1">Registre los detalles de la consulta</p>
      </div>

      <EncounterForm
        patientId={patientId}
        onSubmit={handleSubmit}
        submitLabel="Crear Consulta"
      />
    </div>
  );
}
