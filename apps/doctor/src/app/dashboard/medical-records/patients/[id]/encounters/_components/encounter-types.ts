export interface Encounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  location?: string;
  status: string;
  clinicalNotes?: string;
  // SOAP Notes
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  // Vitals
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
  // Follow-up
  followUpDate?: string;
  followUpNotes?: string;
  // Custom template
  templateId?: string;
  customData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    internalId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    sex: string;
  };
}

export interface Version {
  id: number;
  versionNumber: number;
  encounterData: any;
  createdBy: string;
  changeReason?: string;
  createdAt: string;
}

export function getEncounterTypeLabel(type: string): string {
  const types: Record<string, string> = {
    'consultation': 'Consulta',
    'follow-up': 'Seguimiento',
    'emergency': 'Emergencia',
    'telemedicine': 'Telemedicina',
  };
  return types[type] || type;
}
