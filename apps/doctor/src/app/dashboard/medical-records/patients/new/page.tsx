'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PatientForm, type PatientFormData } from '@/components/medical-records/PatientForm';
import { AIDraftBanner } from '@/components/voice-assistant';
import type { VoicePatientData } from '@/types/voice-assistant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

// Helper to map voice data to form data
function mapVoiceToFormData(voiceData: VoicePatientData): Partial<PatientFormData> {
  return {
    internalId: voiceData.internalId || undefined,
    firstName: voiceData.firstName || '',
    lastName: voiceData.lastName || '',
    dateOfBirth: voiceData.dateOfBirth || '',
    sex: voiceData.sex || 'male',
    bloodType: voiceData.bloodType || undefined,
    phone: voiceData.phone || undefined,
    email: voiceData.email || undefined,
    address: voiceData.address || undefined,
    city: voiceData.city || undefined,
    state: voiceData.state || undefined,
    postalCode: voiceData.postalCode || undefined,
    emergencyContactName: voiceData.emergencyContactName || undefined,
    emergencyContactPhone: voiceData.emergencyContactPhone || undefined,
    emergencyContactRelation: voiceData.emergencyContactRelation || undefined,
    currentAllergies: voiceData.currentAllergies || undefined,
    currentChronicConditions: voiceData.currentChronicConditions || undefined,
    currentMedications: voiceData.currentMedications || undefined,
    generalNotes: voiceData.generalNotes || undefined,
    tags: voiceData.tags || undefined,
  };
}

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

export default function NewPatientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  // Voice assistant state
  const [voiceInitialData, setVoiceInitialData] = useState<Partial<PatientFormData> | undefined>(undefined);
  const [showAIBanner, setShowAIBanner] = useState(false);
  const [aiMetadata, setAIMetadata] = useState<{
    sessionId: string;
    transcriptId: string;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);

  // Load voice data from sessionStorage
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voicePatientData');
      if (stored) {
        try {
          const { data, sessionId, transcriptId } = JSON.parse(stored);

          // Map voice data to form data
          setVoiceInitialData(mapVoiceToFormData(data));

          // Calculate extracted/empty fields
          const allFields = Object.keys(data);
          const extracted = allFields.filter(k => data[k] != null && data[k] !== '');
          const empty = allFields.filter(k => data[k] == null || data[k] === '');

          // Set AI metadata for banner
          setAIMetadata({
            sessionId,
            transcriptId,
            fieldsExtracted: extracted,
            fieldsEmpty: empty,
            confidence: extracted.length > 5 ? 'high' : extracted.length > 2 ? 'medium' : 'low',
          });

          setShowAIBanner(true);

          // Clear storage
          sessionStorage.removeItem('voicePatientData');
        } catch (e) {
          console.error('Error parsing voice data:', e);
        }
      }
    }
  }, [searchParams]);

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

  const handleSubmit = async (formData: PatientFormData) => {
    const res = await fetch('/api/medical-records/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear paciente');
    }

    const data = await res.json();

    if (!data?.data?.id) {
      throw new Error('Invalid response format');
    }

    // Redirect to patient profile
    router.push(`/dashboard/medical-records/patients/${data.data.id}`);
  };

  if (status === "loading") {
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
          href="/dashboard/medical-records"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Pacientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Paciente</h1>
        <p className="text-gray-600 mt-1">Complete la información del paciente</p>
      </div>

      {/* AI Draft Banner */}
      {showAIBanner && aiMetadata && (
        <AIDraftBanner
          confidence={aiMetadata.confidence}
          fieldsExtracted={aiMetadata.fieldsExtracted}
          fieldsEmpty={aiMetadata.fieldsEmpty}
          onDismiss={() => setShowAIBanner(false)}
        />
      )}

      <PatientForm
        initialData={voiceInitialData}
        onSubmit={handleSubmit}
        submitLabel="Crear Paciente"
        cancelHref="/dashboard/medical-records"
      />
    </div>
  );
}
