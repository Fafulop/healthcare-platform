'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm, type EncounterFormData } from '@/components/medical-records/EncounterForm';

export default function EditEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [encounter, setEncounter] = useState<any | null>(null);
  const [customTemplate, setCustomTemplate] = useState<any | null>(null);
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

      // If created with a custom template, fetch it so the form can render custom fields
      if (data.data.templateId) {
        fetchCustomTemplate(data.data.templateId);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading encounter');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setCustomTemplate(data.data);
      }
    } catch (err) {
      console.error('Error fetching custom template:', err);
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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
          {encounter.patient?.firstName} {encounter.patient?.lastName}
          {encounter.chiefComplaint ? ` • ${encounter.chiefComplaint}` : customTemplate ? ` • ${customTemplate.name}` : ''}
        </p>
      </div>

      <EncounterForm
        patientId={patientId}
        initialData={encounter}
        onSubmit={handleSubmit}
        submitLabel="Guardar Cambios"
        cancelHref={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
        isEditing={true}
        selectedTemplate={customTemplate}
      />
    </div>
  );
}
