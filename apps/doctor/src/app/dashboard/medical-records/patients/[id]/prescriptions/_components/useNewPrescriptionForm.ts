'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { Medication } from '@/components/medical-records/MedicationList';
import type { PrescriptionFormData } from '@/hooks/usePrescriptionChat';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoicePrescriptionData, VoiceStructuredData } from '@/types/voice-assistant';
import { fetchDoctorProfile, type PracticeDoctorProfile } from '@/lib/practice-utils';
import { getLocalDateString } from '@/lib/dates';
import { validateMedications } from './prescription-types';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string;
}

interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
}

export function useNewPrescriptionForm() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = params.id as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>('');

  // Voice recording modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Voice chat sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  // Chat IA panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  // Voice assistant result state
  const [showAIBanner, setShowAIBanner] = useState(false);
  const [aiMetadata, setAIMetadata] = useState<{
    sessionId: string;
    transcriptId: string;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);
  const [voiceDataLoaded, setVoiceDataLoaded] = useState(false);

  // Form state
  const [prescriptionDate, setPrescriptionDate] = useState(getLocalDateString(new Date()));
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [doctorFullName, setDoctorFullName] = useState('');
  const [doctorLicense, setDoctorLicense] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { drugName: '', dosage: '', frequency: '', instructions: '', order: 0 },
  ]);

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
    const voiceData = data as VoicePrescriptionData;

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoicePrescriptionData] != null &&
           voiceData[k as keyof VoicePrescriptionData] !== ''
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

    const voiceData = data as VoicePrescriptionData;

    if (voiceData.prescriptionDate) setPrescriptionDate(voiceData.prescriptionDate);
    if (voiceData.diagnosis) setDiagnosis(voiceData.diagnosis);
    if (voiceData.clinicalNotes) setClinicalNotes(voiceData.clinicalNotes);
    if (voiceData.doctorFullName) setDoctorFullName(voiceData.doctorFullName);
    if (voiceData.doctorLicense) setDoctorLicense(voiceData.doctorLicense);
    if (voiceData.expiresAt) setExpiresAt(voiceData.expiresAt);

    if (voiceData.medications && voiceData.medications.length > 0) {
      console.log('[Page] Medications from voice:', voiceData.medications);
      const mappedMedications = voiceData.medications.map((med, index) => ({
        drugName: med.drugName || '',
        presentation: med.presentation || undefined,
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        duration: med.duration || undefined,
        quantity: med.quantity || undefined,
        instructions: med.instructions || '',
        warnings: med.warnings || undefined,
        order: index,
      }));
      console.log('[Page] Mapped medications:', mappedMedications);
      setMedications(mappedMedications);
    }

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoicePrescriptionData] != null &&
           voiceData[k as keyof VoicePrescriptionData] !== ''
    );
    const empty = allFields.filter(
      k => voiceData[k as keyof VoicePrescriptionData] == null ||
           voiceData[k as keyof VoicePrescriptionData] === ''
    );

    console.log('[Page] Fields analysis:', { extracted, empty });

    setAIMetadata({
      sessionId: crypto.randomUUID(),
      transcriptId: crypto.randomUUID(),
      fieldsExtracted: extracted,
      fieldsEmpty: empty,
      confidence: voiceData.medications && voiceData.medications.length > 0 ? 'high' : 'medium',
    });

    setShowAIBanner(true);
    setSidebarInitialData(undefined);

    console.log('[Page] Form should now be filled with voice data');
  }, []);

  // Load voice data from sessionStorage
  useEffect(() => {
    if (searchParams.get('voice') === 'true' && !voiceDataLoaded) {
      const stored = sessionStorage.getItem('voicePrescriptionData');
      if (stored) {
        try {
          const { data, sessionId, transcriptId } = JSON.parse(stored) as {
            data: VoicePrescriptionData;
            sessionId: string;
            transcriptId: string;
          };

          if (data.prescriptionDate) setPrescriptionDate(data.prescriptionDate);
          if (data.diagnosis) setDiagnosis(data.diagnosis);
          if (data.clinicalNotes) setClinicalNotes(data.clinicalNotes);
          if (data.doctorFullName) setDoctorFullName(data.doctorFullName);
          if (data.doctorLicense) setDoctorLicense(data.doctorLicense);
          if (data.expiresAt) setExpiresAt(data.expiresAt);

          if (data.medications && data.medications.length > 0) {
            setMedications(data.medications.map((med, index) => ({
              drugName: med.drugName || '',
              presentation: med.presentation || undefined,
              dosage: med.dosage || '',
              frequency: med.frequency || '',
              duration: med.duration || undefined,
              quantity: med.quantity || undefined,
              instructions: med.instructions || '',
              warnings: med.warnings || undefined,
              order: index,
            })));
          }

          const extracted: string[] = [];
          const empty: string[] = [];

          if (data.prescriptionDate) extracted.push('prescriptionDate'); else empty.push('prescriptionDate');
          if (data.diagnosis) extracted.push('diagnosis'); else empty.push('diagnosis');
          if (data.clinicalNotes) extracted.push('clinicalNotes'); else empty.push('clinicalNotes');
          if (data.doctorFullName) extracted.push('doctorFullName'); else empty.push('doctorFullName');
          if (data.doctorLicense) extracted.push('doctorLicense'); else empty.push('doctorLicense');
          if (data.medications && data.medications.length > 0) extracted.push('medications'); else empty.push('medications');

          setAIMetadata({
            sessionId,
            transcriptId,
            fieldsExtracted: extracted,
            fieldsEmpty: empty,
            confidence: data.medications && data.medications.length > 0 ? 'high' : 'medium',
          });

          setShowAIBanner(true);
          setVoiceDataLoaded(true);

          sessionStorage.removeItem('voicePrescriptionData');
        } catch (e) {
          console.error('Error parsing voice data:', e);
        }
      }
    }
  }, [searchParams, voiceDataLoaded]);

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}`);
      if (!res.ok) throw new Error('Error al cargar paciente');
      const data = await res.json();
      setPatient(data.data);
      setEncounters(data.data.encounters || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPatient(false);
    }
  };

  // Computed form data for Chat IA
  const currentFormData: PrescriptionFormData = useMemo(() => ({
    prescriptionDate,
    diagnosis,
    clinicalNotes,
    doctorFullName,
    doctorLicense,
    expiresAt,
    medications,
  }), [prescriptionDate, diagnosis, clinicalNotes, doctorFullName, doctorLicense, expiresAt, medications]);

  // Chat IA callbacks
  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    if (updates.prescriptionDate) setPrescriptionDate(updates.prescriptionDate);
    if (updates.diagnosis) setDiagnosis(updates.diagnosis);
    if (updates.clinicalNotes) setClinicalNotes(updates.clinicalNotes);
    if (updates.doctorFullName) setDoctorFullName(updates.doctorFullName);
    if (updates.doctorLicense) setDoctorLicense(updates.doctorLicense);
    if (updates.expiresAt) setExpiresAt(updates.expiresAt);
  }, []);

  const handleChatMedicationUpdates = useCallback((meds: Medication[]) => {
    setMedications(meds);
  }, []);

  const handleSubmit = async (e: React.FormEvent, saveAndIssue: boolean = false) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate medications — require all fields the backend also requires
      const validMedications = medications.filter((med) => med.drugName.trim());

      const validationError = validateMedications(medications);
      if (validationError) throw new Error(validationError);

      if (!doctorFullName || !doctorLicense) {
        throw new Error('Debe completar la información del doctor');
      }

      // Create prescription
      const prescriptionData = {
        prescriptionDate: new Date(prescriptionDate).toISOString(),
        diagnosis: diagnosis || null,
        clinicalNotes: clinicalNotes || null,
        doctorFullName,
        doctorLicense,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        encounterId: selectedEncounterId || null,
      };

      const res = await fetch(`/api/medical-records/patients/${patientId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prescriptionData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear prescripción');
      }

      const { data: prescription } = await res.json();

      // Add medications — rollback prescription if any fail
      try {
        for (const medication of validMedications) {
          const medRes = await fetch(
            `/api/medical-records/patients/${patientId}/prescriptions/${prescription.id}/medications`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(medication),
            }
          );

          if (!medRes.ok) {
            const medErr = await medRes.json();
            throw new Error(medErr.error || 'Error al agregar medicamento');
          }
        }
      } catch (medError: any) {
        // Delete the orphaned prescription so it doesn't clutter the list
        await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescription.id}`,
          { method: 'DELETE' }
        );
        throw medError;
      }

      // If saveAndIssue, issue the prescription
      if (saveAndIssue) {
        const issueRes = await fetch(
          `/api/medical-records/patients/${patientId}/prescriptions/${prescription.id}/issue`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );

        if (!issueRes.ok) {
          throw new Error('Error al emitir prescripción');
        }
      }

      router.push(
        `/dashboard/medical-records/patients/${patientId}/prescriptions/${prescription.id}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    // Route
    patientId,
    session,
    sessionStatus: status,
    // Data
    patient,
    doctorProfile,
    encounters,
    // Loading / error
    loading,
    loadingPatient,
    error,
    // Form fields
    prescriptionDate, setPrescriptionDate,
    diagnosis, setDiagnosis,
    clinicalNotes, setClinicalNotes,
    doctorFullName, setDoctorFullName,
    doctorLicense, setDoctorLicense,
    expiresAt, setExpiresAt,
    medications, setMedications,
    selectedEncounterId, setSelectedEncounterId,
    // Voice
    modalOpen, setModalOpen,
    sidebarOpen, setSidebarOpen,
    sidebarInitialData,
    showAIBanner, setShowAIBanner,
    aiMetadata,
    handleModalComplete,
    handleVoiceConfirm,
    // Chat IA
    chatPanelOpen, setChatPanelOpen,
    currentFormData,
    handleChatFieldUpdates,
    handleChatMedicationUpdates,
    // Submit
    handleSubmit,
  };
}
