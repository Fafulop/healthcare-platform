# Clinical AI Voice Assistant - Implementation Specification

## Overview

The Clinical AI Voice Assistant is an **assistive documentation system** that helps doctors create structured clinical records using **speech-to-text** and **AI-assisted structuring**. It integrates with the existing Medical Records module (`/dashboard/medical-records`).

**Version**: 1.0 (Mode A - Direct Editing)
**Language**: Spanish (es-MX) with medical terminology support

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Scope & Limitations](#scope--limitations)
3. [Technical Stack](#technical-stack)
4. [Supported Flows](#supported-flows)
5. [System Architecture](#system-architecture)
6. [User Flow (Mode A)](#user-flow-mode-a)
7. [API Design](#api-design)
8. [LLM Structuring Behavior](#llm-structuring-behavior)
9. [UI/UX Specifications](#uiux-specifications)
10. [Data Models](#data-models)
11. [Audit & Traceability](#audit--traceability)
12. [Error Handling](#error-handling)
13. [Security & Privacy](#security--privacy)
14. [Future Enhancements (v2)](#future-enhancements-v2)

---

## Core Principles

These principles are **non-negotiable** and must guide all implementation decisions:

| Principle | Description |
|-----------|-------------|
| **Explicit Intent First** | The system must know *what* the doctor is creating before processing speech. Intent is determined by UI trigger, never inferred from speech. |
| **No Free Chat** | The assistant is not a conversational chatbot. All interactions are task-scoped and contextual. |
| **Draft-Only Output** | AI-generated content is never persisted automatically. All outputs are editable drafts. |
| **Doctor-in-the-Loop** | All outputs must be reviewed and approved by the doctor before saving. |
| **No Hallucination Rule** | If information is not clearly present in the dictation, the field must be left empty (`null`). Never invent or assume data. |

---

## Scope & Limitations

### In Scope (v1 - Mode A)

- **Two input methods** (doctor's choice):
  1. **Manual entry** - Traditional form typing (existing functionality, unchanged)
  2. **Voice entry** - Dictate and let AI structure (new feature)
- Voice recording in browser
- Speech-to-text transcription via OpenAI Whisper
- AI structuring of transcripts into form-compatible JSON
- Pre-filling existing forms with structured data
- Manual editing of pre-filled forms
- Standard form submission with AI metadata

> **Important**: Voice entry is an **optional enhancement**, not a replacement.
> All existing manual forms remain fully functional. Doctors choose their preferred input method.

### Explicitly Out of Scope

| Feature | Reason |
|---------|--------|
| AI-mediated editing (Mode B) | Deferred to v2 - adds significant complexity |
| Free-form conversation | Against core principles |
| Diagnostic suggestions | System is for documentation, not clinical decisions |
| Auto-save | All saves require explicit doctor approval |
| Editing existing records via voice | v1 supports creation only |
| Real-time transcription | v1 uses record-then-process model |

---

## Technical Stack

### Speech-to-Text
- **Provider**: OpenAI Whisper API
- **Model**: `whisper-1`
- **Language**: Spanish (`es`)
- **Format**: Audio recorded as WebM/Opus or MP3

### LLM Structuring
- **Provider**: OpenAI or Anthropic Claude
- **Task**: Convert transcript → structured JSON matching form schema
- **Temperature**: 0 (deterministic output)

### Frontend
- **Recording**: MediaRecorder API (browser-native)
- **State Management**: React useState/useReducer for session state
- **UI**: Existing component library (Tailwind + shadcn/ui patterns)

### Backend
- **Framework**: Next.js API Routes (existing)
- **Authentication**: NextAuth.js (existing)

---

## Supported Flows

The assistant supports **exactly three** creation flows:

### 1. New Patient (`NEW_PATIENT`)

**Entry Point**: Button on Patient List page or Patient Profile
**Target Form**: `/dashboard/medical-records/patients/new`

**Extractable Fields**:
- Identification: firstName, lastName, dateOfBirth, sex, bloodType
- Contact: phone, email, address, city, state, postalCode
- Emergency Contact: name, phone, relation
- Medical Info: allergies, chronicConditions, currentMedications, generalNotes, tags

---

### 2. New Encounter (`NEW_ENCOUNTER`)

**Entry Point**: Button on Patient Profile page
**Target Form**: `/dashboard/medical-records/patients/[id]/encounters/new`
**Requires**: Patient context (patientId)

**Extractable Fields**:
- Basic Info: encounterDate, encounterType, chiefComplaint, location, status
- Vitals: bloodPressure, heartRate, temperature, weight, height, oxygenSaturation, otherVitals
- Clinical Notes: clinicalNotes OR (subjective, objective, assessment, plan)
- Follow-up: followUpDate, followUpNotes

---

### 3. New Prescription (`NEW_PRESCRIPTION`)

**Entry Point**: Button on Patient Prescriptions page
**Target Form**: `/dashboard/medical-records/patients/[id]/prescriptions/new`
**Requires**: Patient context (patientId)

**Extractable Fields**:
- General: prescriptionDate, expirationDate, diagnosis, clinicalNotes
- Doctor Info: doctorFullName, doctorLicense (may be pre-filled from session)
- Medications (array):
  - drugName, presentation, dosage, frequency, duration, quantity, instructions, warnings

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ Voice Button │───▶│ Recording UI │───▶│ Processing Indicator │  │
│  │ (per flow)   │    │ (Modal)      │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                   │                  │
│                                                   ▼                  │
│                                          ┌──────────────┐           │
│                                          │ Pre-filled   │           │
│                                          │ Form (Draft) │           │
│                                          └──────────────┘           │
│                                                   │                  │
│                                                   ▼                  │
│                                          ┌──────────────┐           │
│                                          │ Manual Edit  │           │
│                                          │ + Save       │           │
│                                          └──────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND API                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────┐           │
│  │ POST                │         │ POST                │           │
│  │ /api/voice/transcribe│        │ /api/voice/structure │           │
│  │                     │         │                     │           │
│  │ Input: audio file   │         │ Input: transcript,  │           │
│  │ Output: transcript  │────────▶│        sessionType  │           │
│  │                     │         │ Output: structured  │           │
│  └─────────────────────┘         │         JSON        │           │
│           │                      └─────────────────────┘           │
│           ▼                                 │                       │
│  ┌─────────────────────┐                   │                       │
│  │ OpenAI Whisper API  │                   ▼                       │
│  └─────────────────────┘         ┌─────────────────────┐           │
│                                  │ LLM (Claude/GPT)    │           │
│                                  │ + System Prompt     │           │
│                                  │ + Schema            │           │
│                                  └─────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Flow (Mode A)

### Step-by-Step Flow

```
1. TRIGGER
   └── Doctor clicks "🎙️ Nueva Consulta (Voz)" button
   └── System creates session: { type: "NEW_ENCOUNTER", patientId: "xxx" }

2. REFERENCE GUIDE
   └── Modal displays list of information that can be dictated
   └── Non-interactive, informational only
   └── Doctor clicks "Comenzar Grabación"

3. RECORDING
   └── Browser requests microphone permission (if not granted)
   └── Recording indicator shown (pulsing red dot)
   └── Doctor dictates naturally in Spanish
   └── Doctor clicks "Detener Grabación"

4. PROCESSING
   └── Loading state: "Transcribiendo audio..."
   └── API call: POST /api/voice/transcribe
   └── Loading state: "Estructurando información..."
   └── API call: POST /api/voice/structure
   └── Receives structured JSON

5. DRAFT DISPLAY
   └── Modal closes OR transitions to form
   └── Form is pre-filled with structured data
   └── Visual indicator: "Borrador generado por IA"
   └── All fields are editable

6. MANUAL EDITING
   └── Doctor reviews and edits fields as needed
   └── Standard form validation applies

7. SAVE
   └── Doctor clicks "Guardar" / "Crear Consulta"
   └── Confirmation: "Este registro fue creado con asistencia de IA"
   └── Record saved with AI metadata
```

### State Machine

```
IDLE → READY → RECORDING → TRANSCRIBING → STRUCTURING → DRAFT_READY → EDITING → SAVED
                                ↓               ↓
                              ERROR           ERROR
```

---

## API Design

### POST `/api/voice/transcribe`

**Purpose**: Convert audio to text using OpenAI Whisper

**Request**:
```typescript
// multipart/form-data
{
  audio: File,           // Audio file (webm, mp3, wav, m4a)
  language?: string      // Default: "es"
}
```

**Response**:
```typescript
{
  success: boolean,
  data: {
    transcript: string,
    transcriptId: string,    // UUID for audit trail
    duration: number,        // Audio duration in seconds
    language: string
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: {
    code: "TRANSCRIPTION_FAILED" | "INVALID_AUDIO" | "AUDIO_TOO_LONG",
    message: string
  }
}
```

---

### POST `/api/voice/structure`

**Purpose**: Convert transcript to structured form data using LLM

**Request**:
```typescript
{
  transcript: string,
  transcriptId: string,
  sessionType: "NEW_PATIENT" | "NEW_ENCOUNTER" | "NEW_PRESCRIPTION",
  context?: {
    patientId?: string,
    doctorId?: string,
    doctorName?: string,
    doctorLicense?: string
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  data: {
    sessionId: string,           // UUID for audit trail
    structuredData: object,      // Schema depends on sessionType
    fieldsExtracted: string[],   // List of fields that were populated
    fieldsEmpty: string[],       // List of fields left null
    confidence: "high" | "medium" | "low"
  }
}
```

---

## LLM Structuring Behavior

### System Prompt Core Rules

The LLM must follow these rules strictly:

1. **Extract only explicit information** - Only include data that is clearly stated or directly implied in the transcript
2. **Use null for missing fields** - Never invent, assume, or hallucinate data
3. **Map to schema exactly** - Output must match the provided JSON schema
4. **Normalize data** - Dates to ISO format, vitals to standard units
5. **Preserve medical terminology** - Do not translate or simplify clinical terms
6. **No clinical decisions** - Summarize and structure, do not diagnose or recommend

### Field Extraction Examples

**Transcript**:
> "Paciente masculino de 45 años que acude por dolor abdominal de tres días de evolución, localizado en fosa ilíaca derecha. Signos vitales: presión arterial 120/80, frecuencia cardíaca 88, temperatura 38.2. A la exploración física abdomen blando, depresible, con dolor a la palpación en cuadrante inferior derecho, signo de McBurney positivo."

**Extracted** (NEW_ENCOUNTER):
```json
{
  "encounterDate": null,
  "encounterType": "consultation",
  "chiefComplaint": "Dolor abdominal de tres días de evolución, localizado en fosa ilíaca derecha",
  "vitalsBloodPressure": "120/80",
  "vitalsHeartRate": 88,
  "vitalsTemperature": 38.2,
  "subjective": "Paciente masculino de 45 años que acude por dolor abdominal de tres días de evolución, localizado en fosa ilíaca derecha.",
  "objective": "Abdomen blando, depresible, con dolor a la palpación en cuadrante inferior derecho, signo de McBurney positivo.",
  "assessment": null,
  "plan": null,
  "followUpDate": null,
  "followUpNotes": null
}
```

**Note**: `encounterDate`, `assessment`, and `plan` are `null` because they were not mentioned in the transcript.

---

## UI/UX Specifications

### Input Method Options

Doctors will see **two buttons** for each creation flow:

| Flow | Manual Button | Voice Button |
|------|---------------|--------------|
| NEW_PATIENT | "Nuevo Paciente" | "🎙️ Nuevo Paciente (Voz)" |
| NEW_ENCOUNTER | "Nueva Consulta" | "🎙️ Nueva Consulta (Voz)" |
| NEW_PRESCRIPTION | "Nueva Prescripción" | "🎙️ Nueva Prescripción (Voz)" |

**Behavior**:
- **Manual button** → Opens empty form (existing behavior, unchanged)
- **Voice button** → Opens recording modal → Pre-fills form with AI-structured data

Both paths lead to the same form - the only difference is whether fields are pre-populated.

### Voice Button Placement

| Flow | Location | Buttons |
|------|----------|---------|
| NEW_PATIENT | Patient List page header | Manual + Voice side by side |
| NEW_ENCOUNTER | Patient Profile action buttons | Manual + Voice side by side |
| NEW_PRESCRIPTION | Prescriptions list header | Manual + Voice side by side |

### Recording Modal

```
┌─────────────────────────────────────────────────┐
│  🎙️ Nueva Consulta (Voz)                    ✕  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Información que puede dictar:                  │
│                                                 │
│  • Fecha y tipo de consulta                     │
│  • Motivo de consulta                           │
│  • Signos vitales                               │
│  • Notas clínicas o formato SOAP                │
│  • Información de seguimiento                   │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│              🔴 0:00:32                         │
│           [ Grabando... ]                       │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │         ⏹️ Detener Grabación            │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [ Cancelar ]                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Processing States

| State | Display |
|-------|---------|
| TRANSCRIBING | Spinner + "Transcribiendo audio..." |
| STRUCTURING | Spinner + "Estructurando información..." |
| ERROR | Red alert + error message + "Reintentar" button |

### Draft Indicator

When form is pre-filled by AI, display banner:

```
┌─────────────────────────────────────────────────┐
│ 🤖 Borrador generado por IA                     │
│ Revise y edite la información antes de guardar  │
└─────────────────────────────────────────────────┘
```

---

## Data Models

### VoiceSession

```typescript
interface VoiceSession {
  id: string;                    // UUID
  type: "NEW_PATIENT" | "NEW_ENCOUNTER" | "NEW_PRESCRIPTION";
  status: "recording" | "transcribing" | "structuring" | "ready" | "error" | "completed";

  // Context
  doctorId: string;
  patientId?: string;            // Required for encounters and prescriptions

  // Audio
  audioUrl?: string;             // Stored audio file URL (optional, for audit)
  audioDuration?: number;

  // Transcript
  transcriptId?: string;
  transcript?: string;

  // Structured Output
  structuredData?: object;
  fieldsExtracted?: string[];
  fieldsEmpty?: string[];

  // Timestamps
  createdAt: Date;
  completedAt?: Date;

  // Error
  errorCode?: string;
  errorMessage?: string;
}
```

### AI Metadata (stored with records)

```typescript
interface AIGeneratedMetadata {
  aiGenerated: true;
  aiReviewedByDoctor: true;      // Set when doctor saves
  aiSessionId: string;           // Links to VoiceSession
  sourceTranscriptId: string;    // Links to original transcript
  aiGeneratedAt: Date;
  aiReviewedAt: Date;
}
```

---

## Audit & Traceability

Every AI-assisted record must include:

| Field | Type | Description |
|-------|------|-------------|
| `aiGenerated` | boolean | Always `true` for voice-created records |
| `aiReviewedByDoctor` | boolean | Set to `true` when doctor saves |
| `aiSessionId` | string | UUID linking to the voice session |
| `sourceTranscriptId` | string | UUID linking to the transcript |

This metadata is:
- Automatically added on save
- Non-editable by users
- Queryable for compliance reporting

---

## Error Handling

### Error Types

| Code | Cause | User Message |
|------|-------|--------------|
| `MIC_PERMISSION_DENIED` | Browser mic access denied | "Permiso de micrófono denegado. Habilítelo en la configuración del navegador." |
| `RECORDING_FAILED` | MediaRecorder error | "Error al grabar audio. Intente nuevamente." |
| `AUDIO_TOO_SHORT` | Recording < 3 seconds | "La grabación es muy corta. Intente nuevamente." |
| `AUDIO_TOO_LONG` | Recording > 10 minutes | "La grabación excede el límite de 10 minutos." |
| `TRANSCRIPTION_FAILED` | Whisper API error | "Error al transcribir el audio. Intente nuevamente." |
| `STRUCTURING_FAILED` | LLM error | "Error al procesar la información. Intente nuevamente." |
| `NETWORK_ERROR` | Connection failed | "Error de conexión. Verifique su internet e intente nuevamente." |

### Recovery

- All errors show a "Reintentar" (Retry) button
- Audio is preserved in memory for retry (not re-recorded)
- User can cancel and fall back to manual form entry

---

## Security & Privacy

### Data Handling

| Data | Storage | Retention |
|------|---------|-----------|
| Raw audio | Not stored by default | Deleted after processing |
| Transcript | Stored with session | Retained for audit trail |
| Structured data | Merged into medical record | Standard record retention |

### API Security

- All endpoints require authentication (NextAuth session)
- Rate limiting: 10 voice sessions per doctor per hour
- Audio size limit: 25MB
- Audio duration limit: 10 minutes

### Compliance Considerations

- Audio is sent to OpenAI Whisper API (external service)
- Transcripts are sent to LLM API (external service)
- For strict data residency requirements, consider:
  - Self-hosted Whisper
  - On-premise LLM
  - Anonymization layer

---

## Future Enhancements (v2)

### Mode B: AI-Mediated Editing

Allow doctors to refine drafts via voice/text instructions:
- "Agrega que el dolor irradia a fosa ilíaca derecha"
- "Cambia el diagnóstico a gastritis aguda"

Requires:
- Delta generation (diff, not full rewrite)
- Change preview UI
- Explicit approval flow

### Additional Features

| Feature | Description |
|---------|-------------|
| Regenerate | Re-process same transcript with different prompt |
| Templates | Pre-defined prompts for common encounter types |
| Real-time transcription | Show transcript as doctor speaks |
| Voice commands | "Guardar", "Cancelar", "Siguiente campo" |
| Multi-language | Support for English, Portuguese |

---

## Implementation Checklist

### Phase 1: Foundation ✅
- [x] Create voice recording hook (`useVoiceRecording`)
- [x] Create voice session hook (`useVoiceSession`)
- [x] Create API route `/api/voice/transcribe`
- [x] Create API route `/api/voice/structure`
- [x] Define JSON schemas for all three flows
- [x] Create LLM system prompts

### Phase 2: UI Components ✅
- [x] Create `VoiceRecordingModal` component
- [x] Create `VoiceButton` component
- [x] Create `AIDraftBanner` component
- [x] Create integration examples

### Phase 3: Integration (TODO)
- [ ] Integrate with PatientForm
- [ ] Integrate with EncounterForm
- [ ] Integrate with PrescriptionForm
- [ ] Add AI metadata to save handlers

### Phase 4: Polish (TODO)
- [ ] Error handling and recovery
- [ ] Loading states and animations
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Mobile responsiveness

---

*Document Version: 1.0*
*Last Updated: 2026-01-19*
*Status: Implementation Specification*
