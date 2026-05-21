import type { Encounter } from '@/components/medical-records/EncounterCard';

export interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  firstVisitDate?: string;
  lastVisitDate?: string;
  status: string;
  tags: string[];
  currentAllergies?: string;
  currentChronicConditions?: string;
  currentMedications?: string;
  bloodType?: string;
  generalNotes?: string;
  photoUrl?: string;
  requiereFactura?: boolean;
  rfc?: string | null;
  razonSocial?: string | null;
  regimenFiscal?: string | null;
  usoCfdi?: string | null;
  codigoPostalFiscal?: string | null;
  constanciaFiscalUrl?: string | null;
  constanciaFiscalName?: string | null;
  encounters: Encounter[];
}
