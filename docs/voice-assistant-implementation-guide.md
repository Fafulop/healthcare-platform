# Voice Assistant Implementation Guide

> Complete technical documentation for implementing the voice-to-form AI assistant workflow.
> Use this guide as a reference for adding voice assistant functionality to other forms/structures in the application.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Complete File Structure](#2-complete-file-structure)
3. [Data Flow Diagram](#3-data-flow-diagram)
4. [Core Concepts](#4-core-concepts)
5. [Types & Interfaces](#5-types--interfaces)
6. [Hooks Implementation](#6-hooks-implementation)
7. [API Routes](#7-api-routes)
8. [LLM Prompts](#8-llm-prompts)
9. [UI Components](#9-ui-components)
10. [Integration with Forms](#10-integration-with-forms)
11. [Step-by-Step Implementation for New Structures](#11-step-by-step-implementation-for-new-structures)
12. [Best Practices](#12-best-practices)

---

## 1. Architecture Overview

The voice assistant follows a **two-phase interaction model**:

### Phase 1: Initial Voice Recording (VoiceRecordingModal)
```
User speaks → Audio recorded → Whisper transcribes → GPT-4o structures → Initial data ready
```

### Phase 2: Conversational Refinement (VoiceChatSidebar)
```
User chats (text/voice) → GPT-4o updates structure → User confirms → Form populated
```

### Key Design Principles

1. **No Hallucination Rule**: The LLM ONLY extracts explicitly mentioned information. Unknown fields are set to `null`.

2. **Merge Strategy**: New data from chat messages is merged with existing data. Non-null values override previous values.

3. **Session Persistence**: Chat sessions are persisted to localStorage with 24-hour expiry.

4. **Doctor Authentication**: All API routes require authenticated doctor session.

---

## 2. Complete File Structure

```
apps/doctor/src/
├── app/
│   ├── api/voice/
│   │   ├── transcribe/route.ts    # POST /api/voice/transcribe - Audio → Text
│   │   ├── structure/route.ts     # POST /api/voice/structure - Text → JSON
│   │   └── chat/route.ts          # POST /api/voice/chat - Conversational
│   │
│   └── dashboard/medical-records/patients/[id]/encounters/new/
│       └── page.tsx               # Entry point - integrates voice assistant
│
├── components/voice-assistant/
│   ├── index.ts                   # Exports all components
│   ├── VoiceButton.tsx            # Reusable mic button wrapper
│   ├── VoiceRecordingModal.tsx    # Phase 1: Recording modal
│   ├── AIDraftBanner.tsx          # Shows extraction summary
│   │
│   └── chat/
│       ├── index.ts               # Exports chat components
│       ├── VoiceChatSidebar.tsx   # Phase 2: Chat sidebar
│       ├── ChatMessageList.tsx    # Message container
│       ├── ChatInput.tsx          # Text + voice input
│       ├── UserMessage.tsx        # User message bubble
│       ├── AIMessage.tsx          # AI message bubble
│       ├── VoiceRecordButton.tsx  # Mic button for chat
│       └── StructuredDataPreview.tsx # Extracted data display
│
├── hooks/
│   ├── useVoiceRecording.ts       # Low-level audio recording
│   ├── useVoiceSession.ts         # Recording → transcribe → structure flow
│   ├── useChatSession.ts          # Chat conversation management
│   └── useChatPersistence.ts      # localStorage persistence
│
├── lib/voice-assistant/
│   └── prompts.ts                 # LLM system prompts
│
└── types/
    └── voice-assistant.ts         # All TypeScript interfaces
```

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: INITIAL RECORDING                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐     ┌───────────────────┐     ┌────────────────────┐         │
│  │ User clicks  │     │ VoiceRecording    │     │ useVoiceSession    │         │
│  │ "Asistente   │────▶│ Modal opens       │────▶│ hook initializes   │         │
│  │ de Voz"      │     │                   │     │                    │         │
│  └──────────────┘     └───────────────────┘     └────────────────────┘         │
│                                                          │                      │
│                                                          ▼                      │
│                       ┌───────────────────┐     ┌────────────────────┐         │
│                       │ User clicks       │     │ useVoiceRecording  │         │
│                       │ "Comenzar         │────▶│ starts MediaRecorder│        │
│                       │ Grabación"        │     │ (Browser API)      │         │
│                       └───────────────────┘     └────────────────────┘         │
│                                                          │                      │
│                                                          ▼                      │
│                       ┌───────────────────┐     ┌────────────────────┐         │
│                       │ User clicks       │     │ Audio Blob created │         │
│                       │ "Detener"         │────▶│ status: 'stopped'  │         │
│                       └───────────────────┘     └────────────────────┘         │
│                                                          │                      │
│                                                          ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         User clicks "Procesar"                            │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                    ┌─────────────────┼─────────────────┐                       │
│                    ▼                 │                 │                        │
│  ┌──────────────────────┐           │                 │                        │
│  │ POST /api/voice/     │           │                 │                        │
│  │ transcribe           │           │                 │                        │
│  │                      │           │                 │                        │
│  │ Input:               │           │                 │                        │
│  │  - audio blob        │           │                 │                        │
│  │  - language: 'es'    │           │                 │                        │
│  │                      │           │                 │                        │
│  │ Process:             │           │                 │                        │
│  │  - OpenAI Whisper    │           │                 │                        │
│  │                      │           │                 │                        │
│  │ Output:              │           │                 │                        │
│  │  - transcript        │──────────▶│                 │                        │
│  │  - transcriptId      │           │                 │                        │
│  │  - duration          │           │                 │                        │
│  └──────────────────────┘           │                 │                        │
│                                     ▼                 │                        │
│                    ┌──────────────────────┐           │                        │
│                    │ POST /api/voice/     │           │                        │
│                    │ structure            │           │                        │
│                    │                      │           │                        │
│                    │ Input:               │           │                        │
│                    │  - transcript        │           │                        │
│                    │  - sessionType       │           │                        │
│                    │  - context           │           │                        │
│                    │                      │           │                        │
│                    │ Process:             │           │                        │
│                    │  - GPT-4o            │           │                        │
│                    │  - System prompt     │           │                        │
│                    │  - JSON mode         │           │                        │
│                    │                      │           │                        │
│                    │ Output:              │           │                        │
│                    │  - structuredData    │───────────┼───────┐                │
│                    │  - fieldsExtracted   │           │       │                │
│                    │  - confidence        │           │       │                │
│                    └──────────────────────┘           │       │                │
│                                                       │       │                │
└───────────────────────────────────────────────────────┼───────┼────────────────┘
                                                        │       │
                                                        ▼       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: CHAT REFINEMENT                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ VoiceChatSidebar opens with InitialChatData:                         │    │
│  │  - transcript (user's first message)                                 │    │
│  │  - structuredData (AI's first extraction)                            │    │
│  │  - fieldsExtracted                                                   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                              │                                                │
│                              ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ useChatSession initializes:                                          │    │
│  │  - Creates ChatSession with initial messages                         │    │
│  │  - Sets currentData = initialData.structuredData                     │    │
│  │  - Saves to localStorage via useChatPersistence                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                              │                                                │
│                              ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    CONVERSATION LOOP                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │ User sends message (text or voice)                              │ │    │
│  │  │                                                                 │ │    │
│  │  │ If VOICE:                                                       │ │    │
│  │  │   1. Record audio                                               │ │    │
│  │  │   2. POST /api/voice/transcribe → get transcript                │ │    │
│  │  │   3. Add user message with transcript                           │ │    │
│  │  │                                                                 │ │    │
│  │  │ If TEXT:                                                        │ │    │
│  │  │   1. Add user message with text                                 │ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  │                              │                                        │    │
│  │                              ▼                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │ POST /api/voice/chat                                            │ │    │
│  │  │                                                                 │ │    │
│  │  │ Input:                                                          │ │    │
│  │  │  - sessionType                                                  │ │    │
│  │  │  - messages[] (full conversation history)                       │ │    │
│  │  │  - currentData (accumulated structured data)                    │ │    │
│  │  │  - context                                                      │ │    │
│  │  │                                                                 │ │    │
│  │  │ Process:                                                        │ │    │
│  │  │  - GPT-4o with chat system prompt                               │ │    │
│  │  │  - Includes current data context                                │ │    │
│  │  │  - Includes field analysis (filled vs missing)                  │ │    │
│  │  │                                                                 │ │    │
│  │  │ Output:                                                         │ │    │
│  │  │  - message (conversational response)                            │ │    │
│  │  │  - structuredData (updated/new extractions)                     │ │    │
│  │  │  - fieldsExtracted                                              │ │    │
│  │  │  - isComplete                                                   │ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  │                              │                                        │    │
│  │                              ▼                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │ mergeStructuredData(existing, incoming)                         │ │    │
│  │  │                                                                 │ │    │
│  │  │ Rules:                                                          │ │    │
│  │  │  - New non-null values override existing                        │ │    │
│  │  │  - Null values do NOT override existing                         │ │    │
│  │  │  - Empty strings do NOT override existing                       │ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  │                              │                                        │    │
│  │                              ▼                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │ Update session state:                                           │ │    │
│  │  │  - Add AI message to messages[]                                 │ │    │
│  │  │  - Update currentData with merged data                          │ │    │
│  │  │  - Update fieldsExtracted                                       │ │    │
│  │  │  - Save to localStorage                                         │ │    │
│  │  │                                                                 │ │    │
│  │  │ ──────────── LOOP BACK TO USER INPUT ────────────               │ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                              │                                                │
│                              ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ User clicks "Confirmar"                                              │    │
│  │                                                                      │    │
│  │ 1. confirmData() returns session.currentData                         │    │
│  │ 2. onConfirm callback fires with data                                │    │
│  │ 3. Clear session from localStorage                                   │    │
│  │ 4. Close sidebar                                                     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                              │                                                │
└──────────────────────────────┼────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         FORM POPULATION                                       │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ handleVoiceConfirm(data: VoiceEncounterData)                         │    │
│  │                                                                      │    │
│  │ Maps voice data to form data:                                        │    │
│  │                                                                      │    │
│  │ VoiceEncounterData              EncounterFormData                    │    │
│  │ ───────────────────────────────────────────────────                  │    │
│  │ encounterDate          →        encounterDate                        │    │
│  │ encounterType          →        encounterType                        │    │
│  │ chiefComplaint         →        chiefComplaint                       │    │
│  │ vitalsBloodPressure    →        vitalsBloodPressure                  │    │
│  │ vitalsHeartRate        →        vitalsHeartRate                      │    │
│  │ subjective             →        subjective                           │    │
│  │ objective              →        objective                            │    │
│  │ assessment             →        assessment                           │    │
│  │ plan                   →        plan                                 │    │
│  │ ...etc                                                               │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                              │                                                │
│                              ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ Update form state:                                                   │    │
│  │  - setVoiceInitialData(mappedData)                                   │    │
│  │  - setShowAIBanner(true)                                             │    │
│  │                                                                      │    │
│  │ EncounterForm receives voiceInitialData prop and pre-fills fields    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Concepts

### 4.1 Session Types

The system supports three session types, each with its own data schema:

```typescript
type VoiceSessionType = 'NEW_PATIENT' | 'NEW_ENCOUNTER' | 'NEW_PRESCRIPTION';
```

| Session Type | Use Case | Output Schema |
|--------------|----------|---------------|
| `NEW_PATIENT` | Register new patient | `VoicePatientData` |
| `NEW_ENCOUNTER` | Create consultation | `VoiceEncounterData` |
| `NEW_PRESCRIPTION` | Create prescription | `VoicePrescriptionData` |

### 4.2 Session Status Flow

```
idle → recording → transcribing → structuring → draft_ready → completed
                                      ↓
                                    error
```

### 4.3 The "No Hallucination Rule"

**Critical for medical data**: The LLM is strictly instructed to:
- Extract ONLY explicitly mentioned information
- Use `null` for any uncertain or unmentioned fields
- NEVER invent, guess, or assume data
- Preserve medical terminology exactly as dictated

### 4.4 Data Merge Strategy

When the user adds information through chat:

```typescript
function mergeStructuredData(existing, incoming) {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    // Only override if new value is non-null and non-empty
    if (value !== null && value !== undefined && value !== '') {
      merged[key] = value;
    }
  }

  return merged;
}
```

---

## 5. Types & Interfaces

### 5.1 Voice Data Schemas

```typescript
// For NEW_ENCOUNTER sessions
interface VoiceEncounterData {
  // Basic Information
  encounterDate?: string | null;      // ISO: YYYY-MM-DD
  encounterType?: 'consultation' | 'follow-up' | 'emergency' | 'telemedicine' | null;
  chiefComplaint?: string | null;
  location?: string | null;
  status?: 'draft' | 'completed' | null;

  // Vital Signs
  vitalsBloodPressure?: string | null;  // "120/80"
  vitalsHeartRate?: number | null;      // beats per minute
  vitalsTemperature?: number | null;    // Celsius
  vitalsWeight?: number | null;         // kg
  vitalsHeight?: number | null;         // cm
  vitalsOxygenSat?: number | null;      // percentage
  vitalsOther?: string | null;

  // Clinical Documentation
  clinicalNotes?: string | null;        // Free-form (non-SOAP)

  // SOAP Format
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;

  // Follow-up
  followUpDate?: string | null;
  followUpNotes?: string | null;
}
```

### 5.2 Chat Types

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';

  // For assistant messages
  structuredData?: VoiceStructuredData | null;
  fieldsExtracted?: string[];

  // For user voice messages
  isVoice?: boolean;
  audioDuration?: number;
}

interface ChatSession {
  id: string;
  sessionType: VoiceSessionType;
  patientId?: string;
  doctorId: string;
  messages: ChatMessage[];
  currentData: VoiceStructuredData | null;  // Accumulated data
  fieldsExtracted: string[];
  status: ChatSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.3 API Response Types

```typescript
// POST /api/voice/transcribe
interface TranscribeResponse {
  success: boolean;
  data?: {
    transcript: string;
    transcriptId: string;
    duration: number;
    language: string;
  };
  error?: { code: string; message: string; };
}

// POST /api/voice/structure
interface StructureResponse {
  success: boolean;
  data?: {
    sessionId: string;
    structuredData: VoiceStructuredData;
    fieldsExtracted: string[];
    fieldsEmpty: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  error?: { code: string; message: string; };
}

// POST /api/voice/chat
interface ChatResponse {
  success: boolean;
  data?: {
    message: string;              // AI's conversational response
    structuredData: VoiceStructuredData | null;  // Updated data
    fieldsExtracted: string[];
    isComplete: boolean;
  };
  error?: { code: string; message: string; };
}
```

---

## 6. Hooks Implementation

### 6.1 useVoiceRecording

Low-level hook for browser audio recording using MediaRecorder API.

```typescript
interface UseVoiceRecordingReturn {
  // State
  status: 'idle' | 'requesting' | 'ready' | 'recording' | 'stopped' | 'error';
  isRecording: boolean;
  duration: number;              // seconds
  error: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;

  // Permissions
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
}
```

**Key implementation details:**
- Uses `navigator.mediaDevices.getUserMedia` for microphone access
- Supports multiple audio formats (webm, mp4, ogg)
- Auto-cleanup on unmount
- Max duration enforcement (10 minutes for initial, 2 minutes for chat)

### 6.2 useVoiceSession

Orchestrates the complete Phase 1 flow: recording → transcribe → structure.

```typescript
interface UseVoiceSessionReturn {
  // Recording state (from useVoiceRecording)
  isRecording: boolean;
  recordingDuration: number;
  recordingDurationFormatted: string;
  audioBlob: Blob | null;

  // Session state
  sessionStatus: VoiceSessionStatus;
  transcript: string | null;
  structuredData: VoiceStructuredData | null;
  fieldsExtracted: string[];
  fieldsEmpty: string[];
  confidence: 'high' | 'medium' | 'low' | null;

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  processRecording: () => Promise<void>;  // Triggers transcribe + structure
  reset: () => void;

  // Computed
  canProcess: boolean;   // Has audio to process
  isProcessing: boolean; // Currently transcribing or structuring
}
```

### 6.3 useChatSession

Manages Phase 2: conversational refinement.

```typescript
interface UseChatSessionReturn {
  // Session state
  session: ChatSession | null;
  messages: ChatMessage[];
  currentData: VoiceStructuredData | null;  // Accumulated data
  fieldsExtracted: string[];
  status: ChatSessionStatus;
  error: string | null;

  // Recording state (for voice messages)
  isRecording: boolean;
  recordingDuration: number;

  // Actions
  sendTextMessage: (text: string) => Promise<void>;
  startVoiceMessage: () => Promise<void>;
  stopVoiceMessage: () => Promise<void>;
  cancelVoiceMessage: () => void;
  confirmData: () => VoiceStructuredData | null;
  resetSession: () => void;

  // Computed
  isReady: boolean;      // Has data to confirm
  isProcessing: boolean; // Currently transcribing or thinking
}
```

**Initialization with InitialChatData:**

```typescript
interface InitialChatData {
  transcript: string;           // From Phase 1
  structuredData: VoiceStructuredData;
  transcriptId: string;
  sessionId: string;
  audioDuration: number;
  fieldsExtracted: string[];
}
```

When `initialData` is provided, the hook:
1. Creates a session with the transcript as the first user message
2. Creates an AI message with the structured data
3. Sets `currentData` to the initial structured data

### 6.4 useChatPersistence

Manages localStorage persistence for chat sessions.

```typescript
interface UseChatPersistenceReturn {
  saveSession: (patientId: string, sessionType: VoiceSessionType, session: ChatSession) => void;
  loadSession: (patientId: string, sessionType: VoiceSessionType) => ChatSession | null;
  clearSession: (patientId: string, sessionType: VoiceSessionType) => void;
  clearAllSessions: () => void;
}
```

**Storage key format:** `voice_chat_{patientId}_{sessionType}`

**Features:**
- Auto-expiry after 24 hours
- Proper serialization/deserialization of Date objects
- Handles corrupted data gracefully

---

## 7. API Routes

### 7.1 POST /api/voice/transcribe

Converts audio to text using OpenAI Whisper.

**Request:**
```
Content-Type: multipart/form-data

audio: File (Blob)
language: "es" (optional, default: "es")
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "Paciente Juan Pérez, masculino, 45 años...",
    "transcriptId": "uuid",
    "duration": 45.2,
    "language": "es"
  }
}
```

**Implementation details:**
- Max file size: 25MB
- Min duration: 1 second
- Max duration: 10 minutes
- Uses `whisper-1` model
- Returns `verbose_json` for duration info

### 7.2 POST /api/voice/structure

Converts transcript to structured JSON using GPT-4o.

**Request:**
```json
{
  "transcript": "Paciente Juan Pérez...",
  "transcriptId": "uuid",
  "sessionType": "NEW_ENCOUNTER",
  "context": {
    "patientId": "...",
    "doctorId": "...",
    "doctorName": "Dr. García",
    "doctorLicense": "12345678"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "structuredData": {
      "chiefComplaint": "Dolor abdominal",
      "encounterType": "consultation",
      "vitalsBloodPressure": "120/80",
      ...
    },
    "fieldsExtracted": ["chiefComplaint", "encounterType", "vitalsBloodPressure"],
    "fieldsEmpty": ["vitalsHeartRate", "subjective", ...],
    "confidence": "medium"
  }
}
```

**Implementation details:**
- Uses `gpt-4o` model
- Temperature: 0 (deterministic)
- Response format: `json_object`
- Confidence calculation based on extraction ratio

### 7.3 POST /api/voice/chat

Conversational endpoint for chat-based refinement.

**Request:**
```json
{
  "sessionType": "NEW_ENCOUNTER",
  "messages": [
    { "role": "user", "content": "Paciente con dolor abdominal..." },
    { "role": "assistant", "content": "He registrado..." },
    { "role": "user", "content": "La presión arterial es 130/85" }
  ],
  "currentData": {
    "chiefComplaint": "Dolor abdominal",
    ...
  },
  "context": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Perfecto, he actualizado la presión arterial a 130/85.",
    "structuredData": {
      "chiefComplaint": "Dolor abdominal",
      "vitalsBloodPressure": "130/85",
      ...
    },
    "fieldsExtracted": ["chiefComplaint", "vitalsBloodPressure"],
    "isComplete": false
  }
}
```

**Implementation details:**
- Uses `gpt-4o` model
- Temperature: 0.3 (slightly creative for conversation)
- Includes current data context in system prompt
- Includes field analysis (filled vs missing)

---

## 8. LLM Prompts

### 8.1 Base System Prompt

All prompts share these critical rules:

```
1. EXTRACT ONLY EXPLICIT INFORMATION
   - Only include data clearly stated or directly implied
   - If ambiguous, use null

2. NEVER INVENT DATA
   - Do NOT guess or infer
   - Empty/null is ALWAYS better than a guess

3. PRESERVE MEDICAL TERMINOLOGY
   - Keep terms exactly as dictated (Spanish)
   - Do not simplify or "correct"

4. OUTPUT FORMAT
   - Return ONLY valid JSON
   - Use null for missing fields (not empty string)

5. NO CLINICAL DECISIONS
   - Structure information only
   - Do not diagnose or recommend
```

### 8.2 Session-Specific Prompts

Each session type has a tailored prompt with:
- Specific JSON schema
- Field extraction guidelines
- Examples of input/output
- Special handling rules

**Located in:** `src/lib/voice-assistant/prompts.ts`

### 8.3 Chat System Prompt

The chat prompt includes:
- Current accumulated data
- Field analysis (filled vs missing)
- Response format (JSON with message + structuredData + isComplete)
- Session-specific guidelines
- Examples of conversations

**Key feature:** The prompt shows which fields are already captured and which are still available, enabling the AI to guide the doctor.

---

## 9. UI Components

### 9.1 VoiceRecordingModal

Phase 1 modal that handles initial voice recording.

**States:**
- `idle`: Ready to start
- `recording`: Shows timer, pulsing indicator
- `transcribing`: Processing audio
- `structuring`: Converting to data
- `draft_ready`: Shows success, triggers sidebar

**Props:**
```typescript
interface VoiceRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: VoiceSessionType;
  patientId: string;
  onComplete: (data: InitialChatData) => void;
}
```

### 9.2 VoiceChatSidebar

Phase 2 sidebar for conversational refinement.

**Features:**
- Resizable (drag to resize)
- Full-screen on mobile
- Message list with auto-scroll
- Text and voice input
- Structured data preview
- Confirm/cancel actions

**Props:**
```typescript
interface VoiceChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: VoiceSessionType;
  patientId: string;
  doctorId: string;
  initialData?: InitialChatData;
  onConfirm: (data: VoiceStructuredData) => void;
}
```

### 9.3 StructuredDataPreview

Displays extracted data grouped by sections.

**Groups for NEW_ENCOUNTER:**
- Signos Vitales (vitals)
- Notas SOAP (subjective, objective, assessment, plan)
- Información General (type, complaint, notes)
- Seguimiento (follow-up)

**Features:**
- Shows filled vs missing fields
- Formats values appropriately (dates, units)
- Collapsible groups

---

## 10. Integration with Forms

### 10.1 Page Setup (Nueva Consulta Example)

```tsx
// State
const [modalOpen, setModalOpen] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | null>(null);
const [voiceInitialData, setVoiceInitialData] = useState<EncounterFormData | null>(null);
const [showAIBanner, setShowAIBanner] = useState(false);

// Handle Phase 1 completion → Open Phase 2
const handleVoiceComplete = useCallback((data: InitialChatData) => {
  setSidebarInitialData(data);
  setModalOpen(false);
  setSidebarOpen(true);
}, []);

// Handle Phase 2 confirmation → Populate form
const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
  const voiceData = data as VoiceEncounterData;

  // Map voice data to form data
  const formData: EncounterFormData = {
    encounterDate: voiceData.encounterDate || new Date().toISOString().split('T')[0],
    encounterType: voiceData.encounterType || 'consultation',
    chiefComplaint: voiceData.chiefComplaint || '',
    vitalsBloodPressure: voiceData.vitalsBloodPressure || '',
    // ... map all fields
  };

  setVoiceInitialData(formData);
  setShowAIBanner(true);
  setSidebarOpen(false);
}, []);
```

### 10.2 JSX Structure

```tsx
return (
  <div>
    {/* Voice Assistant Button - hidden after confirmation */}
    {!voiceInitialData && (
      <button onClick={() => setModalOpen(true)}>
        <Mic /> Asistente de Voz
      </button>
    )}

    {/* AI Draft Banner */}
    {showAIBanner && voiceInitialData && (
      <AIDraftBanner
        fieldsExtracted={...}
        fieldsEmpty={...}
        confidence={...}
        onDismiss={() => setShowAIBanner(false)}
      />
    )}

    {/* Form - receives voice data */}
    <EncounterForm
      patientId={patientId}
      voiceInitialData={voiceInitialData}
      onSuccess={handleSuccess}
    />

    {/* Phase 1: Recording Modal */}
    <VoiceRecordingModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      sessionType="NEW_ENCOUNTER"
      patientId={patientId}
      onComplete={handleVoiceComplete}
    />

    {/* Phase 2: Chat Sidebar */}
    <VoiceChatSidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      sessionType="NEW_ENCOUNTER"
      patientId={patientId}
      doctorId={doctorId}
      initialData={sidebarInitialData || undefined}
      onConfirm={handleVoiceConfirm}
    />
  </div>
);
```

### 10.3 Form Component Integration

```tsx
function EncounterForm({ voiceInitialData, ...props }) {
  const [formData, setFormData] = useState<EncounterFormData>(defaultValues);

  // Apply voice data when it arrives
  useEffect(() => {
    if (voiceInitialData) {
      setFormData(prev => ({
        ...prev,
        ...voiceInitialData,
      }));
    }
  }, [voiceInitialData]);

  // ... rest of form
}
```

---

## 11. Step-by-Step Implementation for New Structures

### Step 1: Define the Data Schema

Add to `types/voice-assistant.ts`:

```typescript
// 1. Create the voice data interface
export interface VoiceNewStructureData {
  field1?: string | null;
  field2?: number | null;
  // ... all fields with optional + nullable
}

// 2. Add to union type
export type VoiceStructuredData =
  | VoicePatientData
  | VoiceEncounterData
  | VoicePrescriptionData
  | VoiceNewStructureData;  // Add here

// 3. Add extractable fields
export const EXTRACTABLE_FIELDS: Record<VoiceSessionType, string[]> = {
  // ... existing
  NEW_STRUCTURE: ['field1', 'field2', ...],
};

// 4. Add field labels (Spanish)
export const FIELD_LABELS_ES: Record<string, string> = {
  // ... existing
  field1: 'Campo 1',
  field2: 'Campo 2',
};
```

### Step 2: Create the LLM Prompt

Add to `lib/voice-assistant/prompts.ts`:

```typescript
export const NEW_STRUCTURE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

## YOUR TASK: STRUCTURE [DESCRIPTION] INFORMATION

Extract [description] information from the transcript and return a JSON object.
Use null for any field not explicitly mentioned.

## OUTPUT SCHEMA

{
  "field1": string | null,  // Description
  "field2": number | null,  // Description
  // ... all fields
}

## FIELD EXTRACTION GUIDELINES

### Field1
- Rule 1
- Rule 2

## EXAMPLES

### Example 1
Transcript: "..."
Output: { ... }
`;

// Update getSystemPrompt()
export function getSystemPrompt(sessionType: VoiceSessionType): string {
  switch (sessionType) {
    // ... existing cases
    case 'NEW_STRUCTURE':
      return NEW_STRUCTURE_SYSTEM_PROMPT;
  }
}

// Update getChatSystemPrompt() - add schema and guidelines
```

### Step 3: Update API Routes

The existing API routes (`/api/voice/transcribe`, `/api/voice/structure`, `/api/voice/chat`) should work automatically if you've updated the types and prompts correctly.

### Step 4: Create/Update StructuredDataPreview

Add field groups for the new structure in `StructuredDataPreview.tsx`:

```typescript
const NEW_STRUCTURE_GROUPS = {
  group1: {
    label: 'Grupo 1',
    fields: ['field1', 'field2'],
  },
  // ... more groups
};
```

### Step 5: Integrate with the Form Page

```tsx
// In your page component
const [modalOpen, setModalOpen] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | null>(null);
const [voiceInitialData, setVoiceInitialData] = useState<YourFormData | null>(null);

const handleVoiceComplete = useCallback((data: InitialChatData) => {
  setSidebarInitialData(data);
  setModalOpen(false);
  setSidebarOpen(true);
}, []);

const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
  const voiceData = data as VoiceNewStructureData;

  // Map to your form data structure
  const formData: YourFormData = {
    field1: voiceData.field1 || '',
    field2: voiceData.field2 || 0,
    // ...
  };

  setVoiceInitialData(formData);
  setSidebarOpen(false);
}, []);

// Render components...
```

### Step 6: Update Form Component

Add `voiceInitialData` prop to your form and apply it:

```tsx
useEffect(() => {
  if (voiceInitialData) {
    setFormData(prev => ({ ...prev, ...voiceInitialData }));
  }
}, [voiceInitialData]);
```

---

## 12. Best Practices

### 12.1 Prompt Engineering

1. **Be explicit about null handling**: Always tell the LLM to use `null` for missing/uncertain fields
2. **Provide examples**: Include 2-3 examples showing different scenarios
3. **Define field formats**: Specify exact formats (dates as YYYY-MM-DD, etc.)
4. **List valid enum values**: For fields with limited options, list all valid values

### 12.2 Error Handling

1. **Graceful degradation**: If voice fails, user can still use manual form
2. **Clear error messages**: Show Spanish error messages for common issues
3. **Retry logic**: Allow users to retry failed operations
4. **Session recovery**: Use localStorage to recover from page refreshes

### 12.3 Performance

1. **Parallel processing**: Don't block UI during API calls
2. **Optimistic updates**: Show loading states immediately
3. **Debounce**: Prevent rapid-fire API calls
4. **Cache sessions**: Use localStorage to avoid redundant API calls

### 12.4 Security

1. **Authentication**: All API routes require doctor authentication
2. **Audit logging**: Log all voice sessions with IDs for traceability
3. **Input validation**: Validate all inputs on the server
4. **No sensitive data in prompts**: Don't include PII in system prompts

### 12.5 UX Guidelines

1. **Clear visual states**: Show distinct states (recording, processing, ready)
2. **Progress indicators**: Show what's happening during long operations
3. **Confirmation before action**: Require explicit confirmation before form population
4. **Easy correction**: Make it easy to edit/correct AI-extracted data
5. **Keyboard shortcuts**: Support Escape to close, Enter to send

---

## Appendix: Quick Reference

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/voice/transcribe` | POST | Audio → Text |
| `/api/voice/structure` | POST | Text → JSON |
| `/api/voice/chat` | POST | Conversational |

### Session Types

| Type | Schema | Use Case |
|------|--------|----------|
| `NEW_PATIENT` | `VoicePatientData` | Patient registration |
| `NEW_ENCOUNTER` | `VoiceEncounterData` | Consultation |
| `NEW_PRESCRIPTION` | `VoicePrescriptionData` | Prescription |

### Hooks

| Hook | Purpose |
|------|---------|
| `useVoiceRecording` | Browser audio recording |
| `useVoiceSession` | Phase 1 orchestration |
| `useChatSession` | Phase 2 chat management |
| `useChatPersistence` | localStorage persistence |

### Key Files to Modify for New Structures

1. `types/voice-assistant.ts` - Add data interface
2. `lib/voice-assistant/prompts.ts` - Add LLM prompt
3. `components/voice-assistant/chat/StructuredDataPreview.tsx` - Add field groups
4. Your page component - Integrate modal, sidebar, form
