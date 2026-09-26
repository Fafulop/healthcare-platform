'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { EncounterFormData, TemplateConfig } from '@/components/medical-records/EncounterForm';
import type { TemplateInfo } from '@/hooks/useEncounterChat';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceEncounterData, VoiceStructuredData } from '@/types/voice-assistant';
import type { EncounterTemplate, FieldVisibility, DefaultValues } from '@/types/encounter-template';
import { fetchDoctorProfile, type PracticeDoctorProfile } from '@/lib/practice-utils';
import { getLocalDateString } from '@/lib/dates';
import { usePermissions } from '@/lib/permissions-client';
import { visitaHref } from '@/lib/visitas-ui';

// Helper to map voice data to form data
function mapVoiceToFormData(voiceData: VoiceEncounterData): Partial<EncounterFormData> {
  return {
    encounterDate: voiceData.encounterDate || getLocalDateString(new Date()),
    encounterType: voiceData.encounterType || 'consultation',
    chiefComplaint: voiceData.chiefComplaint || '',
    location: voiceData.location || undefined,
    status: voiceData.status || 'completed',
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

export function useNewEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = params.id as string;
  // VISITAS D4 — «Agregar plantilla» desde una visita llega con `?visitaId=`: la consulta nace
  // DENTRO de esa visita, con la fecha de la visita (DISEÑO §3), y al guardar se vuelve a ella.
  const visitaId = searchParams.get('visitaId');
  const [fechaVisita, setFechaVisita] = useState<string | null>(null);
  const [errorVisita, setErrorVisita] = useState(false);

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });
  // encounter-chat is a legacy AI surface, OWNER_ONLY regardless of the
  // Expedientes toggle (00-REQUISITOS §5.3) — found via bug hunt 2026-07-21
  // (§16 hallazgo 3 family).
  // TIERS Q2b: la puerta cuelga de la key de plan `ia` (antes `isOwner`).
  // `can('ia')` ya es false para members ⇒ owner-only se conserva.
  // `!permsLoading`: mientras la sesión carga, permissions-client hace
  // fail-open (`isOwner ?? true`, `tier ?? PRO`), así que `can('ia')` sería
  // true en esa ventana y la puerta se pintaría ENCENDIDA en un plan sin IA.
  const { can, loading: permsLoading } = usePermissions();
  const aiAllowed = !permsLoading && can('ia');

  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);
  const [patientName, setPatientName] = useState<string>('');

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
  // ⚠️ HIGH RISK: chatVersionRef drives EncounterForm reconciliation.
  // The ref increment and paired setState calls must remain together in each handler.
  const chatVersionRef = useRef(0);

  // Load voice data from sessionStorage
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceEncounterData');
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
            confidence: extracted.length > 6 ? 'high' : extracted.length > 3 ? 'medium' : 'low',
          });

          setShowAIBanner(true);

          sessionStorage.removeItem('voiceEncounterData');
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

  // Fetch patient name
  useEffect(() => {
    fetch(`/api/medical-records/patients/${patientId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch patient: ${r.status}`);
        return r.json();
      })
      .then((res) => {
        const p = res?.data;
        if (p?.firstName) {
          setPatientName(`${p.firstName} ${p.lastName || ''}`.trim());
        }
      })
      .catch((err) => console.error('Error loading patient name:', err));
  }, [patientId]);

  // La fecha de la visita (con cita, la de la cita: la resuelve el servidor).
  useEffect(() => {
    if (!visitaId) return;
    fetch(`/api/medical-records/patients/${patientId}/visitas/${visitaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((res) => {
        if (typeof res?.data?.fecha !== 'string') throw new Error('sin fecha');
        setFechaVisita(res.data.fecha);
      })
      .catch(() => setErrorVisita(true));
  }, [patientId, visitaId]);

  // Handle modal completion - transition to sidebar with initial data
  const handleModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoiceEncounterData;

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceEncounterData] != null &&
           voiceData[k as keyof VoiceEncounterData] !== ''
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

    const voiceData = data as VoiceEncounterData;
    const mappedData = mapVoiceToFormData(voiceData);

    console.log('[Page] Mapped data for form:', mappedData);

    setVoiceInitialData(mappedData);

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
    setSidebarInitialData(undefined);

    console.log('[Page] Form should now be filled with voice data');
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: EncounterTemplate | null) => {
    setSelectedTemplate(template);
  }, []);

  // Handle form data updates from chat panel — push directly to form via versioned updates
  // ⚠️ HIGH RISK: ref increment + setState must happen together, in this order, every time
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
    // Sin la fecha de la visita no se guarda: saldría con otra fecha, o fuera de la visita.
    if (visitaId && !fechaVisita) {
      throw new Error('No se pudo cargar la visita. Recarga la página para intentar de nuevo.');
    }
    const res = await fetch(`/api/medical-records/patients/${patientId}/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitaId ? { ...formData, encounterDate: fechaVisita, visitaId } : formData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear consulta');
    }

    const data = await res.json();

    if (!data?.data?.id) {
      throw new Error('Invalid response format');
    }

    if (selectedTemplate) {
      await trackTemplateUsage(selectedTemplate.id);
    }

    router.push(
      visitaId
        ? visitaHref(patientId, visitaId)
        : `/dashboard/medical-records/patients/${patientId}/encounters/${data.data.id}`
    );
  };

  return {
    // Route
    patientId,
    session,
    sessionStatus: status,
    aiAllowed,
    // Data
    patientName,
    doctorProfile,
    selectedTemplate,
    // Voice
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    voiceInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    handleTemplateSelect,
    // Chat
    chatPanelOpen, setChatPanelOpen,
    currentFormData, setCurrentFormData,
    currentCustomFieldValues, setCurrentCustomFieldValues,
    chatFieldUpdates,
    chatCustomFieldUpdates,
    chatTemplateInfo,
    handleChatUpdateForm,
    handleChatUpdateCustomFields,
    // Form config
    templateConfig,
    // Submit
    handleSubmit,
    // Visita (D4)
    visitaId,
    fechaVisita,
    errorVisita,
  };
}
