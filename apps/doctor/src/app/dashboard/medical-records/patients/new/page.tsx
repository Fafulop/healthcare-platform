'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, Mic, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PatientForm, type PatientFormData } from '@/components/medical-records/PatientForm';
import { PatientChatPanel } from '@/components/medical-records/PatientChatPanel';
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoicePatientData, VoiceStructuredData } from '@/types/voice-assistant';

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

  // Voice recording modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Voice chat sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  // Chat IA panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [currentFormSnapshot, setCurrentFormSnapshot] = useState<Record<string, string>>({});
  const [chatFieldUpdates, setChatFieldUpdates] = useState<Record<string, string>>({});
  const [chatFieldUpdatesVersion, setChatFieldUpdatesVersion] = useState(0);

  // Auto-open chat panel from hub widget
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  // Voice assistant result state
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

  // Handle modal completion - transition to sidebar with initial data
  const handleModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoicePatientData;

    // Calculate extracted fields
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoicePatientData] != null &&
           voiceData[k as keyof VoicePatientData] !== ''
    );

    // Prepare initial data for sidebar
    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    // Close modal, set initial data, and open sidebar
    setModalOpen(false);
    setSidebarInitialData(initialData);
    setSidebarOpen(true);
  }, []);

  // Handle voice chat confirm - populate form with extracted data
  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    console.log('[Page] handleVoiceConfirm called with data:', data);

    const voiceData = data as VoicePatientData;

    // Map voice data to form data
    const mappedData = mapVoiceToFormData(voiceData);
    console.log('[Page] Mapped data for form:', mappedData);

    setVoiceInitialData(mappedData);

    // Calculate extracted/empty fields for banner
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(k => voiceData[k as keyof VoicePatientData] != null && voiceData[k as keyof VoicePatientData] !== '');
    const empty = allFields.filter(k => voiceData[k as keyof VoicePatientData] == null || voiceData[k as keyof VoicePatientData] === '');

    console.log('[Page] Fields analysis:', { extracted, empty });

    setAIMetadata({
      sessionId: crypto.randomUUID(),
      transcriptId: crypto.randomUUID(),
      fieldsExtracted: extracted,
      fieldsEmpty: empty,
      confidence: extracted.length > 5 ? 'high' : extracted.length > 2 ? 'medium' : 'low',
    });

    setShowAIBanner(true);

    // Close sidebar and clear initial data
    setSidebarOpen(false);
    setSidebarInitialData(undefined);

    console.log('[Page] Form should now be filled with voice data');
  }, []);

  // Chat IA: handle field updates from chat
  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    setChatFieldUpdates(updates as Record<string, string>);
    setChatFieldUpdatesVersion((v) => v + 1);
  }, []);

  // Chat IA: memoized form data for the chat panel
  const chatFormData = useMemo(() => ({
    firstName: currentFormSnapshot.firstName || '',
    lastName: currentFormSnapshot.lastName || '',
    dateOfBirth: currentFormSnapshot.dateOfBirth || '',
    sex: currentFormSnapshot.sex || '',
    bloodType: currentFormSnapshot.bloodType || '',
    internalId: currentFormSnapshot.internalId || '',
    phone: currentFormSnapshot.phone || '',
    email: currentFormSnapshot.email || '',
    address: currentFormSnapshot.address || '',
    city: currentFormSnapshot.city || '',
    state: currentFormSnapshot.state || '',
    postalCode: currentFormSnapshot.postalCode || '',
    emergencyContactName: currentFormSnapshot.emergencyContactName || '',
    emergencyContactPhone: currentFormSnapshot.emergencyContactPhone || '',
    emergencyContactRelation: currentFormSnapshot.emergencyContactRelation || '',
    currentAllergies: currentFormSnapshot.currentAllergies || '',
    currentChronicConditions: currentFormSnapshot.currentChronicConditions || '',
    currentMedications: currentFormSnapshot.currentMedications || '',
    generalNotes: currentFormSnapshot.generalNotes || '',
    tags: currentFormSnapshot.tags || '',
  }), [currentFormSnapshot]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Paciente</h1>
            <p className="text-gray-600 mt-1">Complete la información del paciente</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Chat IA Button */}
            <button
              onClick={() => setChatPanelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Chat IA
            </button>
            {/* Voice Assistant Button - disabled */}
            {!voiceInitialData && !showAIBanner && (
              <button
                onClick={() => setModalOpen(true)}
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed"
                title="Asistente de Voz (deshabilitado)"
              >
                <Mic className="w-5 h-5" />
                Asistente de Voz
              </button>
            )}
          </div>
        </div>
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
        onFormChange={setCurrentFormSnapshot}
        chatFieldUpdates={chatFieldUpdates}
        chatFieldUpdatesVersion={chatFieldUpdatesVersion}
      />

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_PATIENT"
          context={{
            patientId: undefined,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          onComplete={handleModalComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionType="NEW_PATIENT"
          patientId="new"
          doctorId={session.user.doctorId}
          context={{
            patientId: undefined,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}

      {/* Chat IA Panel */}
      {chatPanelOpen && (
        <PatientChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates}
        />
      )}
    </div>
  );
}
