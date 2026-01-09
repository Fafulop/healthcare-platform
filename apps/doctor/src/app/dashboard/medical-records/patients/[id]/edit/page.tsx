'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PatientForm, type PatientFormData } from '@/components/medical-records/PatientForm';

export default function EditPatientPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar paciente');
      }

      const data = await res.json();

      if (!data?.data) {
        throw new Error('Invalid response format');
      }

      setPatient(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading patient');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: PatientFormData) => {
    const res = await fetch(`/api/medical-records/patients/${patientId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al actualizar paciente');
    }

    // Redirect to patient profile
    router.push(`/dashboard/medical-records/patients/${patientId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando paciente...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Paciente no encontrado'}</p>
          <Link
            href="/dashboard/medical-records"
            className="text-red-600 hover:text-red-800 mt-2 inline-block"
          >
            Volver a la lista
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
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Editar Paciente: {patient.firstName} {patient.lastName}
        </h1>
        <p className="text-gray-600 mt-1">Actualice la información del paciente</p>
      </div>

      <PatientForm
        initialData={patient}
        onSubmit={handleSubmit}
        submitLabel="Guardar Cambios"
        cancelHref={`/dashboard/medical-records/patients/${patientId}`}
        isEditing={true}
      />
    </div>
  );
}
