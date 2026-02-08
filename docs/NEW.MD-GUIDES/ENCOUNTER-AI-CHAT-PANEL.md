# Encounter AI Chat Panel - Complete Architecture Guide

**Purpose:** This document describes in extreme detail the AI Chat Panel feature for the encounter form. The doctor can type or speak patient information in natural language, and the AI extracts structured data to inject directly into the encounter form fields in real-time. No confirmation step required.

**Date Created:** February 8, 2026
**Feature Location:** New Encounter page (`/dashboard/medical-records/patients/[id]/encounters/new`)
**Related Features:** Voice Assistant (Asistente de Voz), FormBuilder AI Chat Panel

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [File Map](#3-file-map)
4. [Data Flow - Text Input](#4-data-flow---text-input)
5. [Data Flow - Voice Input](#5-data-flow---voice-input)
6. [API Endpoint: /api/encounter-chat](#6-api-endpoint-apiencounter-chat)
7. [Hook: useEncounterChat](#7-hook-useencounterchat)
8. [Component: EncounterChatPanel](#8-component-encounterchatpanel)
9. [Form Integration: EncounterForm Changes](#9-form-integration-encounterform-changes)
10. [Page Integration: New Encounter Page Changes](#10-page-integration-new-encounter-page-changes)
11. [Template Adaptation (Standard vs Custom)](#11-template-adaptation-standard-vs-custom)
12. [Versioned Update Mechanism](#12-versioned-update-mechanism)
13. [Voice Recording Pipeline](#13-voice-recording-pipeline)
14. [Error Handling](#14-error-handling)
15. [Relationship to Existing Voice Assistant](#15-relationship-to-existing-voice-assistant)
16. [Reused Components and Hooks](#16-reused-components-and-hooks)
17. [UI States and Interactions](#17-ui-states-and-interactions)
18. [LLM System Prompt Details](#18-llm-system-prompt-details)
19. [Known Considerations](#19-known-considerations)
20. [Testing Checklist](#20-testing-checklist)

---

## 1. Feature Overview

The Encounter AI Chat Panel is a slide-in panel on the right side of the new encounter page. It provides two input methods:

- **Text input:** Doctor types patient data in natural language (e.g., "motivo de consulta: dolor de cabeza severo, presion arterial 120/80")
- **Voice input:** Doctor presses the mic button, speaks, the audio is transcribed via Whisper, and the transcribed text is sent to the AI

The AI (GPT-4o) reads the current form state, identifies which fields match the doctor's description, and returns structured `fieldUpdates`. These updates are injected directly into the encounter form — no "Confirmar" step. The form is the source of truth.

**Key design decisions:**
- This is a **parallel feature** alongside the existing Voice Assistant (modal + sidebar + confirm). Both coexist.
- The form updates happen **immediately** when the AI responds — no confirmation dialog.
- The chat panel maintains **conversation history** so the doctor can iteratively add data across multiple messages.
- Works with both **standard templates** (EncounterFormData fields) and **custom templates** (dynamic custom fields).

---

## 2. Architecture Diagram

```
Doctor speaks/types
        |
        v
  [EncounterChatPanel]
     |            |
     |            v (if voice)
     |    [useVoiceRecording] → MediaRecorder API
     |            |
     |            v (on stop)
     |    POST /api/voice/transcribe → OpenAI Whisper
     |            |
     |            v (transcribed text)
     |____________|
        |
        v
  [useEncounterChat.sendMessage(text)]
        |
        v
  POST /api/encounter-chat
    - System prompt: current form fields + values
    - Conversation history
    - GPT-4o with JSON mode
        |
        v
  Response: { message, action, fieldUpdates }
        |
        v
  Hook separates standard vs custom field updates
        |
        ├── onUpdateForm(standardUpdates) → Page
        |       |
        |       v
        |   setChatFieldUpdates({ version, updates })
        |       |
        |       v
        |   EncounterForm useEffect detects new version
        |       |
        |       v
        |   setFormData(prev => ({ ...prev, ...updates }))
        |       |
        |       v
        |   Form fields visually update immediately
        |
        └── onUpdateCustomFields(customUpdates) → Page
                |
                v
            setChatCustomFieldUpdates({ version, updates })
                |
                v
            EncounterForm useEffect detects new version
                |
                v
            setCustomFieldValues(prev => ({ ...prev, ...updates }))
```

---

## 3. File Map

### New Files Created

| File | Purpose |
|------|---------|
| `apps/doctor/src/app/api/encounter-chat/route.ts` | Next.js API route. Receives messages + form state, calls GPT-4o, returns field updates. |
| `apps/doctor/src/hooks/useEncounterChat.ts` | React hook. Manages chat state, voice recording, transcription, API calls, and dispatches field updates. |
| `apps/doctor/src/components/medical-records/EncounterChatPanel.tsx` | UI component. Slide-in panel with message bubbles, text input, voice button, suggestion chips. |

### Modified Files

| File | Changes |
|------|---------|
| `apps/doctor/src/components/medical-records/EncounterForm.tsx` | Added `onFormDataChange`, `onCustomFieldValuesChange`, `chatFieldUpdates`, `chatCustomFieldUpdates` props. Added useEffects to apply chat updates and notify parent. |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/new/page.tsx` | Added chat panel toggle button ("Chat IA"), state management for chat panel, versioned update handlers, templateInfo builder, and EncounterChatPanel rendering. |

### Reused Files (Not Modified)

| File | How It's Used |
|------|---------------|
| `apps/doctor/src/hooks/useVoiceRecording.ts` | Browser audio recording via MediaRecorder API. |
| `apps/doctor/src/components/voice-assistant/chat/VoiceRecordButton.tsx` | Mic button with idle/recording/processing states. |
| `apps/doctor/src/app/api/voice/transcribe/route.ts` | Whisper API endpoint for audio-to-text. |
| `apps/doctor/src/constants/encounter-fields.ts` | `ENCOUNTER_FIELDS` array with field keys, labels, groups, visibility rules. |
| `apps/doctor/src/lib/medical-auth.ts` | `requireDoctorAuth()` for API authentication. |
| `apps/doctor/src/lib/api-error-handler.ts` | `handleApiError()` for standardized error responses. |

---

## 4. Data Flow - Text Input

Step-by-step flow when the doctor types a message and presses Enter:

1. **User types text** in the `<input>` inside `EncounterChatPanel`.
2. **Enter key or Send button** → `handleSend()` → `sendMessage(trimmedText)` (from `useEncounterChat`).
3. **Hook adds user message** to the `messages` state array (appears as a blue bubble in UI).
4. **Hook pushes to conversation history** (`conversationRef.current`) — this ref holds the full conversation sent to the API.
5. **Hook sets `isLoading = true`** → shows loading spinner in UI.
6. **Hook calls `POST /api/encounter-chat`** with:
   ```json
   {
     "messages": [{ "role": "user", "content": "presion arterial 120/80, temp 37.5" }],
     "currentFormData": { "encounterDate": "2026-02-08", "chiefComplaint": "", ... },
     "templateInfo": { "type": "standard", "fieldVisibility": { ... } }
   }
   ```
7. **API builds system prompt** dynamically based on `templateInfo` (standard or custom fields) and `currentFormData`.
8. **API calls OpenAI GPT-4o** with `response_format: { type: 'json_object' }` to ensure structured output.
9. **API returns:**
   ```json
   {
     "success": true,
     "data": {
       "message": "He actualizado la presion arterial y temperatura.",
       "action": "update_fields",
       "fieldUpdates": {
         "vitalsBloodPressure": "120/80",
         "vitalsTemperature": 37.5
       }
     }
   }
   ```
10. **Hook separates updates** into `standardUpdates` (keys in `STANDARD_KEYS` set) and `customUpdates` (everything else).
11. **Hook calls `onUpdateForm(standardUpdates)`** → this is `handleChatUpdateForm` in the page.
12. **Page increments `chatVersionRef`** and calls `setChatFieldUpdates({ version: N, updates })`.
13. **EncounterForm's useEffect** detects `chatFieldUpdates.version > lastChatVersionRef.current` → calls `setFormData(prev => ({ ...prev, ...updates }))`.
14. **Form fields update visually** — the textarea for blood pressure now shows "120/80", temperature shows 37.5.
15. **EncounterForm's `onFormDataChange` effect** fires → page's `currentFormData` state updates → next chat turn sees updated form state.
16. **Hook adds assistant message** to `messages` state with `actionSummary: "Se actualizaron 2 campos"` → gray bubble with green badge.

---

## 5. Data Flow - Voice Input

Step-by-step flow when the doctor uses voice input:

1. **Doctor presses mic button** → `voice.startRecording()` → `useVoiceRecording.startRecording()`.
2. **Browser requests microphone permission** via `navigator.mediaDevices.getUserMedia()`.
3. **MediaRecorder starts recording** with echo cancellation, noise suppression, and auto gain control.
4. **VoiceRecordButton shows recording state**: red pulsing indicator, duration timer (MM:SS), stop button.
5. **Doctor presses stop button** → `voice.stopRecording()` which calls `handleVoiceStop()`:
   ```js
   const handleVoiceStop = useCallback(() => {
     shouldAutoSendRef.current = true;  // Flag for auto-send
     voice.stopRecording();              // Triggers MediaRecorder.stop()
   }, [voice.stopRecording]);
   ```
6. **MediaRecorder's `onstop` event fires** asynchronously → creates audio `Blob` → sets `voice.audioBlob` and `voice.status = 'stopped'`.
7. **Auto-send useEffect triggers** (mirrors the working `useChatSession` pattern):
   ```js
   useEffect(() => {
     if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
       shouldAutoSendRef.current = false;
       processVoiceMessage(voice.audioBlob);
     }
   }, [voice.status, voice.audioBlob, processVoiceMessage]);
   ```
8. **`processVoiceMessage(blob)`** sets `isTranscribing = true` → shows "Transcribiendo..." in UI.
9. **Sends audio to `POST /api/voice/transcribe`** as `multipart/form-data` with field name `audio`.
10. **Whisper API transcribes** → returns `{ success: true, data: { transcript: "presion arterial 120 sobre 80..." } }`.
11. **Hook calls `sendMessageRef.current(transcript)`** — this is the latest `sendMessage` via ref, avoiding stale closures.
12. **From here, flow continues exactly as text input** (step 3 onwards in section 4).
13. **After completion**, `voice.resetRecording()` is called to clean up the recording state.

**Why `shouldAutoSendRef` instead of state?**
The existing working voice assistant (`useChatSession`) uses this exact pattern. Using a React state variable (`pendingTranscription`) caused race conditions where the state update re-rendered the component before the MediaRecorder's `onstop` callback had a chance to set the audioBlob. The ref avoids this by not triggering a re-render — instead, the effect naturally fires when `voice.status` and `voice.audioBlob` update from the recording hook.

---

## 6. API Endpoint: /api/encounter-chat

**File:** `apps/doctor/src/app/api/encounter-chat/route.ts`
**Method:** POST
**Authentication:** `requireDoctorAuth(request)` — requires valid doctor session cookie.

### Request Body

```typescript
{
  messages: { role: 'user' | 'assistant'; content: string }[];
  currentFormData: Record<string, any>;  // Current form field values
  templateInfo: {
    type: 'standard' | 'custom';
    name?: string;
    fieldVisibility?: Record<string, boolean>;  // For standard templates
    customFields?: {                             // For custom templates
      name: string;
      label: string;
      type: string;
      options?: string[];
    }[];
  };
}
```

### Response

```typescript
// Success
{
  success: true,
  data: {
    message: string;          // Conversational response in Spanish
    action: 'update_fields' | 'no_change';
    fieldUpdates?: Record<string, any>;  // Only when action = 'update_fields'
  }
}

// Error
{
  success: false,
  error: {
    code: 'INVALID_REQUEST' | 'CHAT_FAILED' | 'RATE_LIMITED';
    message: string;
  }
}
```

### System Prompt Construction

The `buildSystemPrompt()` function dynamically adapts based on `templateInfo.type`:

**For standard templates:**
- Reads `ENCOUNTER_FIELDS` from `@/constants/encounter-fields.ts`
- Filters by `fieldVisibility` (always includes fields with `canHide === false`)
- Lists each field as `- "key": labelEs (label)` (e.g., `- "chiefComplaint": Motivo de Consulta (Chief Complaint)`)

**For custom templates:**
- Lists each custom field as `- "name" (type): label [opciones: ...]`

**Both include:**
- The current form state as JSON
- Instructions for response format (JSON with `message`, `action`, `fieldUpdates`)
- 11 rules covering: when to update vs no_change, numeric format for vitals, blood pressure format, date format, ambiguity handling, Spanish language, conciseness

### OpenAI Configuration

| Setting | Value |
|---------|-------|
| Model | `gpt-4o` |
| Temperature | `0.2` (low for consistent structured output) |
| Max tokens | `4096` |
| Response format | `{ type: 'json_object' }` (enforces valid JSON) |

### Safety: Null Content Filtering

Messages with `null` or empty `content` are filtered out before sending to OpenAI:
```js
messages.filter((msg) => msg.content != null && msg.content !== '')
```
This prevents the OpenAI API from returning a 400 error ("expected a string, got null") when the conversation history contains messages from previous responses where the LLM returned `null` for the `message` field.

---

## 7. Hook: useEncounterChat

**File:** `apps/doctor/src/hooks/useEncounterChat.ts`
**Export:** `useEncounterChat(options)`

### Input Options

```typescript
interface UseEncounterChatOptions {
  currentFormData: EncounterFormData;                         // Live form state
  onUpdateForm: (updates: Partial<EncounterFormData>) => void; // Callback for standard field updates
  templateInfo: TemplateInfo;                                  // Template configuration for API
  onUpdateCustomFields?: (updates: Record<string, any>) => void; // Callback for custom field updates
}
```

### Return Value

```typescript
{
  messages: EncounterChatMessage[];   // Chat message history for UI
  isLoading: boolean;                  // True while waiting for AI response
  isTranscribing: boolean;             // True while audio is being transcribed
  sendMessage: (text: string) => Promise<void>;  // Send a text message
  clearChat: () => void;               // Clear all messages and history
  voice: {
    isRecording: boolean;              // True while mic is active
    isProcessing: boolean;             // True while transcribing (same as isTranscribing)
    duration: string;                  // Formatted recording duration "MM:SS"
    startRecording: () => Promise<void>;
    stopRecording: () => void;         // Stops recording + triggers auto-send
    cancelRecording: () => void;       // Stops recording without sending
  };
}
```

### Standard vs Custom Field Separation

When the AI returns `fieldUpdates`, the hook separates them using a hardcoded `STANDARD_KEYS` set:

```typescript
const STANDARD_KEYS = new Set([
  'encounterDate', 'encounterType', 'chiefComplaint', 'location',
  'clinicalNotes', 'subjective', 'objective', 'assessment', 'plan',
  'vitalsBloodPressure', 'vitalsHeartRate', 'vitalsTemperature',
  'vitalsWeight', 'vitalsHeight', 'vitalsOxygenSat', 'vitalsOther',
  'followUpDate', 'followUpNotes', 'status',
]);
```

- Keys in `STANDARD_KEYS` → `onUpdateForm(standardUpdates)` → patches `EncounterFormData`
- Keys NOT in `STANDARD_KEYS` → `onUpdateCustomFields(customUpdates)` → patches custom template field values

### Conversation History Management

- `conversationRef` (useRef) holds the API conversation history. It's a ref (not state) to avoid unnecessary re-renders.
- User messages are always pushed to the history.
- Assistant messages are only pushed if `message` is non-empty (guards against null responses).
- `clearChat()` resets both the UI messages state and the conversation ref.

---

## 8. Component: EncounterChatPanel

**File:** `apps/doctor/src/components/medical-records/EncounterChatPanel.tsx`
**Export:** `EncounterChatPanel`

### Props

```typescript
interface EncounterChatPanelProps {
  onClose: () => void;
  currentFormData: EncounterFormData;
  onUpdateForm: (updates: Partial<EncounterFormData>) => void;
  templateInfo: TemplateInfo;
  onUpdateCustomFields?: (updates: Record<string, any>) => void;
}
```

### Layout

- **Position:** `fixed right-0 top-0 bottom-0` with `z-50` — overlays the right side of the page.
- **Width:** `w-80 sm:w-96` (320px mobile, 384px desktop).
- **Structure:** Header (indigo) → Messages area (scrollable) → Input area (bottom).

### Subcomponents

**Header:**
- Sparkles icon + "Chat IA" title
- "Limpiar" button (only shows when there are messages) — clears conversation
- X close button

**Messages area:**
- Empty state: Sparkles icon, description text, 3 suggestion chip buttons
- Message list: `MessageBubble` components for each message
- Loading indicator: Bot avatar + spinner with "Transcribiendo..." or "Pensando..."

**MessageBubble:**
- User messages: blue background, right-aligned, User icon
- Assistant messages: gray background, left-aligned, Bot icon
- Action summary badge: green pill below assistant messages (e.g., "Se actualizaron 3 campos")
- `renderContent()`: Simple markdown renderer supporting **bold**, bullet lists, numbered lists

**Input area:**
- `VoiceRecordButton` (left) — mic button with recording states
- Text input (center) — rounded, sends on Enter
- Send button (right) — blue circle, disabled when empty or busy

### Suggestion Chips

Three predefined suggestions shown in the empty state:
1. "Motivo: dolor de cabeza severo"
2. "Presion arterial 120/80, temperatura 37"
3. "Diagnostico: migrana sin aura"

Clicking a suggestion immediately sends it as a message.

---

## 9. Form Integration: EncounterForm Changes

**File:** `apps/doctor/src/components/medical-records/EncounterForm.tsx`

### New Props Added

```typescript
onFormDataChange?: (data: EncounterFormData) => void;
onCustomFieldValuesChange?: (values: Record<string, any>) => void;
chatFieldUpdates?: { version: number; updates: Partial<EncounterFormData> } | null;
chatCustomFieldUpdates?: { version: number; updates: Record<string, any> } | null;
```

### New useEffects Added

**1. Notify parent of form data changes:**
```js
useEffect(() => {
  onFormDataChange?.(formData);
}, [formData, onFormDataChange]);
```
Fires whenever `formData` changes (user typing, voice data, chat updates). Keeps the page's `currentFormData` in sync so the chat panel always sees the latest form state.

**2. Notify parent of custom field value changes:**
```js
useEffect(() => {
  onCustomFieldValuesChange?.(customFieldValues);
}, [customFieldValues, onCustomFieldValuesChange]);
```

**3. Apply chat field updates directly (versioned):**
```js
const lastChatVersionRef = useRef(0);
useEffect(() => {
  if (chatFieldUpdates && chatFieldUpdates.version > lastChatVersionRef.current) {
    lastChatVersionRef.current = chatFieldUpdates.version;
    setFormData((prev) => ({ ...prev, ...chatFieldUpdates.updates }));
  }
}, [chatFieldUpdates]);
```

**4. Apply chat custom field updates directly (versioned):**
```js
const lastCustomChatVersionRef = useRef(0);
useEffect(() => {
  if (chatCustomFieldUpdates && chatCustomFieldUpdates.version > lastCustomChatVersionRef.current) {
    lastCustomChatVersionRef.current = chatCustomFieldUpdates.version;
    setCustomFieldValues((prev) => ({ ...prev, ...chatCustomFieldUpdates.updates }));
  }
}, [chatCustomFieldUpdates]);
```

### Why Not Use initialData for Chat Updates?

The existing `initialData` prop and its `useEffect` were designed for one-time voice assistant data sync. It uses `||` and `??` operators which can skip falsy values, and the reference equality checks make it unreliable for incremental updates. The versioned `chatFieldUpdates` mechanism bypasses this entirely — it directly patches `formData` via `setFormData(prev => ({ ...prev, ...updates }))`, guaranteeing every update is applied exactly once.

---

## 10. Page Integration: New Encounter Page Changes

**File:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/new/page.tsx`

### New State Variables

```typescript
const [chatPanelOpen, setChatPanelOpen] = useState(false);
const [currentFormData, setCurrentFormData] = useState<EncounterFormData | null>(null);
const [currentCustomFieldValues, setCurrentCustomFieldValues] = useState<Record<string, any>>({});
const [chatFieldUpdates, setChatFieldUpdates] = useState<{ version: number; updates: Partial<EncounterFormData> } | null>(null);
const [chatCustomFieldUpdates, setChatCustomFieldUpdates] = useState<{ version: number; updates: Record<string, any> } | null>(null);
const chatVersionRef = useRef(0);
```

### New Callbacks

**handleChatUpdateForm:**
```js
const handleChatUpdateForm = useCallback((updates: Partial<EncounterFormData>) => {
  chatVersionRef.current += 1;
  setChatFieldUpdates({ version: chatVersionRef.current, updates });
}, []);
```

**handleChatUpdateCustomFields:**
```js
const handleChatUpdateCustomFields = useCallback((updates: Record<string, any>) => {
  chatVersionRef.current += 1;
  setChatCustomFieldUpdates({ version: chatVersionRef.current, updates });
}, []);
```

### Template Info Builder

Builds the `chatTemplateInfo` object passed to the chat panel, adapting to the selected template:

```js
const chatTemplateInfo: TemplateInfo = selectedTemplate
  ? selectedTemplate.isCustom
    ? {
        type: 'custom',
        name: selectedTemplate.name,
        customFields: selectedTemplate.customFields?.map((f) => ({
          name: f.name,
          label: f.label || f.labelEs,
          type: f.type,
          options: f.options,
        })),
      }
    : {
        type: 'standard',
        name: selectedTemplate.name,
        fieldVisibility: selectedTemplate.fieldVisibility,
      }
  : { type: 'standard' };
```

### UI: Chat IA Button

Added next to the existing "Asistente de Voz" button in the page header:

```jsx
<button
  onClick={() => setChatPanelOpen((prev) => !prev)}
  className={`... ${chatPanelOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 text-white'}`}
>
  <Sparkles className="w-5 h-5" />
  Chat IA
</button>
```

The button toggles between active (indigo outline) and inactive (indigo solid) states. It's always visible, unlike the voice assistant button which hides after data is confirmed.

### Chat Panel Rendering

```jsx
{chatPanelOpen && currentFormData && (
  <EncounterChatPanel
    onClose={() => setChatPanelOpen(false)}
    currentFormData={currentFormData}
    onUpdateForm={handleChatUpdateForm}
    templateInfo={chatTemplateInfo}
    onUpdateCustomFields={handleChatUpdateCustomFields}
  />
)}
```

The panel only renders when `currentFormData` is available (set by `onFormDataChange` from the form's first render).

---

## 11. Template Adaptation (Standard vs Custom)

### Standard Templates

When a standard template (or no template) is selected:
- `templateInfo.type = 'standard'`
- The API system prompt lists all `ENCOUNTER_FIELDS` filtered by `fieldVisibility`
- The LLM returns field keys matching `EncounterFormData` properties (e.g., `chiefComplaint`, `vitalsBloodPressure`)
- Updates go through `onUpdateForm` → `chatFieldUpdates` → `setFormData`

### Custom Templates

When a custom template (`isCustom === true`) is selected:
- `templateInfo.type = 'custom'`
- The API system prompt lists custom field definitions with their names, types, labels, and options
- The LLM returns field keys matching the custom field names
- Updates go through `onUpdateCustomFields` → `chatCustomFieldUpdates` → `setCustomFieldValues`
- The `DynamicFieldRenderer` component in the form reflects the updated custom field values

---

## 12. Versioned Update Mechanism

The versioned update pattern prevents duplicate or missed updates:

```
Page: chatVersionRef.current = 0

Chat update 1: { chiefComplaint: "dolor" }
  → chatVersionRef.current = 1
  → setChatFieldUpdates({ version: 1, updates: { chiefComplaint: "dolor" } })
  → Form useEffect: 1 > 0? Yes → apply, set lastChatVersionRef = 1

Chat update 2: { vitalsTemperature: 37.5 }
  → chatVersionRef.current = 2
  → setChatFieldUpdates({ version: 2, updates: { vitalsTemperature: 37.5 } })
  → Form useEffect: 2 > 1? Yes → apply, set lastChatVersionRef = 2

(Re-render with same version 2)
  → Form useEffect: 2 > 2? No → skip (prevents duplicate application)
```

This is more robust than relying on object reference equality or the `initialData` sync chain.

---

## 13. Voice Recording Pipeline

The voice pipeline reuses the existing `useVoiceRecording` hook and `VoiceRecordButton` component. The key integration pattern mirrors `useChatSession` (the working voice assistant):

### MediaRecorder Configuration

```js
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
});
```

### MIME Type Detection

The hook auto-detects the best supported MIME type:
1. `audio/webm;codecs=opus` (Chrome, Edge, Firefox)
2. `audio/webm` (fallback)
3. `audio/mp4` (Safari)
4. `audio/ogg;codecs=opus`

### Transcription

Audio is sent to `POST /api/voice/transcribe` which uses OpenAI Whisper (`whisper-1` model) with:
- Language: Spanish (`es`)
- Response format: `verbose_json` (includes duration, language detection)
- Max file size: 25MB
- The endpoint auto-detects the actual audio format from file headers (webm, ogg, mp3)

### Max Recording Duration

Set to 120 seconds (2 minutes) for the chat panel, vs 600 seconds (10 minutes) for the full voice assistant. This is intentional — chat messages should be short and focused.

---

## 14. Error Handling

### API-Level Errors

| Error | HTTP Status | Code | User Message |
|-------|------------|------|-------------|
| No messages provided | 400 | `INVALID_REQUEST` | "Se requiere al menos un mensaje" |
| OpenAI rate limited | 429 | `RATE_LIMITED` | "Demasiadas solicitudes. Intente de nuevo en unos momentos." |
| Network error | 503 | `CHAT_FAILED` | "Error de conexion. Verifique su internet e intente nuevamente." |
| JSON parse failure | 500 | `CHAT_FAILED` | "Error al procesar la respuesta del modelo" |
| No model response | 500 | `CHAT_FAILED` | "No se recibio respuesta del modelo" |

### Hook-Level Errors

- **API call fails (network error):** Shows assistant message "Lo siento, no pude conectarme con el servidor."
- **API returns `success: false`:** Shows assistant message with the error message from the API.
- **Transcription fails:** Shows assistant message "No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje."
- **Null message from LLM:** Defaults to empty string `''`, not pushed to conversation history.

### Defensive Measures

- `renderContent()` in the UI component guards against `undefined`/`null` text.
- Messages with null/empty content are filtered before sending to OpenAI.
- The `message` field destructures with a default: `const { message = '', action, fieldUpdates } = json.data`.

---

## 15. Relationship to Existing Voice Assistant

| Feature | Voice Assistant (Existing) | AI Chat Panel (New) |
|---------|---------------------------|---------------------|
| **Entry point** | "Asistente de Voz" button | "Chat IA" button |
| **UI pattern** | Modal → Sidebar → Confirm | Slide-in panel (always open) |
| **Confirmation** | Required ("Confirmar" step) | Not required (immediate injection) |
| **Recording flow** | Record → Process → Sidebar review → Confirm → Fill form | Record → Transcribe → AI → Inject fields |
| **Multi-turn** | Yes (sidebar chat for refinement) | Yes (continuous conversation) |
| **Text input** | Yes (in sidebar) | Yes (primary input) |
| **Coexistence** | Independent | Independent |
| **Button visibility** | Hides after data confirmed | Always visible (toggles) |
| **Max recording** | 10 minutes | 2 minutes |

Both features can coexist on the same page. Using one does not disable the other.

---

## 16. Reused Components and Hooks

| Component/Hook | Original Location | How Reused |
|----------------|-------------------|-----------|
| `useVoiceRecording` | `hooks/useVoiceRecording.ts` | Audio recording with MediaRecorder API |
| `formatDuration` | `hooks/useVoiceRecording.ts` | Format seconds to "MM:SS" string |
| `VoiceRecordButton` | `components/voice-assistant/chat/VoiceRecordButton.tsx` | Mic button with 3 visual states |
| `ENCOUNTER_FIELDS` | `constants/encounter-fields.ts` | Field definitions for system prompt |
| `requireDoctorAuth` | `lib/medical-auth.ts` | API authentication |
| `handleApiError` | `lib/api-error-handler.ts` | Standardized error responses |
| `/api/voice/transcribe` | `app/api/voice/transcribe/route.ts` | Whisper transcription endpoint |

The `AIChatPanel` component from the FormBuilder was used as a **design reference** but NOT directly reused — the encounter version has different props, voice input, and a different hook.

---

## 17. UI States and Interactions

### Chat Panel States

| State | Visual |
|-------|--------|
| **Empty** | Sparkles icon, description, 3 suggestion chips |
| **Has messages** | Message bubbles (blue=user, gray=assistant), green action badges |
| **Loading (AI thinking)** | Bot avatar + spinning loader + "Pensando..." |
| **Transcribing** | Bot avatar + spinning loader + "Transcribiendo..." |
| **Voice recording** | Red pulsing dot + duration timer + stop/cancel buttons |

### Button States

| Button | Enabled | Disabled |
|--------|---------|----------|
| **Chat IA (header)** | Always | Never |
| **Send** | Text is non-empty AND not loading/transcribing | Empty text OR loading |
| **Mic** | Not loading AND not transcribing | Loading OR transcribing |
| **Limpiar** | Messages exist | No messages (hidden) |

---

## 18. LLM System Prompt Details

The system prompt has 4 sections:

### 1. Role Description
```
Eres un asistente de IA que ayuda a doctores a llenar formularios de consultas medicas.
El doctor describe informacion del paciente en lenguaje natural y tu extraes los datos
para actualizar los campos del formulario.
```

### 2. Available Fields (Dynamic)
Lists all form fields the LLM can update, with their programmatic key and Spanish label.

### 3. Current Form State
The entire `currentFormData` serialized as JSON. This lets the LLM know what's already filled in, enabling it to append to existing text fields or avoid overwriting data.

### 4. Rules (11 total)
1. Extract values from natural language → `action: "update_fields"`
2. Only include mentioned/inferable fields in `fieldUpdates`
3. Questions without data → `action: "no_change"`
4. Numeric vitals: numbers only, no units
5. Blood pressure: "120/80" format
6. Dates: "YYYY-MM-DD" format
7. Ambiguous input: ask for clarification, use `no_change`
8. Always respond in professional medical Spanish
9. Be concise — briefly confirm updated fields
10. Long text fields: append or replace based on context
11. Custom template fields: use exact field names from definition

---

## 19. Known Considerations

1. **No offline support.** Requires internet for both Whisper (transcription) and GPT-4o (field extraction).
2. **OpenAI API costs.** Each message costs ~0.01-0.05 USD (GPT-4o input+output tokens). Voice adds ~0.006 USD/minute (Whisper).
3. **Latency.** Voice flow has two API calls (transcribe + chat), adding 2-5 seconds total.
4. **LLM may return unexpected field names.** If the LLM uses a Spanish key instead of the programmatic key (e.g., "motivoConsulta" instead of "chiefComplaint"), the update would go to `customUpdates` and be silently ignored for standard templates.
5. **No undo.** Field updates are applied immediately. The doctor must manually fix incorrect values.
6. **Panel overlaps content.** The fixed-position panel covers the right side of the form. On narrow screens, this may obscure form fields.

---

## 20. Testing Checklist

1. Open `/dashboard/medical-records/patients/[id]/encounters/new`
2. Click "Chat IA" button → panel opens on the right
3. Type "motivo de consulta: dolor de cabeza severo" → `chiefComplaint` field updates
4. Type "presion arterial 120/80, temperatura 37, peso 75" → vitals fields update
5. Use voice: press mic, speak "frecuencia cardiaca 80, saturacion de oxigeno 98" → after transcription, vitals update
6. Verify the form shows all updated values
7. Edit a form field manually → next chat turn should see the manual edit in context
8. Type a question "que campos faltan?" → AI responds with no_change, lists empty fields
9. Click "Limpiar" → chat history clears, form retains all data
10. Close panel → form retains all data, save works normally
11. Switch template → panel adapts to new template fields
12. Select a custom template → chat uses custom field names
13. Existing "Asistente de Voz" button still works independently
14. Test with slow network → loading states appear correctly
15. Test with invalid audio (silence) → error message appears in chat
