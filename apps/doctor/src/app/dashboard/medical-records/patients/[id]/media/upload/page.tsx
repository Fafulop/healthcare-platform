'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MediaUploader } from '@/components/medical-records/MediaUploader';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

export default function MediaUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

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
      alert('Error al cargar información del paciente');
    }
  };

  const handleUploadComplete = (mediaId: string) => {
    // Redirect to media gallery after successful upload
    router.push(`/dashboard/medical-records/patients/${resolvedParams.id}/media`);
  };

  const handleCancel = () => {
    router.push(`/dashboard/medical-records/patients/${resolvedParams.id}/media`);
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
          href={`/dashboard/medical-records/patients/${resolvedParams.id}/media`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a Documentos y Galería
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
        onUploadComplete={handleUploadComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
