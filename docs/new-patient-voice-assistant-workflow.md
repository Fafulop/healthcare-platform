# New Patient Voice Assistant Workflow

> Technical documentation for the voice assistant workflow on `/dashboard/medical-records/patients/new`

---

## Overview

The voice assistant allows doctors to register new patients by speaking instead of typing. It uses a **two-phase interaction model**:

1. **Phase 1 (Recording)**: Doctor records voice → Whisper transcribes → GPT-4o structures data
2. **Phase 2 (Chat Refinement)**: Doctor can add/correct information via chat → Confirm → Form is populated

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW PATIENT PAGE                                    │
│   /dashboard/medical-records/patients/new/page.tsx                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐  │
│  │ "Asistente de   │     │ VoiceRecording  │     │ VoiceChatSidebar    │  │
│  │  Voz" Button    │────▶│ Modal           │────▶│                     │  │
│  │                 │     │ (Phase 1)       │     │ (Phase 2)           │  │
│  └─────────────────┘     └────────┬────────┘     └──────────┬──────────┘  │
│                                   │                         │              │
│                                   ▼                         ▼              │
│                          ┌────────────────┐        ┌────────────────┐     │
│                          │ useVoiceSession│        │ useChatSession │     │
│                          │ Hook           │        │ Hook           │     │
│                          └────────┬───────┘        └───────┬────────┘     │
│                                   │                        │               │
│                                   ▼                        ▼               │
│                          ┌────────────────────────────────────────┐       │
│                          │            API Routes                  │       │
│                          │  /api/voice/transcribe (Whisper)       │       │
│                          │  /api/voice/structure  (GPT-4o)        │       │
│                          │  /api/voice/chat       (GPT-4o)        │       │
│                          └────────────────────────────────────────┘       │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    FORM POPULATION                                    │ │
│  │  handleVoiceConfirm(data) → mapVoiceToFormData() → PatientForm       │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/doctor/src/
├── app/
│   ├── api/voice/
│   │   ├── transcribe/route.ts    # Audio → Text (Whisper)
│   │   ├── structure/route.ts     # Text → JSON (GPT-4o)
│   │   └── chat/route.ts          # Conversational refinement
│   │
│   └── dashboard/medical-records/patients/new/
│       └── page.tsx               # Main page with voice integration
│
├── components/voice-assistant/
│   ├── index.ts                   # Component exports
│   ├── VoiceRecordingModal.tsx    # Phase 1: Recording modal
│   ├── AIDraftBanner.tsx          # Shows extraction summary
│   │
│   └── chat/
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
│   ├── useVoiceSession.ts         # Phase 1 orchestration
│   ├── useChatSession.ts          # Phase 2 chat management
│   └── useChatPersistence.ts      # localStorage persistence
│
├── lib/voice-assistant/
│   └── prompts.ts                 # LLM system prompts
│
└── types/
    └── voice-assistant.ts         # TypeScript interfaces
```

---

## Detailed Flow

### Step 1: User Clicks "Asistente de Voz"

**File**: `page.tsx` (lines 262-269)

```tsx
<button onClick={() => setModalOpen(true)}>
  <Mic /> Asistente de Voz
</button>
```

This opens the `VoiceRecordingModal`.

---

### Step 2: Phase 1 - Voice Recording Modal

**File**: `VoiceRecordingModal.tsx`

The modal shows:
- Reference guide for what can be dictated (name, DOB, allergies, etc.)
- Recording controls (start/stop button)
- Timer showing recording duration
- Processing status (transcribing → structuring)

**Hook Used**: `useVoiceSession`

**States**:
```
idle → recording → transcribing → structuring → draft_ready
                          ↓            ↓
                        error        error
```

**Recording Flow**:
1. User clicks microphone button → `startRecording()`
2. `useVoiceRecording` hook captures audio via `MediaRecorder` API
3. User clicks stop → `stopRecording()`
4. User clicks "Procesar" → `processRecording()`

---

### Step 3: Transcription (Audio → Text)

**File**: `api/voice/transcribe/route.ts`

**Request**:
```
POST /api/voice/transcribe
Content-Type: multipart/form-data

audio: Blob (webm/ogg/mp3)
language: "es"
```

**Process**:
1. Validate audio file (max 25MB, min 1 second, max 10 minutes)
2. Detect audio format from file header
3. Call OpenAI Whisper API (`whisper-1` model)
4. Return transcript with ID for audit

**Response**:
```json
{
  "success": true,
  "data": {
    "transcript": "Paciente María García, femenino, nacida el 15 de marzo...",
    "transcriptId": "uuid",
    "duration": 45.2,
    "language": "es"
  }
}
```

---

### Step 4: Structuring (Text → JSON)

**File**: `api/voice/structure/route.ts`

**Request**:
```json
POST /api/voice/structure
{
  "transcript": "Paciente María García...",
  "transcriptId": "uuid",
  "sessionType": "NEW_PATIENT",
  "context": { "doctorId": "..." }
}
```

**Process**:
1. Load system prompt for `NEW_PATIENT` from `prompts.ts`
2. Call GPT-4o with `response_format: { type: 'json_object' }`
3. Parse structured data
4. Calculate which fields were extracted vs empty
5. Calculate confidence level (high/medium/low)

**System Prompt Key Rules** (from `prompts.ts`):
- Extract ONLY explicitly mentioned information
- Use `null` for any uncertain or unmentioned fields
- NEVER invent, guess, or assume data
- Preserve medical terminology exactly as dictated

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "structuredData": {
      "firstName": "María",
      "lastName": "García",
      "dateOfBirth": "1980-03-15",
      "sex": "female",
      "phone": null,
      "currentAllergies": "Penicilina",
      ...
    },
    "fieldsExtracted": ["firstName", "lastName", "dateOfBirth", "sex", "currentAllergies"],
    "fieldsEmpty": ["phone", "email", "address", ...],
    "confidence": "medium"
  }
}
```

---

### Step 5: Transition to Phase 2

**File**: `VoiceRecordingModal.tsx` (lines 119-159)

When `sessionStatus === 'draft_ready'`:
1. Show success message for 1 second
2. Call `onComplete()` with:
   - `transcript`
   - `structuredData`
   - `sessionId`
   - `transcriptId`
   - `audioDuration`

**File**: `page.tsx` - `handleModalComplete` (lines 141-171)

```tsx
const handleModalComplete = (transcript, data, sessionId, transcriptId, audioDuration) => {
  const initialData: InitialChatData = {
    transcript,
    structuredData: data,
    transcriptId,
    sessionId,
    audioDuration,
    fieldsExtracted: [...],
  };

  setModalOpen(false);
  setSidebarInitialData(initialData);
  setSidebarOpen(true);  // Opens VoiceChatSidebar
};
```

---

### Step 6: Phase 2 - Chat Sidebar

**File**: `VoiceChatSidebar.tsx`

The sidebar shows:
- Chat history (user messages + AI responses)
- Text input field
- Voice record button (for voice messages in chat)
- Data preview showing captured vs missing fields
- "Confirmar" button when data is ready

**Hook Used**: `useChatSession`

**Initialization** (from `useChatSession.ts`):
When `initialData` is provided:
1. Create user message with the original transcript
2. Create AI message with extraction summary
3. Set `currentData` to the structured data
4. Save session to localStorage

---

### Step 7: Chat Interaction

**User can send messages by**:
1. **Text**: Type in input field and press Enter
2. **Voice**: Press mic button, speak, press again to send

**For each message**:

**File**: `api/voice/chat/route.ts`

**Request**:
```json
POST /api/voice/chat
{
  "sessionType": "NEW_PATIENT",
  "messages": [
    { "role": "user", "content": "Original transcript..." },
    { "role": "assistant", "content": "He registrado..." },
    { "role": "user", "content": "El teléfono es 55 1234 5678" }
  ],
  "currentData": { ... accumulated data ... },
  "context": { ... }
}
```

**Process**:
1. Load chat system prompt (includes current data context + field analysis)
2. Call GPT-4o
3. Parse response with: `message`, `structuredData`, `isComplete`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Perfecto, he registrado el teléfono 55 1234 5678.",
    "structuredData": {
      "firstName": "María",
      "lastName": "García",
      "phone": "55 1234 5678",
      ...
    },
    "fieldsExtracted": ["firstName", "lastName", "phone", ...],
    "isComplete": false
  }
}
```

**Data Merge Strategy** (from `useChatSession.ts`):
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

### Step 8: Confirmation

**File**: `VoiceChatSidebar.tsx` (lines 167-177)

When user clicks "Confirmar y Rellenar Formulario":
1. Call `chat.confirmData()` which returns `currentData`
2. `onConfirm` callback fires with the data
3. Clear session from localStorage
4. Close sidebar

---

### Step 9: Form Population

**File**: `page.tsx` - `handleVoiceConfirm` (lines 174-207)

```tsx
const handleVoiceConfirm = (data: VoiceStructuredData) => {
  const voiceData = data as VoicePatientData;

  // Map voice data to form data
  const mappedData = mapVoiceToFormData(voiceData);

  setVoiceInitialData(mappedData);
  setShowAIBanner(true);
  setSidebarOpen(false);
};
```

**Mapping Function** (lines 21-44):
```typescript
function mapVoiceToFormData(voiceData: VoicePatientData): Partial<PatientFormData> {
  return {
    firstName: voiceData.firstName || '',
    lastName: voiceData.lastName || '',
    dateOfBirth: voiceData.dateOfBirth || '',
    sex: voiceData.sex || 'male',
    bloodType: voiceData.bloodType || undefined,
    phone: voiceData.phone || undefined,
    // ... all fields
  };
}
```

---

### Step 10: AI Draft Banner

**File**: `AIDraftBanner.tsx`

Shows:
- Confidence level (high/medium/low)
- Number of fields extracted
- Expandable details showing extracted vs empty fields
- Warning if confidence is low

---

## Data Types

### VoicePatientData (from `types/voice-assistant.ts`)

```typescript
interface VoicePatientData {
  // Identification
  internalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;  // YYYY-MM-DD
  sex?: 'male' | 'female' | 'other' | null;
  bloodType?: string | null;

  // Contact
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

  // Medical
  currentAllergies?: string | null;
  currentChronicConditions?: string | null;
  currentMedications?: string | null;
  generalNotes?: string | null;
  tags?: string[] | null;
}
```

---

## Session Persistence

**File**: `useChatPersistence.ts`

- Sessions are saved to localStorage
- Key format: `voice_chat_{patientId}_{sessionType}`
- Auto-expiry after 24 hours
- Handles serialization/deserialization of Date objects
- Recovers from page refreshes

---

## LLM Prompts

**File**: `lib/voice-assistant/prompts.ts`

### Base Rules (embedded in all prompts):
1. Extract ONLY explicit information
2. NEVER invent data
3. Preserve medical terminology
4. Output valid JSON
5. No clinical decisions

### NEW_PATIENT Prompt Key Points:
- Convert spoken dates to ISO format (YYYY-MM-DD)
- Map sex terms: "masculino" → "male", "femenino" → "female"
- Format blood types: "O positivo" → "O+"
- If only age mentioned, use `null` for dateOfBirth (don't calculate)

### Chat Prompt:
- Includes current accumulated data
- Shows which fields are filled vs missing
- Guides doctor on what information to add
- Response format: `{ message, structuredData, isComplete }`

---

## UI Components Summary

| Component | Purpose |
|-----------|---------|
| `VoiceRecordingModal` | Phase 1: Record voice, show processing status |
| `VoiceChatSidebar` | Phase 2: Chat interface, data preview, confirm |
| `ChatMessageList` | Display conversation messages |
| `ChatInput` | Text + voice input field |
| `StructuredDataPreview` | Show extracted data grouped by sections |
| `AIDraftBanner` | Show extraction summary after form fill |

---

## Hooks Summary

| Hook | Purpose |
|------|---------|
| `useVoiceRecording` | Low-level MediaRecorder API wrapper |
| `useVoiceSession` | Orchestrates recording → transcribe → structure |
| `useChatSession` | Manages chat state, messages, data merging |
| `useChatPersistence` | localStorage save/load/clear |

---

## API Routes Summary

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/voice/transcribe` | POST | Audio blob | Transcript text |
| `/api/voice/structure` | POST | Transcript + sessionType | Structured JSON |
| `/api/voice/chat` | POST | Messages + currentData | AI response + updated data |

---

## Key Design Decisions

1. **Two-Phase Model**: Recording is separate from refinement, allowing quick initial capture followed by detailed editing.

2. **No Hallucination Rule**: The LLM is strictly instructed to never invent data. Unknown = `null`.

3. **Merge Strategy**: New data overrides existing only if non-null. This prevents accidental data loss.

4. **Session Persistence**: Chat sessions survive page refreshes (24-hour expiry).

5. **Doctor Authentication**: All API routes require authenticated doctor session.

6. **Audio Privacy**: Audio is not stored, only used for transcription.

7. **Confidence Levels**: Based on extraction ratio (how many fields were successfully extracted).
