/**
 * Clinical AI Voice Assistant - Type Definitions
 *
 * This file contains all TypeScript interfaces for the voice assistant feature.
 * These types define the structure of data extracted by the LLM from voice transcripts.
 *
 * IMPORTANT: All fields are optional/nullable because the LLM may not
 * extract all information from every dictation. The "No Hallucination Rule"
 * requires leaving fields empty rather than inventing data.
 */

// =============================================================================
// INPUT METHOD
// =============================================================================

/**
 * How the doctor chose to enter data.
 * - 'manual': Traditional form typing (no AI involvement)
 * - 'voice': Voice dictation with AI structuring
 *
 * Both methods lead to the same form - voice just pre-fills it.
 */
export type InputMethod = 'manual' | 'voice';

// =============================================================================
// SESSION TYPES
// =============================================================================

/**
 * The five supported voice session types.
 * Each type determines which schema is used for structuring.
 */
export type VoiceSessionType = 'NEW_PATIENT' | 'NEW_ENCOUNTER' | 'NEW_PRESCRIPTION' | 'CREATE_APPOINTMENT_SLOTS' | 'CREATE_LEDGER_ENTRY';

/**
 * Voice session status progression:
 * idle -> ready -> recording -> transcribing -> structuring -> ready -> completed
 *                                    |               |
 *                                  error           error
 */
export type VoiceSessionStatus =
  | 'idle'
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'structuring'
  | 'draft_ready'
  | 'completed'
  | 'error';

// =============================================================================
// NEW_PATIENT SCHEMA
// =============================================================================

/**
 * Schema for patient data extracted from voice dictation.
 * Maps directly to PatientFormData in PatientForm.tsx
 *
 * All fields are optional - the LLM will only populate fields
 * that are explicitly mentioned in the transcript.
 */
export interface VoicePatientData {
  // Identification
  internalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null; // ISO date string (YYYY-MM-DD)
  sex?: 'male' | 'female' | 'other' | null;
  bloodType?: string | null;

  // Contact Information
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;

  // Emergency Contact
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;

  // Medical Information
  currentAllergies?: string | null;
  currentChronicConditions?: string | null;
  currentMedications?: string | null;
  generalNotes?: string | null;
  tags?: string[] | null;
}


// =============================================================================
// NEW_ENCOUNTER SCHEMA
// =============================================================================

/**
 * Encounter types supported by the system.
 */
export type EncounterType = 'consultation' | 'follow-up' | 'emergency' | 'telemedicine';

/**
 * Encounter status values.
 */
export type EncounterStatus = 'draft' | 'completed';

/**
 * Schema for encounter data extracted from voice dictation.
 * Maps directly to EncounterFormData in EncounterForm.tsx
 *
 * Supports both simple clinical notes and SOAP format.
 * The LLM should detect which format is being used based on the dictation.
 */
export interface VoiceEncounterData {
  // Basic Information
  encounterDate?: string | null; // ISO date string (YYYY-MM-DD)
  encounterType?: EncounterType | null;
  chiefComplaint?: string | null;
  location?: string | null;
  status?: EncounterStatus | null;

  // Vital Signs
  vitalsBloodPressure?: string | null; // Format: "120/80"
  vitalsHeartRate?: number | null; // beats per minute
  vitalsTemperature?: number | null; // Celsius
  vitalsWeight?: number | null; // kg
  vitalsHeight?: number | null; // cm
  vitalsOxygenSat?: number | null; // percentage (0-100)
  vitalsOther?: string | null;

  // Clinical Documentation (Simple Notes)
  clinicalNotes?: string | null;

  // Clinical Documentation (SOAP Format)
  // If SOAP fields are populated, they take precedence over clinicalNotes
  subjective?: string | null; // Patient's subjective experience
  objective?: string | null; // Objective findings from examination
  assessment?: string | null; // Assessment/diagnosis
  plan?: string | null; // Treatment plan

  // Follow-up
  followUpDate?: string | null; // ISO date string (YYYY-MM-DD)
  followUpNotes?: string | null;
}


// =============================================================================
// NEW_PRESCRIPTION SCHEMA
// =============================================================================

/**
 * Schema for a single medication extracted from voice dictation.
 * Maps directly to Medication interface in MedicationList.tsx
 */
export interface VoiceMedicationData {
  drugName: string; // Required - medication name
  presentation?: string | null; // e.g., "Tableta", "Jarabe", "Inyección"
  dosage: string; // Required - e.g., "500mg", "10ml"
  frequency: string; // Required - e.g., "Cada 8 horas"
  duration?: string | null; // e.g., "7 días", "2 semanas"
  quantity?: string | null; // e.g., "21 tabletas", "1 frasco"
  instructions: string; // Required - e.g., "Tomar con alimentos"
  warnings?: string | null; // e.g., "No conducir"
  order?: number | null;
}


/**
 * Schema for prescription data extracted from voice dictation.
 * Maps to the prescription form in prescriptions/new/page.tsx
 */
export interface VoicePrescriptionData {
  // General Information
  prescriptionDate?: string | null; // ISO date string (YYYY-MM-DD)
  expiresAt?: string | null; // ISO date string (YYYY-MM-DD)
  diagnosis?: string | null;
  clinicalNotes?: string | null;

  // Doctor Information (may be pre-filled from session)
  doctorFullName?: string | null;
  doctorLicense?: string | null;

  // Medications
  medications?: VoiceMedicationData[] | null;
}


// =============================================================================
// CREATE_APPOINTMENT_SLOTS SCHEMA
// =============================================================================

/**
 * Schema for appointment slot creation extracted from voice dictation.
 * Maps to the CreateSlotsModal form (recurring mode only).
 *
 * All fields are optional - the LLM will only populate fields
 * that are explicitly mentioned in the transcript.
 */
export interface VoiceAppointmentSlotsData {
  // Date Range (recurring mode only)
  startDate?: string | null; // ISO date string (YYYY-MM-DD)
  endDate?: string | null; // ISO date string (YYYY-MM-DD)

  // Days of Week Selection
  // 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
  daysOfWeek?: number[] | null;

  // Time Configuration
  startTime?: string | null; // HH:mm format (e.g., "09:00")
  endTime?: string | null; // HH:mm format (e.g., "17:00")
  duration?: 30 | 60 | null; // Duration in minutes (30 or 60)

  // Break Time (optional)
  breakStart?: string | null; // HH:mm format (e.g., "12:00")
  breakEnd?: string | null; // HH:mm format (e.g., "13:00")

  // Pricing
  basePrice?: number | null; // Price in MXN
  discount?: number | null; // Discount value
  discountType?: 'PERCENTAGE' | 'FIXED' | null; // Discount type
}


// =============================================================================
// CREATE_LEDGER_ENTRY SCHEMA
// =============================================================================

/**
 * Schema for ledger entry (cash flow movement) extracted from voice dictation.
 * Maps to the ledger entry form in flujo-de-dinero/new/page.tsx
 *
 * All fields are optional - the LLM will only populate fields
 * that are explicitly mentioned in the transcript.
 *
 * Note: Complex conditional logic exists in the form:
 * - transactionType is N/A for simple entries, COMPRA/VENTA for purchases/sales
 * - clientId is only relevant for VENTA
 * - supplierId is only relevant for COMPRA
 * - paymentStatus/amountPaid are only relevant for COMPRA/VENTA
 */
export interface VoiceLedgerEntryData {
  // Basic Information
  entryType?: 'ingreso' | 'egreso' | null; // Income or expense
  amount?: number | null; // Amount in MXN
  transactionDate?: string | null; // ISO date string (YYYY-MM-DD)
  concept?: string | null; // Transaction description

  // Transaction Details (conditional based on entryType)
  transactionType?: 'N/A' | 'COMPRA' | 'VENTA' | null;
  clientId?: string | null; // UUID - only for VENTA transactions
  supplierId?: string | null; // UUID - only for COMPRA transactions
  paymentStatus?: 'PENDING' | 'PARTIAL' | 'PAID' | null; // Only for COMPRA/VENTA
  amountPaid?: number | null; // Only for COMPRA/VENTA

  // Categorization
  area?: string | null; // Category area (filtered by entryType)
  subarea?: string | null; // Sub-category (filtered by area)

  // Payment Details
  bankAccount?: string | null; // Bank account identifier
  formaDePago?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'deposito' | null;
  bankMovementId?: string | null; // Bank transaction reference
}

/**
 * Schema for batch ledger entries extracted from voice dictation.
 * Used when multiple entries are detected in a single voice recording.
 */
export interface VoiceLedgerEntryBatch {
  isBatch: true; // Flag to distinguish from single entry
  entries: VoiceLedgerEntryData[]; // Array of ledger entries
  totalCount: number; // Number of entries detected
}


// =============================================================================
// VOICE SESSION
// =============================================================================

/**
 * Context information passed to the structuring API.
 * Used to pre-fill certain fields and provide context to the LLM.
 */
export interface VoiceSessionContext {
  patientId?: string;
  doctorId?: string;
  doctorName?: string;
  doctorLicense?: string;
}

/**
 * Complete voice session state.
 * Used to track the entire lifecycle of a voice-to-form flow.
 */
export interface VoiceSession {
  id: string;
  type: VoiceSessionType;
  status: VoiceSessionStatus;

  // Context
  doctorId: string;
  patientId?: string;
  context?: VoiceSessionContext;

  // Audio
  audioBlob?: Blob;
  audioDuration?: number;

  // Transcript
  transcriptId?: string;
  transcript?: string;

  // Structured Output (union type based on session type)
  structuredData?: VoicePatientData | VoiceEncounterData | VoicePrescriptionData | VoiceAppointmentSlotsData | VoiceLedgerEntryData;
  fieldsExtracted?: string[];
  fieldsEmpty?: string[];
  confidence?: 'high' | 'medium' | 'low';

  // Timestamps
  createdAt: Date;
  completedAt?: Date;

  // Error
  errorCode?: string;
  errorMessage?: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Request body for POST /api/voice/transcribe
 */
export interface TranscribeRequest {
  // Audio file sent as FormData, not in JSON body
  language?: string; // Default: "es"
}

/**
 * Response from POST /api/voice/transcribe
 */
export interface TranscribeResponse {
  success: boolean;
  data?: {
    transcript: string;
    transcriptId: string;
    duration: number;
    language: string;
  };
  error?: {
    code: 'TRANSCRIPTION_FAILED' | 'INVALID_AUDIO' | 'AUDIO_TOO_LONG' | 'AUDIO_TOO_SHORT';
    message: string;
  };
}

/**
 * Request body for POST /api/voice/structure
 */
export interface StructureRequest {
  transcript: string;
  transcriptId: string;
  sessionType: VoiceSessionType;
  context?: VoiceSessionContext;
}

/**
 * Response from POST /api/voice/structure
 */
export interface StructureResponse {
  success: boolean;
  data?: {
    sessionId: string;
    structuredData: VoicePatientData | VoiceEncounterData | VoicePrescriptionData | VoiceAppointmentSlotsData | VoiceLedgerEntryData;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  error?: {
    code: 'STRUCTURING_FAILED' | 'INVALID_TRANSCRIPT' | 'INVALID_SESSION_TYPE';
    message: string;
  };
}

// =============================================================================
// AI METADATA (stored with records)
// =============================================================================

/**
 * Metadata added to records created with AI assistance.
 * This is stored alongside the record for audit purposes.
 */
export interface AIGeneratedMetadata {
  aiGenerated: true;
  aiReviewedByDoctor: boolean;
  aiSessionId: string;
  sourceTranscriptId: string;
  aiGeneratedAt: Date;
  aiReviewedAt?: Date;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Union type for all structured data outputs
 */
export type VoiceStructuredData = VoicePatientData | VoiceEncounterData | VoicePrescriptionData | VoiceAppointmentSlotsData | VoiceLedgerEntryData | VoiceLedgerEntryBatch;

/**
 * Map session type to its corresponding data type
 */
export type SessionTypeDataMap = {
  NEW_PATIENT: VoicePatientData;
  NEW_ENCOUNTER: VoiceEncounterData;
  NEW_PRESCRIPTION: VoicePrescriptionData;
  CREATE_APPOINTMENT_SLOTS: VoiceAppointmentSlotsData;
  CREATE_LEDGER_ENTRY: VoiceLedgerEntryData | VoiceLedgerEntryBatch; // Can be single or batch
};

/**
 * Helper type to get the data type for a given session type
 */
export type DataForSessionType<T extends VoiceSessionType> = SessionTypeDataMap[T];

/**
 * Fields that can be extracted for each session type (for UI display)
 */
export const EXTRACTABLE_FIELDS: Record<VoiceSessionType, string[]> = {
  NEW_PATIENT: [
    'firstName',
    'lastName',
    'dateOfBirth',
    'sex',
    'bloodType',
    'phone',
    'email',
    'address',
    'city',
    'state',
    'postalCode',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactRelation',
    'currentAllergies',
    'currentChronicConditions',
    'currentMedications',
    'generalNotes',
    'tags',
  ],
  NEW_ENCOUNTER: [
    'encounterDate',
    'encounterType',
    'chiefComplaint',
    'location',
    'status',
    'vitalsBloodPressure',
    'vitalsHeartRate',
    'vitalsTemperature',
    'vitalsWeight',
    'vitalsHeight',
    'vitalsOxygenSat',
    'vitalsOther',
    'clinicalNotes',
    'subjective',
    'objective',
    'assessment',
    'plan',
    'followUpDate',
    'followUpNotes',
  ],
  NEW_PRESCRIPTION: [
    'prescriptionDate',
    'expiresAt',
    'diagnosis',
    'clinicalNotes',
    'doctorFullName',
    'doctorLicense',
    'medications',
  ],
  CREATE_APPOINTMENT_SLOTS: [
    'startDate',
    'endDate',
    'daysOfWeek',
    'startTime',
    'endTime',
    'duration',
    'breakStart',
    'breakEnd',
    'basePrice',
    'discount',
    'discountType',
  ],
  CREATE_LEDGER_ENTRY: [
    'entryType',
    'amount',
    'transactionDate',
    'concept',
    'transactionType',
    'clientId',
    'supplierId',
    'paymentStatus',
    'amountPaid',
    'area',
    'subarea',
    'bankAccount',
    'formaDePago',
    'bankMovementId',
  ],
};

// =============================================================================
// CHAT SESSION TYPES (for chat-based sidebar)
// =============================================================================

/**
 * Role of a chat message participant
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Status of a chat message
 */
export type ChatMessageStatus = 'sending' | 'sent' | 'error';

/**
 * A single message in the chat conversation
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  status: ChatMessageStatus;

  // For assistant messages - structured data extracted
  structuredData?: VoiceStructuredData | null;
  fieldsExtracted?: string[];

  // For user messages - whether it was from voice
  isVoice?: boolean;
  audioDuration?: number;

  // Error info for failed messages
  errorMessage?: string;
}

/**
 * Status of the overall chat session
 */
export type ChatSessionStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'ready'
  | 'error';

/**
 * Complete chat session state
 */
export interface ChatSession {
  id: string;
  sessionType: VoiceSessionType;
  patientId?: string;
  doctorId: string;

  // Messages in the conversation
  messages: ChatMessage[];

  // Accumulated structured data from AI responses
  currentData: VoiceStructuredData | null;
  fieldsExtracted: string[];

  // Session state
  status: ChatSessionStatus;
  createdAt: Date;
  updatedAt: Date;

  // Error state
  errorMessage?: string;
}

/**
 * Request body for POST /api/voice/chat
 */
export interface ChatRequest {
  sessionType: VoiceSessionType;
  messages: Array<{
    role: ChatRole;
    content: string;
  }>;
  currentData?: VoiceStructuredData | null;
  context?: VoiceSessionContext;
}

/**
 * Response from POST /api/voice/chat
 */
export interface ChatResponse {
  success: boolean;
  data?: {
    message: string;
    structuredData: VoiceStructuredData | null;
    fieldsExtracted: string[];
    isComplete: boolean;
  };
  error?: {
    code: 'CHAT_FAILED' | 'INVALID_REQUEST' | 'RATE_LIMITED';
    message: string;
  };
}

/**
 * Spanish labels for fields (for UI display)
 */
export const FIELD_LABELS_ES: Record<string, string> = {
  // Patient fields
  firstName: 'Nombres',
  lastName: 'Apellidos',
  dateOfBirth: 'Fecha de Nacimiento',
  sex: 'Sexo',
  bloodType: 'Tipo de Sangre',
  phone: 'Teléfono',
  email: 'Email',
  address: 'Dirección',
  city: 'Ciudad',
  state: 'Estado',
  postalCode: 'Código Postal',
  emergencyContactName: 'Contacto de Emergencia - Nombre',
  emergencyContactPhone: 'Contacto de Emergencia - Teléfono',
  emergencyContactRelation: 'Contacto de Emergencia - Relación',
  currentAllergies: 'Alergias',
  currentChronicConditions: 'Condiciones Crónicas',
  currentMedications: 'Medicamentos Actuales',
  generalNotes: 'Notas Generales',
  tags: 'Etiquetas',

  // Encounter fields
  encounterDate: 'Fecha de Consulta',
  encounterType: 'Tipo de Consulta',
  chiefComplaint: 'Motivo de Consulta',
  location: 'Ubicación',
  status: 'Estado',
  vitalsBloodPressure: 'Presión Arterial',
  vitalsHeartRate: 'Frecuencia Cardíaca',
  vitalsTemperature: 'Temperatura',
  vitalsWeight: 'Peso',
  vitalsHeight: 'Altura',
  vitalsOxygenSat: 'Saturación de Oxígeno',
  vitalsOther: 'Otros Signos Vitales',
  clinicalNotes: 'Notas Clínicas',
  subjective: 'Subjetivo (S)',
  objective: 'Objetivo (O)',
  assessment: 'Evaluación (A)',
  plan: 'Plan (P)',
  followUpDate: 'Fecha de Seguimiento',
  followUpNotes: 'Notas de Seguimiento',

  // Prescription fields
  prescriptionDate: 'Fecha de Prescripción',
  expiresAt: 'Fecha de Expiración',
  diagnosis: 'Diagnóstico',
  doctorFullName: 'Nombre del Doctor',
  doctorLicense: 'Cédula Profesional',
  medications: 'Medicamentos',

  // Appointment Slots fields
  startDate: 'Fecha de Inicio',
  endDate: 'Fecha de Fin',
  daysOfWeek: 'Días de la Semana',
  startTime: 'Hora de Inicio',
  endTime: 'Hora de Fin',
  duration: 'Duración',
  breakStart: 'Inicio de Descanso',
  breakEnd: 'Fin de Descanso',
  basePrice: 'Precio Base',
  discount: 'Descuento',
  discountType: 'Tipo de Descuento',

  // Ledger Entry fields
  entryType: 'Tipo de Movimiento',
  amount: 'Monto',
  transactionDate: 'Fecha de Transacción',
  concept: 'Concepto',
  transactionType: 'Tipo de Transacción',
  clientId: 'Cliente',
  supplierId: 'Proveedor',
  paymentStatus: 'Estado de Pago',
  amountPaid: 'Monto Pagado',
  area: 'Área',
  subarea: 'Subárea',
  bankAccount: 'Cuenta Bancaria',
  formaDePago: 'Forma de Pago',
  bankMovementId: 'ID de Movimiento Bancario',
};
