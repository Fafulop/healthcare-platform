import type { Medication } from '@/components/medical-records/MedicationList';
import type { ImagingStudy, LabStudy } from '@/components/medical-records/StudyList';

export interface PrescriptionDetails {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string;
  clinicalNotes?: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt?: string;
  issuedAt?: string;
  issuedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    internalId: string;
    dateOfBirth: string;
    sex: string;
  };
  medications: Medication[];
  imagingStudies: ImagingStudy[];
  labStudies: LabStudy[];
  createdAt: string;
  updatedAt: string;
}

export function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  };
  return statusMap[status] || status;
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    issued: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

// Returns an error message string, or null if valid
export function validateMedications(medications: Medication[]): string | null {
  const validMedications = medications.filter((med) => med.drugName?.trim());

  if (validMedications.length === 0) {
    return 'Debe agregar al menos un medicamento válido';
  }

  const incomplete = validMedications.filter(
    (med) => !med.dosage?.trim() || !med.frequency?.trim() || !med.instructions?.trim()
  );

  if (incomplete.length > 0) {
    const names = incomplete.map((m) => m.drugName).join(', ');
    return `Los siguientes medicamentos requieren Dosis, Frecuencia e Indicaciones: ${names}`;
  }

  return null;
}
