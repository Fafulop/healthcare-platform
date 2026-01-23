'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Mic } from 'lucide-react';
import Link from 'next/link';
import { MedicationList, type Medication } from '@/components/medical-records/MedicationList';
import {
  AIDraftBanner,
  VoiceChatSidebar,
  VoiceRecordingModal,
} from '@/components/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoicePrescriptionData, VoiceStructuredData } from '@/types/voice-assistant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format date string for display (fixes timezone issues)
function formatDateString(dateStr: string, locale: string = 'es-MX'): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString(locale);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

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

interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
}

export default function NewPrescriptionPage() {
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

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
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
    const voiceData = data as VoicePrescriptionData;

    // Calculate extracted fields
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoicePrescriptionData] != null &&
           voiceData[k as keyof VoicePrescriptionData] !== ''
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

    const voiceData = data as VoicePrescriptionData;

    // Pre-fill form fields
    if (voiceData.prescriptionDate) setPrescriptionDate(voiceData.prescriptionDate);
    if (voiceData.diagnosis) setDiagnosis(voiceData.diagnosis);
    if (voiceData.clinicalNotes) setClinicalNotes(voiceData.clinicalNotes);
    if (voiceData.doctorFullName) setDoctorFullName(voiceData.doctorFullName);
    if (voiceData.doctorLicense) setDoctorLicense(voiceData.doctorLicense);
    if (voiceData.expiresAt) setExpiresAt(voiceData.expiresAt);

    // Pre-fill medications
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

    // Calculate extracted/empty fields for banner
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

    // Clear initial data after confirming
    setSidebarInitialData(undefined);

    console.log('[Page] Form should now be filled with voice data');
  }, []);

  // Form state
  const [prescriptionDate, setPrescriptionDate] = useState(
    getLocalDateString(new Date())
  );
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [doctorFullName, setDoctorFullName] = useState('');
  const [doctorLicense, setDoctorLicense] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    {
      drugName: '',
      dosage: '',
      frequency: '',
      instructions: '',
      order: 0,
    }
  ]);

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

          // Pre-fill form fields
          if (data.prescriptionDate) setPrescriptionDate(data.prescriptionDate);
          if (data.diagnosis) setDiagnosis(data.diagnosis);
          if (data.clinicalNotes) setClinicalNotes(data.clinicalNotes);
          if (data.doctorFullName) setDoctorFullName(data.doctorFullName);
          if (data.doctorLicense) setDoctorLicense(data.doctorLicense);
          if (data.expiresAt) setExpiresAt(data.expiresAt);

          // Pre-fill medications
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

          // Calculate extracted/empty fields
          const extracted: string[] = [];
          const empty: string[] = [];

          if (data.prescriptionDate) extracted.push('prescriptionDate'); else empty.push('prescriptionDate');
          if (data.diagnosis) extracted.push('diagnosis'); else empty.push('diagnosis');
          if (data.clinicalNotes) extracted.push('clinicalNotes'); else empty.push('clinicalNotes');
          if (data.doctorFullName) extracted.push('doctorFullName'); else empty.push('doctorFullName');
          if (data.doctorLicense) extracted.push('doctorLicense'); else empty.push('doctorLicense');
          if (data.medications && data.medications.length > 0) extracted.push('medications'); else empty.push('medications');

          // Set AI metadata for banner
          setAIMetadata({
            sessionId,
            transcriptId,
            fieldsExtracted: extracted,
            fieldsEmpty: empty,
            confidence: data.medications && data.medications.length > 0 ? 'high' : 'medium',
          });

          setShowAIBanner(true);
          setVoiceDataLoaded(true);

          // Clear storage
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
      if (!res.ok) {
        throw new Error('Error al cargar paciente');
      }
      const data = await res.json();
      setPatient(data.data);
      setEncounters(data.data.encounters || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, saveAndIssue: boolean = false) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate medications
      console.log('[Submit] All medications:', medications);
      const validMedications = medications.filter(
        (med) => med.drugName && med.dosage && med.frequency && med.instructions
      );
      console.log('[Submit] Valid medications:', validMedications);
      console.log('[Submit] Validation details:', medications.map(med => ({
        drugName: !!med.drugName,
        dosage: !!med.dosage,
        frequency: !!med.frequency,
        instructions: !!med.instructions,
      })));

      if (validMedications.length === 0) {
        throw new Error('Debe agregar al menos un medicamento válido');
      }

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

      // Add medications
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
          throw new Error('Error al agregar medicamento');
        }
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

      // Redirect to prescription detail
      router.push(
        `/dashboard/medical-records/patients/${patientId}/prescriptions/${prescription.id}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loadingPatient) {
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
          href={`/dashboard/medical-records/patients/${patientId}/prescriptions`}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Prescripciones
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Prescripción</h1>
            {patient && (
              <p className="text-gray-600 mt-1">
                Paciente: {patient.firstName} {patient.lastName} (ID: {patient.internalId})
              </p>
            )}
          </div>
          {/* Voice Assistant Button - hidden after data is loaded */}
          {!voiceDataLoaded && !showAIBanner && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mic className="w-5 h-5" />
              Asistente de Voz
            </button>
          )}
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Prescription Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información General</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Prescripción *
              </label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Expiración
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diagnóstico
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Ej: Infección respiratoria aguda"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas Clínicas
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Notas adicionales sobre el tratamiento"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vincular a Consulta (Opcional)
            </label>
            <select
              value={selectedEncounterId}
              onChange={(e) => setSelectedEncounterId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Ninguna consulta seleccionada</option>
              {encounters.map(encounter => (
                <option key={encounter.id} value={encounter.id}>
                  {formatDateString(encounter.encounterDate, 'es-MX')} - {encounter.chiefComplaint}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Doctor Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información del Doctor</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={doctorFullName}
                onChange={(e) => setDoctorFullName(e.target.value)}
                placeholder="Dr. Juan Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula Profesional *
              </label>
              <input
                type="text"
                value={doctorLicense}
                onChange={(e) => setDoctorLicense(e.target.value)}
                placeholder="1234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Medications */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Medicamentos</h2>
          <MedicationList
            medications={medications}
            onChange={setMedications}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/prescriptions`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar como Borrador'}
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar y Emitir'}
          </button>
        </div>
      </form>

      {/* Voice Recording Modal */}
      {session?.user?.doctorId && (
        <VoiceRecordingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sessionType="NEW_PRESCRIPTION"
          context={{
            patientId,
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
          sessionType="NEW_PRESCRIPTION"
          patientId={patientId}
          doctorId={session.user.doctorId}
          context={{
            patientId,
            doctorId: session.user.doctorId,
            doctorName: doctorProfile?.slug || undefined,
          }}
          initialData={sidebarInitialData}
          onConfirm={handleVoiceConfirm}
        />
      )}
    </div>
  );
}
