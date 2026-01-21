/**
 * Voice Assistant Integration Examples
 *
 * This file shows how to integrate the voice assistant into existing pages.
 * Copy and adapt these patterns for each page.
 *
 * DO NOT import this file directly - it's for reference only.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Link from 'next/link';

// Import voice assistant components
import { VoiceButton, AIDraftBanner } from '@/components/voice-assistant';
import type {
  VoicePatientData,
  VoiceEncounterData,
  VoicePrescriptionData,
} from '@/types/voice-assistant';

// =============================================================================
// EXAMPLE 1: Patient List Page Header
// =============================================================================

/**
 * Shows both manual and voice buttons side by side
 */
function PatientListHeaderExample() {
  const router = useRouter();

  const handleVoiceComplete = (
    data: VoicePatientData,
    sessionId: string,
    transcriptId: string
  ) => {
    // Store the data and IDs in sessionStorage for the form page to pick up
    sessionStorage.setItem('voicePatientData', JSON.stringify({
      data,
      sessionId,
      transcriptId,
    }));

    // Navigate to the new patient form
    router.push('/dashboard/medical-records/patients/new?voice=true');
  };

  return (
    <div className="flex items-center gap-3">
      {/* Manual Entry Button */}
      <Link
        href="/dashboard/medical-records/patients/new"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Nuevo Paciente
      </Link>

      {/* Voice Entry Button */}
      <VoiceButton
        sessionType="NEW_PATIENT"
        onComplete={handleVoiceComplete}
        variant="outline"
      />
    </div>
  );
}

// =============================================================================
// EXAMPLE 2: Patient Profile Page - New Encounter
// =============================================================================

/**
 * Shows voice button on patient profile for new encounters
 */
function PatientProfileActionsExample({ patientId }: { patientId: string }) {
  const router = useRouter();

  const handleVoiceComplete = (
    data: VoiceEncounterData,
    sessionId: string,
    transcriptId: string
  ) => {
    sessionStorage.setItem('voiceEncounterData', JSON.stringify({
      data,
      sessionId,
      transcriptId,
    }));

    router.push(`/dashboard/medical-records/patients/${patientId}/encounters/new?voice=true`);
  };

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/dashboard/medical-records/patients/${patientId}/encounters/new`}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Nueva Consulta
      </Link>

      <VoiceButton
        sessionType="NEW_ENCOUNTER"
        context={{ patientId }}
        onComplete={handleVoiceComplete}
        variant="outline"
      />
    </div>
  );
}

// =============================================================================
// EXAMPLE 3: Form Page with Voice Pre-fill
// =============================================================================

/**
 * Shows how to handle voice data in a form page
 */
function NewPatientFormPageExample() {
  const [showAIBanner, setShowAIBanner] = useState(false);
  const [aiMetadata, setAIMetadata] = useState<{
    sessionId: string;
    transcriptId: string;
    confidence: 'high' | 'medium' | 'low';
    fieldsExtracted: string[];
    fieldsEmpty: string[];
  } | null>(null);

  // Form state - would normally come from useState or react-hook-form
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    // ... other fields
  });

  // Check for voice data on mount
  // useEffect(() => {
  //   const searchParams = new URLSearchParams(window.location.search);
  //   if (searchParams.get('voice') === 'true') {
  //     const stored = sessionStorage.getItem('voicePatientData');
  //     if (stored) {
  //       const { data, sessionId, transcriptId } = JSON.parse(stored);
  //
  //       // Pre-fill form with voice data
  //       setFormData(prev => ({
  //         ...prev,
  //         firstName: data.firstName || prev.firstName,
  //         lastName: data.lastName || prev.lastName,
  //         dateOfBirth: data.dateOfBirth || prev.dateOfBirth,
  //         // ... map other fields
  //       }));
  //
  //       // Show AI banner
  //       setShowAIBanner(true);
  //       setAIMetadata({
  //         sessionId,
  //         transcriptId,
  //         confidence: 'high', // Would come from structure response
  //         fieldsExtracted: Object.keys(data).filter(k => data[k] != null),
  //         fieldsEmpty: [],
  //       });
  //
  //       // Clear storage
  //       sessionStorage.removeItem('voicePatientData');
  //     }
  //   }
  // }, []);

  return (
    <div>
      {/* AI Draft Banner */}
      {showAIBanner && aiMetadata && (
        <AIDraftBanner
          confidence={aiMetadata.confidence}
          fieldsExtracted={aiMetadata.fieldsExtracted}
          fieldsEmpty={aiMetadata.fieldsEmpty}
          onDismiss={() => setShowAIBanner(false)}
        />
      )}

      {/* Form would go here */}
      <form>
        {/* ... form fields ... */}
      </form>
    </div>
  );
}

// =============================================================================
// EXAMPLE 4: Utility function to map voice data to form
// =============================================================================

/**
 * Maps VoicePatientData to PatientFormData
 * Handles null values by converting to empty strings for form inputs
 */
function mapVoiceToPatientForm(voiceData: VoicePatientData) {
  return {
    internalId: voiceData.internalId || '',
    firstName: voiceData.firstName || '',
    lastName: voiceData.lastName || '',
    dateOfBirth: voiceData.dateOfBirth || '',
    sex: voiceData.sex || 'male',
    bloodType: voiceData.bloodType || '',
    phone: voiceData.phone || '',
    email: voiceData.email || '',
    address: voiceData.address || '',
    city: voiceData.city || '',
    state: voiceData.state || '',
    postalCode: voiceData.postalCode || '',
    emergencyContactName: voiceData.emergencyContactName || '',
    emergencyContactPhone: voiceData.emergencyContactPhone || '',
    emergencyContactRelation: voiceData.emergencyContactRelation || '',
    currentAllergies: voiceData.currentAllergies || '',
    currentChronicConditions: voiceData.currentChronicConditions || '',
    currentMedications: voiceData.currentMedications || '',
    generalNotes: voiceData.generalNotes || '',
    tags: voiceData.tags?.join(', ') || '',
  };
}

/**
 * Maps VoiceEncounterData to EncounterFormData
 */
function mapVoiceToEncounterForm(voiceData: VoiceEncounterData) {
  return {
    encounterDate: voiceData.encounterDate || new Date().toISOString().split('T')[0],
    encounterType: voiceData.encounterType || 'consultation',
    chiefComplaint: voiceData.chiefComplaint || '',
    location: voiceData.location || '',
    status: voiceData.status || 'draft',
    vitalsBloodPressure: voiceData.vitalsBloodPressure || '',
    vitalsHeartRate: voiceData.vitalsHeartRate,
    vitalsTemperature: voiceData.vitalsTemperature,
    vitalsWeight: voiceData.vitalsWeight,
    vitalsHeight: voiceData.vitalsHeight,
    vitalsOxygenSat: voiceData.vitalsOxygenSat,
    vitalsOther: voiceData.vitalsOther || '',
    clinicalNotes: voiceData.clinicalNotes || '',
    subjective: voiceData.subjective || '',
    objective: voiceData.objective || '',
    assessment: voiceData.assessment || '',
    plan: voiceData.plan || '',
    followUpDate: voiceData.followUpDate || '',
    followUpNotes: voiceData.followUpNotes || '',
  };
}

/**
 * Maps VoicePrescriptionData to prescription form state
 */
function mapVoiceToPrescriptionForm(voiceData: VoicePrescriptionData) {
  return {
    prescriptionDate: voiceData.prescriptionDate || new Date().toISOString().split('T')[0],
    expiresAt: voiceData.expiresAt || '',
    diagnosis: voiceData.diagnosis || '',
    clinicalNotes: voiceData.clinicalNotes || '',
    doctorFullName: voiceData.doctorFullName || '',
    doctorLicense: voiceData.doctorLicense || '',
    medications: voiceData.medications?.map((med, index) => ({
      drugName: med.drugName,
      presentation: med.presentation || '',
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration || '',
      quantity: med.quantity || '',
      instructions: med.instructions,
      warnings: med.warnings || '',
      order: index,
    })) || [
      {
        drugName: '',
        dosage: '',
        frequency: '',
        instructions: '',
        order: 0,
      }
    ],
  };
}

// Export for reference (these would be in separate files in real usage)
export {
  PatientListHeaderExample,
  PatientProfileActionsExample,
  NewPatientFormPageExample,
  mapVoiceToPatientForm,
  mapVoiceToEncounterForm,
  mapVoiceToPrescriptionForm,
};
