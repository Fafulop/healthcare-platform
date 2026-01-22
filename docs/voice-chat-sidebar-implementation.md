# Voice Assistant Chat Sidebar - Implementation Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [File Structure](#file-structure)
5. [Type Definitions](#type-definitions)
6. [Hooks](#hooks)
7. [API Endpoint](#api-endpoint)
8. [UI Components](#ui-components)
9. [Integration Guide](#integration-guide)
10. [LLM Prompts](#llm-prompts)
11. [LocalStorage Persistence](#localstorage-persistence)
12. [Testing Guide](#testing-guide)

---

## Overview

The Voice Chat Sidebar is a conversational interface that allows doctors to dictate clinical information through voice or text, refine the extracted data through multiple exchanges with an AI assistant, and only populate the form when they confirm the data is correct.

### Previous Flow (Direct Form Fill)
```
Voice Recording → Transcribe → Structure → Form Fills Immediately
```

### New Flow (Chat-Based)
```
Voice/Text → Chat Sidebar → AI Response with Data Preview → Refine (loop) → Confirm → Form Fills
```

### Key Benefits

1. **Iterative Refinement**: Doctors can correct or add information through conversation
2. **Data Preview**: See extracted data before it fills the form
3. **Explicit Confirmation**: Form only fills when doctor clicks "Confirm"
4. **Persistence**: Chat sessions survive page refreshes (24h expiry)
5. **Multi-Modal Input**: Support for both voice and text messages

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        encounters/new/page.tsx                   │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  EncounterForm  │    │        VoiceChatSidebar             │ │
│  │                 │◄───│  ┌─────────────────────────────┐    │ │
│  │  (receives      │    │  │     useChatSession          │    │ │
│  │   data on       │    │  │  ┌─────────────────────┐    │    │ │
│  │   confirm)      │    │  │  │ useChatPersistence  │    │    │ │
│  │                 │    │  │  │ (localStorage)      │    │    │ │
│  └─────────────────┘    │  │  └─────────────────────┘    │    │ │
│                         │  │  ┌─────────────────────┐    │    │ │
│                         │  │  │ useVoiceRecording   │    │    │ │
│                         │  │  │ (MediaRecorder API) │    │    │ │
│                         │  │  └─────────────────────┘    │    │ │
│                         │  └─────────────────────────────┘    │ │
│                         │                                      │ │
│                         │  ┌─────────────────────────────┐    │ │
│                         │  │      UI Components          │    │ │
│                         │  │  - ChatMessageList          │    │ │
│                         │  │  - ChatInput                │    │ │
│                         │  │  - UserMessage / AIMessage  │    │ │
│                         │  │  - StructuredDataPreview    │    │ │
│                         │  └─────────────────────────────┘    │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │ /api/voice/transcribe│    │     /api/voice/chat            │ │
│  │ (Whisper API)        │    │     (GPT-4o)                    │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
VoiceChatSidebar
├── Header (title, reset, close buttons)
├── Error Banner (conditional)
├── ChatMessageList
│   ├── Welcome Message (when empty)
│   ├── UserMessage (for each user message)
│   │   └── Voice indicator (if voice message)
│   ├── AIMessage (for each assistant message)
│   │   └── StructuredDataPreview (collapsible)
│   └── Processing Indicator (when thinking)
├── Confirm Section (when data ready)
│   ├── StructuredDataPreview (compact)
│   └── Confirm Button
└── ChatInput
    ├── VoiceRecordButton
    ├── Text Input
    └── Send Button
```

---

## Data Flow

### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                             │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                                   ▼
            ┌──────────────┐                    ┌──────────────┐
            │ Voice Input  │                    │  Text Input  │
            └──────────────┘                    └──────────────┘
                    │                                   │
                    ▼                                   │
            ┌──────────────┐                           │
            │ MediaRecorder│                           │
            │    API       │                           │
            └──────────────┘                           │
                    │                                   │
                    ▼                                   │
            ┌──────────────┐                           │
            │  Audio Blob  │                           │
            └──────────────┘                           │
                    │                                   │
                    ▼                                   │
            ┌──────────────┐                           │
            │ POST /api/   │                           │
            │ voice/       │                           │
            │ transcribe   │                           │
            └──────────────┘                           │
                    │                                   │
                    ▼                                   │
            ┌──────────────┐                           │
            │  Transcript  │◄──────────────────────────┘
            └──────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           useChatSession                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Create user message                                              │  │
│  │ 2. Add to messages array                                            │  │
│  │ 3. Prepare API request with:                                        │  │
│  │    - sessionType                                                    │  │
│  │    - Full message history                                           │  │
│  │    - Current accumulated data                                       │  │
│  │    - Context (patientId, doctorId, etc.)                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        POST /api/voice/chat                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Authenticate doctor (JWT)                                        │  │
│  │ 2. Build system prompt with:                                        │  │
│  │    - Session type schema                                            │  │
│  │    - Current accumulated data                                       │  │
│  │    - Extraction guidelines                                          │  │
│  │ 3. Call GPT-4o with conversation history                           │  │
│  │ 4. Parse JSON response                                              │  │
│  │ 5. Calculate extracted fields                                       │  │
│  │ 6. Return: { message, structuredData, fieldsExtracted, isComplete } │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           useChatSession                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Create assistant message with structuredData                     │  │
│  │ 2. Merge new data with existing accumulated data                    │  │
│  │ 3. Update fieldsExtracted list                                      │  │
│  │ 4. Save session to localStorage                                     │  │
│  │ 5. Update UI state                                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              UI UPDATE                                    │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ - New messages rendered in ChatMessageList                          │  │
│  │ - AI message shows StructuredDataPreview                            │  │
│  │ - If isReady, show Confirm section                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    │ (User can send more messages to refine)
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS CONFIRM                               │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           confirmData()                                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Get currentData from session                                     │  │
│  │ 2. Call onConfirm(data) callback                                    │  │
│  │ 3. Clear session from localStorage                                  │  │
│  │ 4. Close sidebar                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Parent Page Handler                                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ handleVoiceConfirm(data):                                           │  │
│  │   1. Map voice data to form data                                    │  │
│  │   2. Set form initial data                                          │  │
│  │   3. Show AI Draft Banner                                           │  │
│  │   4. Form re-renders with populated fields                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/doctor/src/
├── app/api/voice/
│   ├── transcribe/
│   │   └── route.ts              # Existing - Whisper transcription
│   ├── structure/
│   │   └── route.ts              # Existing - Direct structuring
│   └── chat/
│       └── route.ts              # NEW - Conversational chat endpoint
│
├── components/voice-assistant/
│   ├── VoiceButton.tsx           # Existing - Opens modal
│   ├── VoiceRecordingModal.tsx   # Existing - Direct flow modal
│   ├── AIDraftBanner.tsx         # Existing - Shows after AI fills form
│   ├── index.ts                  # MODIFIED - Added chat exports
│   └── chat/
│       ├── VoiceChatSidebar.tsx  # NEW - Main sidebar container
│       ├── ChatMessageList.tsx   # NEW - Scrollable message list
│       ├── ChatInput.tsx         # NEW - Voice + text input
│       ├── UserMessage.tsx       # NEW - User message bubble
│       ├── AIMessage.tsx         # NEW - AI message + data preview
│       ├── VoiceRecordButton.tsx # NEW - Mic button with states
│       ├── StructuredDataPreview.tsx # NEW - Formatted data card
│       └── index.ts              # NEW - Chat component exports
│
├── hooks/
│   ├── useVoiceRecording.ts      # Existing - MediaRecorder wrapper
│   ├── useVoiceSession.ts        # Existing - Direct flow orchestration
│   ├── useChatSession.ts         # NEW - Chat flow orchestration
│   └── useChatPersistence.ts     # NEW - localStorage management
│
├── lib/voice-assistant/
│   └── prompts.ts                # MODIFIED - Added getChatSystemPrompt
│
├── types/
│   └── voice-assistant.ts        # MODIFIED - Added chat types
│
└── app/dashboard/medical-records/patients/[id]/encounters/new/
    └── page.tsx                  # MODIFIED - Integrated sidebar
```

---

## Type Definitions

### Chat Message Types

```typescript
// apps/doctor/src/types/voice-assistant.ts

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
  id: string;                              // Unique message ID (UUID)
  role: ChatRole;                          // Who sent this message
  content: string;                         // The message text
  timestamp: Date;                         // When the message was sent
  status: ChatMessageStatus;               // Message delivery status

  // For assistant messages - structured data extracted
  structuredData?: VoiceStructuredData | null;
  fieldsExtracted?: string[];              // Which fields were extracted

  // For user messages - whether it was from voice
  isVoice?: boolean;                       // True if voice message
  audioDuration?: number;                  // Duration in seconds

  // Error info for failed messages
  errorMessage?: string;
}
```

### Chat Session Types

```typescript
/**
 * Status of the overall chat session
 */
export type ChatSessionStatus =
  | 'idle'          // No activity
  | 'recording'     // Recording voice
  | 'transcribing'  // Converting voice to text
  | 'thinking'      // Waiting for AI response
  | 'ready'         // Data ready for confirmation
  | 'error';        // Error state

/**
 * Complete chat session state
 */
export interface ChatSession {
  id: string;                              // Session UUID
  sessionType: VoiceSessionType;           // NEW_PATIENT | NEW_ENCOUNTER | NEW_PRESCRIPTION
  patientId?: string;                      // Associated patient
  doctorId: string;                        // Owner doctor

  messages: ChatMessage[];                 // Conversation history
  currentData: VoiceStructuredData | null; // Accumulated extracted data
  fieldsExtracted: string[];               // All extracted field names

  status: ChatSessionStatus;
  createdAt: Date;
  updatedAt: Date;

  errorMessage?: string;
}
```

### API Types

```typescript
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
    message: string;                       // AI's conversational response
    structuredData: VoiceStructuredData | null; // Extracted data
    fieldsExtracted: string[];             // Which fields were extracted
    isComplete: boolean;                   // Whether enough data collected
  };
  error?: {
    code: 'CHAT_FAILED' | 'INVALID_REQUEST' | 'RATE_LIMITED';
    message: string;
  };
}
```

---

## Hooks

### useChatSession

The main hook that orchestrates the chat flow.

```typescript
// apps/doctor/src/hooks/useChatSession.ts

interface UseChatSessionOptions {
  sessionType: VoiceSessionType;  // Type of form being filled
  patientId: string;              // Patient context
  doctorId: string;               // Doctor context
  context?: VoiceSessionContext;  // Additional context
  onConfirm?: (data: VoiceStructuredData) => void; // Callback on confirm
}

interface UseChatSessionReturn {
  // Session state
  session: ChatSession | null;
  messages: ChatMessage[];
  currentData: VoiceStructuredData | null;
  fieldsExtracted: string[];
  status: ChatSessionStatus;
  error: string | null;

  // Recording state
  isRecording: boolean;
  recordingDuration: number;
  recordingDurationFormatted: string;

  // Computed
  isReady: boolean;      // Has data to confirm
  isProcessing: boolean; // Waiting for API

  // Actions
  sendTextMessage: (text: string) => Promise<void>;
  startVoiceMessage: () => Promise<void>;
  stopVoiceMessage: () => Promise<void>;
  cancelVoiceMessage: () => void;
  confirmData: () => VoiceStructuredData | null;
  resetSession: () => void;
}
```

#### Key Implementation Details

**Data Merging Logic:**
```typescript
function mergeStructuredData(
  existing: VoiceStructuredData | null,
  incoming: VoiceStructuredData | null
): VoiceStructuredData | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = { ...existing };

  // New non-null values override existing values
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== null && value !== undefined && value !== '') {
      (merged as any)[key] = value;
    }
  }

  return merged;
}
```

**Voice Message Flow:**
```typescript
const processVoiceMessage = async (audioBlob: Blob) => {
  // 1. Transcribe audio
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  const transcribeRes = await fetch('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
  const transcript = transcribeRes.data.transcript;

  // 2. Create user message
  const userMessage = {
    id: generateId(),
    role: 'user',
    content: transcript,
    isVoice: true,
    audioDuration: transcribeRes.data.duration,
  };
  addMessage(userMessage);

  // 3. Send to chat API
  const chatRes = await fetch('/api/voice/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionType,
      messages: [...session.messages, userMessage],
      currentData: session.currentData,
      context,
    }),
  });

  // 4. Process response
  const assistantMessage = {
    id: generateId(),
    role: 'assistant',
    content: chatRes.data.message,
    structuredData: chatRes.data.structuredData,
    fieldsExtracted: chatRes.data.fieldsExtracted,
  };
  addMessage(assistantMessage);
  updateSessionData(chatRes.data.structuredData);
};
```

### useChatPersistence

Manages localStorage persistence with 24-hour expiry.

```typescript
// apps/doctor/src/hooks/useChatPersistence.ts

interface UseChatPersistenceReturn {
  saveSession: (patientId: string, sessionType: VoiceSessionType, session: ChatSession) => void;
  loadSession: (patientId: string, sessionType: VoiceSessionType) => ChatSession | null;
  clearSession: (patientId: string, sessionType: VoiceSessionType) => void;
  clearAllSessions: () => void;
}
```

#### Storage Key Format
```
voice_chat_${patientId}_${sessionType}
```

Example: `voice_chat_abc123_NEW_ENCOUNTER`

#### Serialization

Sessions are serialized with Date objects converted to ISO strings:

```typescript
function serializeSession(session: ChatSession): string {
  return JSON.stringify({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    })),
  });
}
```

#### Expiry Check

```typescript
function isExpired(timestamp: string | Date): boolean {
  const createdAt = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff > 24; // 24 hour expiry
}
```

---

## API Endpoint

### POST /api/voice/chat

Conversational AI endpoint for extracting and refining clinical data.

**Location:** `apps/doctor/src/app/api/voice/chat/route.ts`

#### Request

```typescript
{
  sessionType: 'NEW_ENCOUNTER',
  messages: [
    { role: 'user', content: 'Paciente Juan Pérez, 45 años, dolor abdominal' },
    { role: 'assistant', content: 'Entendido. ¿Signos vitales?' },
    { role: 'user', content: 'Presión 120/80, frecuencia 72' }
  ],
  currentData: {
    chiefComplaint: 'Dolor abdominal',
    // ... previously extracted data
  },
  context: {
    patientId: 'abc123',
    doctorId: 'doc456'
  }
}
```

#### Response

```typescript
{
  success: true,
  data: {
    message: 'Perfecto. Presión arterial 120/80, frecuencia cardíaca 72. ¿Hallazgos del examen físico?',
    structuredData: {
      chiefComplaint: 'Dolor abdominal',
      vitalsBloodPressure: '120/80',
      vitalsHeartRate: 72,
      // ... other fields
    },
    fieldsExtracted: ['chiefComplaint', 'vitalsBloodPressure', 'vitalsHeartRate'],
    isComplete: false
  }
}
```

#### Implementation Flow

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const { doctorId } = await requireDoctorAuth(request);

  // 2. Parse and validate request
  const { sessionType, messages, currentData, context } = await request.json();

  // 3. Build system prompt with current data context
  const systemPrompt = getChatSystemPrompt(sessionType, currentData);

  // 4. Build OpenAI messages
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({ role: msg.role, content: msg.content })),
  ];

  // 5. Call GPT-4o
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 4096,
    messages: openaiMessages,
    response_format: { type: 'json_object' },
  });

  // 6. Parse response
  const parsed = JSON.parse(completion.choices[0].message.content);

  // 7. Calculate extracted fields
  const fieldsExtracted = analyzeExtractedFields(parsed.structuredData, sessionType);

  // 8. Return response
  return NextResponse.json({
    success: true,
    data: {
      message: parsed.message,
      structuredData: parsed.structuredData,
      fieldsExtracted,
      isComplete: parsed.isComplete,
    },
  });
}
```

---

## UI Components

### VoiceChatSidebar

Main container component that slides in from the right.

```typescript
// apps/doctor/src/components/voice-assistant/chat/VoiceChatSidebar.tsx

interface VoiceChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: VoiceSessionType;
  patientId: string;
  doctorId: string;
  context?: VoiceSessionContext;
  onConfirm: (data: VoiceStructuredData) => void;
}
```

**Features:**
- Slides in from right with animation
- Full-screen on mobile, 384px width on desktop
- Backdrop overlay that closes sidebar on click
- Escape key closes sidebar
- Prevents body scroll when open
- Header with title, reset, and close buttons
- Error banner for displaying errors
- Confirm section appears when data is ready

### ChatMessageList

Scrollable list of messages with auto-scroll.

```typescript
interface ChatMessageListProps {
  messages: ChatMessage[];
  sessionType: VoiceSessionType;
  isProcessing?: boolean;
}
```

**Features:**
- Auto-scrolls to bottom on new messages
- Shows welcome message when empty
- Processing indicator (bouncing dots) when waiting for AI
- Renders UserMessage or AIMessage based on role

### ChatInput

Combined voice and text input.

```typescript
interface ChatInputProps {
  isRecording: boolean;
  isProcessing: boolean;
  recordingDuration: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSendText: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

**Features:**
- Voice record button on the left
- Text input in center (hidden during recording)
- Send button on right
- Enter key sends message
- Disabled state during processing

### VoiceRecordButton

Microphone button with visual states.

**States:**
1. **Idle**: Gray microphone icon
2. **Recording**: Red pulsing button with duration counter, stop button
3. **Processing**: Spinner icon, disabled

### UserMessage

Right-aligned blue bubble for user messages.

**Features:**
- Timestamp display
- Voice indicator with duration for voice messages

### AIMessage

Left-aligned gray bubble for AI responses.

**Features:**
- Bot icon avatar
- Collapsible StructuredDataPreview
- Badge showing number of extracted fields
- Timestamp display

### StructuredDataPreview

Formatted display of extracted data.

```typescript
interface StructuredDataPreviewProps {
  data: VoiceStructuredData;
  sessionType: VoiceSessionType;
  fieldsExtracted?: string[];
  compact?: boolean;
}
```

**Features:**
- Groups fields by category (Vitals, SOAP, etc.)
- Spanish labels for all fields
- Green checkmarks for extracted fields
- Special formatting for:
  - Vital signs (units like "lpm", "°C", "kg")
  - Dates (localized format)
  - Sex (male → Masculino)
  - Encounter type (consultation → Consulta)
- Special layout for prescriptions (medication cards)

---

## Integration Guide

### Adding Sidebar to a Page

```tsx
// Example: encounters/new/page.tsx

import { useState } from 'react';
import { VoiceChatSidebar } from '@/components/voice-assistant';
import type { VoiceStructuredData, VoiceEncounterData } from '@/types/voice-assistant';

export default function NewEncounterPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<EncounterFormData>>();

  // Handle when user confirms data in sidebar
  const handleVoiceConfirm = (data: VoiceStructuredData) => {
    const voiceData = data as VoiceEncounterData;

    // Map voice data to form data
    setFormData({
      encounterDate: voiceData.encounterDate || new Date().toISOString().split('T')[0],
      encounterType: voiceData.encounterType || 'consultation',
      chiefComplaint: voiceData.chiefComplaint || '',
      vitalsBloodPressure: voiceData.vitalsBloodPressure || undefined,
      // ... map other fields
    });

    // Show AI banner
    setShowAIBanner(true);
  };

  return (
    <div>
      {/* Button to open sidebar */}
      <button onClick={() => setSidebarOpen(true)}>
        <Mic /> Asistente de Voz
      </button>

      {/* Form */}
      <EncounterForm initialData={formData} />

      {/* Sidebar */}
      <VoiceChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessionType="NEW_ENCOUNTER"
        patientId={patientId}
        doctorId={session.user.doctorId}
        context={{ patientId, doctorId: session.user.doctorId }}
        onConfirm={handleVoiceConfirm}
      />
    </div>
  );
}
```

### Session Types

The sidebar supports three session types:

| Session Type | Form | Schema |
|--------------|------|--------|
| `NEW_PATIENT` | Patient registration | `VoicePatientData` |
| `NEW_ENCOUNTER` | Clinical encounter | `VoiceEncounterData` |
| `NEW_PRESCRIPTION` | Prescription | `VoicePrescriptionData` |

---

## LLM Prompts

### getChatSystemPrompt

Generates a conversational system prompt for GPT-4o.

**Location:** `apps/doctor/src/lib/voice-assistant/prompts.ts`

```typescript
export function getChatSystemPrompt(
  sessionType: VoiceSessionType,
  currentData?: any
): string {
  const schemaInfo = getSchemaForSessionType(sessionType);
  const currentDataJson = currentData ? JSON.stringify(currentData, null, 2) : 'null';

  return `Eres un asistente de documentación clínica...

## DATOS ACTUALES ACUMULADOS
${currentDataJson}

## SCHEMA DE DATOS PARA ${sessionType}
${schemaInfo}

## FORMATO DE RESPUESTA
{
  "message": "Tu respuesta conversacional al doctor",
  "structuredData": { ... datos extraídos según el schema ... },
  "isComplete": false
}
`;
}
```

### Key Prompt Rules

1. **Extract Only Explicit Information**: Never invent or assume data
2. **Respond in Spanish**: Mexican medical Spanish
3. **Preserve Medical Terminology**: Don't simplify clinical terms
4. **JSON Response Format**: Always return valid JSON with message, structuredData, isComplete
5. **Context Awareness**: Use accumulated data to avoid re-asking questions

### Session-Specific Guidelines

**NEW_PATIENT:**
- Prioritize: name, date of birth, sex, phone
- Ask about allergies and chronic conditions
- isComplete = true when name + contact info exists

**NEW_ENCOUNTER:**
- Prioritize: chief complaint, vital signs, clinical notes
- Detect SOAP format vs free-form notes
- isComplete = true when chief complaint + notes/SOAP exists

**NEW_PRESCRIPTION:**
- Prioritize: diagnosis and medications with dosage/frequency
- Each medication needs: name, dose, frequency, instructions
- isComplete = true when at least one complete medication exists

---

## LocalStorage Persistence

### Storage Schema

```typescript
// Key format
const key = `voice_chat_${patientId}_${sessionType}`;

// Stored value (JSON string)
{
  "id": "session-uuid",
  "sessionType": "NEW_ENCOUNTER",
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "...",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "status": "sent",
      "isVoice": true,
      "audioDuration": 5.2
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "...",
      "timestamp": "2024-01-15T10:30:05.000Z",
      "status": "sent",
      "structuredData": { ... },
      "fieldsExtracted": ["chiefComplaint", "vitalsBloodPressure"]
    }
  ],
  "currentData": {
    "chiefComplaint": "Dolor abdominal",
    "vitalsBloodPressure": "120/80"
  },
  "fieldsExtracted": ["chiefComplaint", "vitalsBloodPressure"],
  "status": "idle",
  "createdAt": "2024-01-15T10:25:00.000Z",
  "updatedAt": "2024-01-15T10:30:05.000Z"
}
```

### Lifecycle

1. **Session Created**: When user opens sidebar and sends first message
2. **Session Updated**: After each message exchange
3. **Session Loaded**: When user reopens sidebar (if not expired)
4. **Session Cleared**:
   - When user confirms data
   - When user clicks reset
   - When session expires (24 hours)
   - When form is saved

---

## Testing Guide

### Manual Testing Checklist

#### Basic Flow
- [ ] Open sidebar from "Asistente de Voz" button
- [ ] Send text message, receive AI response
- [ ] Send voice message, verify transcription and AI response
- [ ] See extracted data in AI message preview
- [ ] Click "Confirm", verify form populates
- [ ] Verify AI Draft Banner appears

#### Persistence
- [ ] Send messages, close sidebar
- [ ] Refresh page
- [ ] Open sidebar, verify messages persist
- [ ] Wait 24+ hours (or modify timestamp), verify session clears

#### Edge Cases
- [ ] Empty message (should not send)
- [ ] Very long message
- [ ] Network error during send
- [ ] Cancel voice recording mid-record
- [ ] Multiple rapid messages
- [ ] Close sidebar while processing

#### Mobile
- [ ] Sidebar takes full width on small screens
- [ ] Input is accessible above keyboard
- [ ] Scroll works correctly

### Example Test Script

```typescript
describe('VoiceChatSidebar', () => {
  it('should persist session across page refresh', async () => {
    // 1. Open sidebar
    // 2. Send message
    // 3. Close sidebar
    // 4. Refresh page
    // 5. Open sidebar
    // 6. Assert messages are present
  });

  it('should populate form on confirm', async () => {
    // 1. Open sidebar
    // 2. Send message with patient data
    // 3. Click confirm
    // 4. Assert form fields are populated
  });

  it('should merge data from multiple messages', async () => {
    // 1. Send "Paciente Juan, dolor abdominal"
    // 2. Send "Presión 120/80"
    // 3. Assert currentData has both chiefComplaint and vitalsBloodPressure
  });
});
```

---

## Summary

The Voice Chat Sidebar transforms the voice assistant from a one-shot transcription tool into an interactive, conversational interface. Key architectural decisions:

1. **Separation of Concerns**: Hooks handle state, components handle UI, API handles AI
2. **Data Accumulation**: Each message can add to or modify existing data
3. **Explicit Confirmation**: Doctor controls when data fills the form
4. **Persistence**: Sessions survive page refreshes for better UX
5. **Type Safety**: Full TypeScript coverage with discriminated unions

This implementation provides a foundation that can be extended to other form types (patient registration, prescriptions) by simply passing a different `sessionType` prop.
