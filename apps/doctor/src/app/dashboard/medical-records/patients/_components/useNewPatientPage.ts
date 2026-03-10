'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { PatientFormData } from '@/components/medical-records/PatientForm';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoicePatientData, VoiceStructuredData } from '@/types/voice-assistant';
import { fetchDoctorProfile, type PracticeDoctorProfile } from '@/lib/practice-utils';

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

export function useNewPatientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);

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

  // Auto-open chat panel from hub widget
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  // Load voice data from sessionStorage
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voicePatientData');
      if (stored) {
        try {
          const { data, sessionId, transcriptId } = JSON.parse(stored);

          setVoiceInitialData(mapVoiceToFormData(data));

          const allFields = Object.keys(data);
          const extracted = allFields.filter(k => data[k] != null && data[k] !== '');
          const empty = allFields.filter(k => data[k] == null || data[k] === '');

          setAIMetadata({
            sessionId,
            transcriptId,
            fieldsExtracted: extracted,
            fieldsEmpty: empty,
            confidence: extracted.length > 5 ? 'high' : extracted.length > 2 ? 'medium' : 'low',
          });

          setShowAIBanner(true);

          sessionStorage.removeItem('voicePatientData');
        } catch (e) {
          console.error('Error parsing voice data:', e);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId).then((profile) => {
        if (profile) setDoctorProfile(profile);
      });
    }
  }, [session]);

  // Handle modal completion - transition to sidebar with initial data
  const handleModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoicePatientData;

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoicePatientData] != null &&
           voiceData[k as keyof VoicePatientData] !== ''
    );

    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    setModalOpen(false);
    setSidebarInitialData(initialData);
    setSidebarOpen(true);
  }, []);

  // Handle voice chat confirm - populate form with extracted data
  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    console.log('[Page] handleVoiceConfirm called with data:', data);

    const voiceData = data as VoicePatientData;
    const mappedData = mapVoiceToFormData(voiceData);
    console.log('[Page] Mapped data for form:', mappedData);

    setVoiceInitialData(mappedData);

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear paciente');
    }

    const data = await res.json();

    if (!data?.data?.id) {
      throw new Error('Invalid response format');
    }

    router.push(`/dashboard/medical-records/patients/${data.data.id}`);
  };

  return {
    // Session
    session,
    sessionStatus: status,
    // Data
    doctorProfile,
    // Voice
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    voiceInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    // Chat IA
    chatPanelOpen, setChatPanelOpen,
    currentFormSnapshot, setCurrentFormSnapshot,
    chatFieldUpdates,
    chatFieldUpdatesVersion,
    chatFormData,
    handleChatFieldUpdates,
    // Submit
    handleSubmit,
  };
}
