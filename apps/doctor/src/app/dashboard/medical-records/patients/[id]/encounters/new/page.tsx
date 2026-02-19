'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { EncounterForm, type EncounterFormData, type TemplateConfig } from '@/components/medical-records/EncounterForm';
import { TemplateSelector } from '@/components/medical-records/TemplateSelector';
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import { EncounterChatPanel } from '@/components/medical-records/EncounterChatPanel';
import type { TemplateInfo } from '@/hooks/useEncounterChat';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceEncounterData, VoiceStructuredData } from '@/types/voice-assistant';
import type { EncounterTemplate, FieldVisibility, DefaultValues } from '@/types/encounter-template';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to map voice data to form data
function mapVoiceToFormData(voiceData: VoiceEncounterData): Partial<EncounterFormData> {
  return {
    encounterDate: voiceData.encounterDate || getLocalDateString(new Date()),
    encounterType: voiceData.encounterType || 'consultation',
    chiefComplaint: voiceData.chiefComplaint || '',
    location: voiceData.location || undefined,
    status: voiceData.status || 'draft',
    vitalsBloodPressure: voiceData.vitalsBloodPressure || undefined,
    vitalsHeartRate: voiceData.vitalsHeartRate || undefined,
    vitalsTemperature: voiceData.vitalsTemperature || undefined,
    vitalsWeight: voiceData.vitalsWeight || undefined,
    vitalsHeight: voiceData.vitalsHeight || undefined,
    vitalsOxygenSat: voiceData.vitalsOxygenSat || undefined,
    vitalsOther: voiceData.vitalsOther || undefined,
    clinicalNotes: voiceData.clinicalNotes || undefined,
    subjective: voiceData.subjective || undefined,
    objective: voiceData.objective || undefined,
    assessment: voiceData.assessment || undefined,
    plan: voiceData.plan || undefined,
    followUpDate: voiceData.followUpDate || undefined,
    followUpNotes: voiceData.followUpNotes || undefined,
  };
}

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

export default function NewEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<EncounterTemplate | null>(null);

  // Voice recording modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Voice chat sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  // Voice assistant state
  const [voiceInitialData, setVoiceInitialData] = useState<Partial<EncounterFormData> | undefined>(undefined);
  const [showAIBanner, setShowAIBanner] = useState(false);
  const [aiMetadata, setAIMetadata] = useState<{
    sessionId: string;
    transcriptId: string;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);

  // AI Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [currentFormData, setCurrentFormData] = useState<EncounterFormData | null>(null);
  const [currentCustomFieldValues, setCurrentCustomFieldValues] = useState<Record<string, any>>({});
  const [chatFieldUpdates, setChatFieldUpdates] = useState<{ version: number; updates: Partial<EncounterFormData> } | null>(null);
  const [chatCustomFieldUpdates, setChatCustomFieldUpdates] = useState<{ version: number; updates: Record<string, any> } | null>(null);
  const chatVersionRef = useRef(0);

  // Load voice data from sessionStorage
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceEncounterData');
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
            confidence: extracted.length > 6 ? 'high' : extracted.length > 3 ? 'medium' : 'low',
          });

          setShowAIBanner(true);

          // Clear storage
          sessionStorage.removeItem('voiceEncounterData');
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
    const voiceData = data as VoiceEncounterData;

    // Calculate extracted fields
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceEncounterData] != null &&
           voiceData[k as keyof VoiceEncounterData] !== ''
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

    const voiceData = data as VoiceEncounterData;
    const mappedData = mapVoiceToFormData(voiceData);

    console.log('[Page] Mapped data for form:', mappedData);

    setVoiceInitialData(mappedData);

    // Calculate extracted/empty fields for banner
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(k => voiceData[k as keyof VoiceEncounterData] != null && voiceData[k as keyof VoiceEncounterData] !== '');
    const empty = allFields.filter(k => voiceData[k as keyof VoiceEncounterData] == null || voiceData[k as keyof VoiceEncounterData] === '');

    console.log('[Page] Fields analysis:', { extracted, empty });

    setAIMetadata({
      sessionId: crypto.randomUUID(),
      transcriptId: crypto.randomUUID(),
      fieldsExtracted: extracted,
      fieldsEmpty: empty,
      confidence: extracted.length > 6 ? 'high' : extracted.length > 3 ? 'medium' : 'low',
    });

    setShowAIBanner(true);

    // Clear initial data after confirming
    setSidebarInitialData(undefined);

    console.log('[Page] Form should now be filled with voice data');
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: EncounterTemplate | null) => {
    setSelectedTemplate(template);
  }, []);

  // Handle form data updates from chat panel — push directly to form via versioned updates
  const handleChatUpdateForm = useCallback((updates: Partial<EncounterFormData>) => {
    chatVersionRef.current += 1;
    setChatFieldUpdates({ version: chatVersionRef.current, updates });
  }, []);

  const handleChatUpdateCustomFields = useCallback((updates: Record<string, any>) => {
    chatVersionRef.current += 1;
    setChatCustomFieldUpdates({ version: chatVersionRef.current, updates });
  }, []);

  // Build templateInfo for the chat panel
  const chatTemplateInfo: TemplateInfo = selectedTemplate
    ? selectedTemplate.isCustom
      ? {
          type: 'custom',
          name: selectedTemplate.name,
          customFields: (selectedTemplate as any).customFields?.map((f: any) => ({
            name: f.name,
            label: f.label || f.labelEs,
            type: f.type,
            options: f.options,
          })),
        }
      : {
          type: 'standard',
          name: selectedTemplate.name,
          fieldVisibility: selectedTemplate.fieldVisibility as unknown as Record<string, boolean>,
        }
    : { type: 'standard' };

  // Build template config for the form
  const templateConfig: TemplateConfig | undefined = selectedTemplate
    ? {
        fieldVisibility: selectedTemplate.fieldVisibility as FieldVisibility,
        defaultValues: selectedTemplate.defaultValues as DefaultValues,
        useSOAPMode: selectedTemplate.useSOAPMode,
      }
    : undefined;

  // Track template usage
  const trackTemplateUsage = async (templateId: string) => {
    try {
      await fetch(`/api/medical-records/templates/${templateId}/usage`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error tracking template usage:', err);
      // Don't throw - tracking shouldn't block the encounter creation
    }
  };

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

    // Track template usage if a template was selected
    if (selectedTemplate) {
      await trackTemplateUsage(selectedTemplate.id);
    }

    // Redirect to encounter detail
    router.push(`/dashboard/medical-records/patients/${patientId}/encounters/${data.data.id}`);
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
          href={`/dashboard/medical-records/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Paciente
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Consulta</h1>
            <p className="text-gray-600 mt-1">Registre los detalles de la consulta</p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Chat Panel Button */}
            <button
              onClick={() => setChatPanelOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                chatPanelOpen
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              Chat IA
            </button>
          </div>
        </div>
      </div>

      {/* Template Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Plantilla:
          </label>
          <TemplateSelector
            selectedTemplateId={selectedTemplate?.id || null}
            onSelect={handleTemplateSelect}
          />
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

      <EncounterForm
        key={selectedTemplate?.id || 'no-template'} // Re-mount form when template changes
        patientId={patientId}
        initialData={voiceInitialData}
        onSubmit={handleSubmit}
        submitLabel="Crear Consulta"
        templateConfig={templateConfig}
        selectedTemplate={selectedTemplate}
        onFormDataChange={setCurrentFormData}
        onCustomFieldValuesChange={setCurrentCustomFieldValues}
        chatFieldUpdates={chatFieldUpdates}
        chatCustomFieldUpdates={chatCustomFieldUpdates}
      />

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_ENCOUNTER"
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          templateId={selectedTemplate?.id}
          onComplete={handleModalComplete}
        />
      )}

      {/* AI Chat Panel */}
      {chatPanelOpen && currentFormData && (
        <EncounterChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={currentFormData}
          onUpdateForm={handleChatUpdateForm}
          templateInfo={chatTemplateInfo}
          onUpdateCustomFields={handleChatUpdateCustomFields}
        />
      )}

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionType="NEW_ENCOUNTER"
          patientId={patientId}
          doctorId={session.user.doctorId}
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          templateId={selectedTemplate?.id}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}
    </div>
  );
}
