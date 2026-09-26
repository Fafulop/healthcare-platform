'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MediaUploader } from '@/components/medical-records/MediaUploader';
import { toast } from '@/lib/practice-toast';
import { visitaHref } from '@/lib/visitas-ui';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function MediaUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  // VISITAS D4 — «Subir» from a visit: the file lands in THAT visit and we go back to it.
  const visitaId = useSearchParams().get('visitaId') || undefined;
  const volverHref = visitaId
    ? visitaHref(resolvedParams.id, visitaId)
    : `/dashboard/medical-records/patients/${resolvedParams.id}/media`;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    fetchPatient();
  }, [resolvedParams.id]);

  const fetchPatient = async () => {
    try {
      const response = await fetch(`/api/medical-records/patients/${resolvedParams.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch patient');
      }
      const data = await response.json();
      setPatient(data.data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      toast.error('Error al cargar información del paciente');
    }
  };

  const handleUploadComplete = (mediaId: string) => {
    // Redirect to media gallery (or back to the visit) after successful upload
    router.push(volverHref);
  };

  const handleCancel = () => {
    router.push(volverHref);
  };

  if (status === "loading" || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={volverHref}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {visitaId ? 'Volver a la Visita' : 'Volver a Documentos y Galería'}
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subir Medios
        </h1>
        <p className="text-gray-600">
          {patient.firstName} {patient.lastName} (ID: {patient.internalId})
        </p>
      </div>

      {/* Upload Component */}
      <MediaUploader
        patientId={resolvedParams.id}
        visitaId={visitaId}
        onUploadComplete={handleUploadComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
