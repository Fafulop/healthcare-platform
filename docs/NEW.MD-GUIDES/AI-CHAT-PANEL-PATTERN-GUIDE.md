# AI Chat Panel Pattern - Complete Architecture & Replication Guide

**Purpose:** This document describes in extreme detail the AI Chat Panel pattern implemented in both the Prescriptions (`/new` prescription page) and Pendientes/Tasks (`/new` task page). It serves as the definitive reference for replicating this pattern in any other form-based page in the application.

**Date Created:** February 15, 2026
**Implemented In:**
- Prescriptions: `/dashboard/medical-records/patients/[id]/prescriptions/new`
- Pendientes (Tasks): `/dashboard/pendientes/new`

**Related Features:** Voice Assistant (Asistente de Voz), Encounter AI Chat Panel, FormBuilder AI Chat Panel

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [File Map & Naming Convention](#3-file-map--naming-convention)
4. [The 3+1 File Pattern](#4-the-31-file-pattern)
5. [File 1: API Route (`/api/<feature>-chat/route.ts`)](#5-file-1-api-route)
6. [File 2: Hook (`use<Feature>Chat.ts`)](#6-file-2-hook)
7. [File 3: Panel Component (`<Feature>ChatPanel.tsx`)](#7-file-3-panel-component)
8. [File 4: Page Integration (Existing Page Modification)](#8-file-4-page-integration)
9. [Data Flow - Text Input](#9-data-flow---text-input)
10. [Data Flow - Voice Input](#10-data-flow---voice-input)
11. [LLM System Prompt Architecture](#11-llm-system-prompt-architecture)
12. [Few-Shot Examples (Pre-Prompt)](#12-few-shot-examples-pre-prompt)
13. [JSON Response Format](#13-json-response-format)
14. [Field Updates vs List Actions (Flat + Nested)](#14-field-updates-vs-list-actions-flat--nested)
15. [Batch/Multi-Item Support (Tasks Pattern)](#15-batchmulti-item-support-tasks-pattern)
16. [Voice Recording Pipeline](#16-voice-recording-pipeline)
17. [UI Component Anatomy](#17-ui-component-anatomy)
18. [Drag, Collapse & Responsive Behavior](#18-drag-collapse--responsive-behavior)
19. [Error Handling](#19-error-handling)
20. [Relationship to Existing Voice Assistant](#20-relationship-to-existing-voice-assistant)
21. [Step-by-Step Replication Checklist](#21-step-by-step-replication-checklist)
22. [Complete Code Examples](#22-complete-code-examples)
23. [Testing Checklist](#23-testing-checklist)
24. [Known Considerations](#24-known-considerations)

---

## 1. Feature Overview

The AI Chat Panel is a slide-in panel on the right side of a form page. It allows the doctor to describe data in natural language (text or voice), and an AI (GPT-4o) extracts structured field values and injects them directly into the form — no confirmation step required.

### What it does:

- **Single-item form filling:** The doctor describes one item (e.g., a medication, a task) and the AI populates the corresponding form fields immediately.
- **Multi-item/batch creation (Tasks pattern):** The doctor describes multiple items in one message (e.g., "crea 3 tareas: ..."), and the AI returns actions that accumulate items in a batch list. The doctor can then review and create them all at once.
- **Conversational context:** The chat maintains full conversation history, so the doctor can iteratively refine data across multiple messages.
- **Voice input:** Press mic, speak, audio is transcribed via Whisper, transcribed text is sent to the AI — same pipeline as text.

### Key design decisions:

- **Immediate form injection:** No "Confirmar" dialog. The AI response is applied directly to form state.
- **Coexists with Voice Assistant:** The Chat IA button appears alongside the (now disabled) Asistente de Voz button. Both features exist in the UI but Chat IA is the active one.
- **Conversation persists:** Messages stay in the panel until the user clears them or closes the panel. Reopening preserves messages (they're in React state).
- **Pre-prompt pattern:** Every API call sends a system prompt + few-shot example BEFORE the user's actual messages, ensuring consistent JSON output from the very first interaction.

---

## 2. Architecture Diagram

```
Doctor speaks/types
        |
        v
  [ChatPanel Component]
     |            |
     | (text)     | (voice)
     v            v
     |      [useVoiceRecording]
     |            |
     |            v
     |      POST /api/voice/transcribe
     |            |
     |            v (transcript text)
     |<-----------+
     |
     v
  [useFeatureChat hook]
     |
     v
  POST /api/<feature>-chat
     |
     +-- body: { messages[], currentFormData, [accumulatedItems] }
     |
     v
  [API Route Handler]
     |
     +-- requireDoctorAuth(request)
     +-- buildSystemPrompt(currentFormData, [...])
     +-- chatMessages = [system, fewShot, ...userMessages]
     +-- getChatProvider().chatCompletion(chatMessages, { jsonMode: true })
     +-- JSON.parse(response)
     |
     v
  { message, action, fieldUpdates, <itemActions> }
     |
     v
  [useFeatureChat hook processes response]
     |
     +-- If fieldUpdates: call onUpdateFields(updates) -> form state updates
     +-- If itemActions: call apply<Item>Actions() -> onUpdateItems(newList)
     +-- Build actionSummary string
     +-- Append assistant message to chat
     |
     v
  [Form re-renders with new values]
```

---

## 3. File Map & Naming Convention

### Prescriptions Implementation

| File | Purpose |
|------|---------|
| `apps/doctor/src/app/api/prescription-chat/route.ts` | API endpoint |
| `apps/doctor/src/hooks/usePrescriptionChat.ts` | React hook |
| `apps/doctor/src/components/medical-records/PrescriptionChatPanel.tsx` | UI panel |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/prescriptions/new/page.tsx` | Page (modified) |

### Tasks/Pendientes Implementation

| File | Purpose |
|------|---------|
| `apps/doctor/src/app/api/task-chat/route.ts` | API endpoint |
| `apps/doctor/src/hooks/useTaskChat.ts` | React hook |
| `apps/doctor/src/components/tasks/TaskChatPanel.tsx` | UI panel |
| `apps/doctor/src/app/dashboard/pendientes/new/page.tsx` | Page (modified) |

### Naming Convention

When replicating for a new feature `<Feature>`:

```
API route:     /app/api/<feature>-chat/route.ts
Hook:          /hooks/use<Feature>Chat.ts
Panel:         /components/<feature-area>/<Feature>ChatPanel.tsx
```

---

## 4. The 3+1 File Pattern

Every Chat IA implementation consists of **3 new files** and **1 modified file**:

### New Files:
1. **API Route** — Server-side: builds system prompt, calls LLM, returns structured JSON
2. **Hook** — Client-side: manages chat state, sends messages, processes responses, handles voice
3. **Panel Component** — UI: renders messages, input bar, voice button, suggestions, batch list

### Modified File:
4. **Existing Page** — Adds: state for chat panel, computed form data, callbacks, button, panel render

---

## 5. File 1: API Route

**Location:** `apps/doctor/src/app/api/<feature>-chat/route.ts`

### Structure

```typescript
// Imports
import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';

// Constants
const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;  // Low temp for structured extraction

// System prompt builder
function buildSystemPrompt(currentFormData: Record<string, any>, ...otherContext) {
  return `...`;  // See Section 11
}

// Route handler
export async function POST(request: NextRequest) {
  // 1. Auth check
  const { doctorId } = await requireDoctorAuth(request);

  // 2. Parse body
  const { messages, currentFormData, ...extra } = await request.json();

  // 3. Validate
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ success: false, error: {...} }, { status: 400 });
  }

  // 4. Build messages array: system + few-shot + user messages
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(currentFormData, ...extra) },
    // Few-shot example (see Section 12)
    { role: 'user', content: '...' },
    { role: 'assistant', content: JSON.stringify({...}) },
    // Real conversation
    ...messages.filter(m => m.content).map(m => ({ role: m.role, content: m.content })),
  ];

  // 5. Call LLM
  const responseText = await getChatProvider().chatCompletion(chatMessages, {
    model: MODEL,
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
    jsonMode: true,  // CRITICAL: forces JSON output
  });

  // 6. Parse JSON response
  const parsed = JSON.parse(responseText);

  // 7. Return
  return NextResponse.json({ success: true, data: parsed });
}
```

### Key points:
- **`jsonMode: true`** — This forces the LLM to return valid JSON. Without this, the model may return markdown or mixed content.
- **`temperature: 0.2`** — Low temperature ensures consistent, predictable field extraction. Higher values cause hallucination.
- **`requireDoctorAuth`** — Every chat endpoint requires authentication. The `doctorId` is logged but not sent to the LLM.
- **Error handling** — Catches 429 (rate limit), ECONNREFUSED/ETIMEDOUT (network), and falls back to `handleApiError`.

---

## 6. File 2: Hook

**Location:** `apps/doctor/src/hooks/use<Feature>Chat.ts`

### Exports

```typescript
// Types
export interface <Feature>ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;  // e.g., "Se actualizaron 3 campos y 2 medicamentos"
}

export interface <Feature>FormData {
  // Mirrors the page's form state (only the fields the AI can update)
}

// Hook
export function use<Feature>Chat(options: Use<Feature>ChatOptions) {
  // Returns:
  return {
    messages,        // ChatMessage[] - full chat history
    isLoading,       // boolean - waiting for LLM response
    isTranscribing,  // boolean - waiting for Whisper transcription
    sendMessage,     // (text: string) => Promise<void>
    clearChat,       // () => void
    voice: {
      isRecording,     // boolean
      isProcessing,    // boolean (same as isTranscribing)
      duration,        // string - formatted "0:23"
      startRecording,  // () => void
      stopRecording,   // () => void
      cancelRecording, // () => void
    },
  };
}
```

### Options Interface

```typescript
interface Use<Feature>ChatOptions {
  currentFormData: <Feature>FormData;          // Current form state (read on each send)
  onUpdateFields: (updates: Record<string, any>) => void;  // Callback to update flat fields
  onUpdate<Items>: (items: <Item>[]) => void;  // Callback to update list items (medications, tasks, etc.)
  // For batch pattern (tasks):
  accumulated<Items>?: <Item>[];               // Current batch list state
}
```

### Internal Mechanics

1. **`conversationRef`** — A `useRef<ApiConversationMessage[]>` that accumulates all messages sent to the API. This is separate from `messages` state (which includes UI-only data like `actionSummary`).

2. **`sendMessage(text)`:**
   - Adds user message to UI (`setMessages`)
   - Adds to `conversationRef`
   - POSTs to `/api/<feature>-chat` with `{ messages: conversationRef.current, currentFormData, ... }`
   - Parses response
   - Calls `onUpdateFields` / `onUpdate<Items>` based on response
   - Builds `actionSummary` string
   - Adds assistant message to UI

3. **`applyItemActions(currentItems, actions)`** — Pure function that applies add/update/remove/replace_all operations:

```typescript
function applyItemActions(current: Item[], actions: ItemAction[]): Item[] {
  let result = [...current];
  for (const action of actions) {
    switch (action.type) {
      case 'add':         result.push(normalizeItem(action.item)); break;
      case 'update':      result[action.index] = { ...result[action.index], ...action.updates }; break;
      case 'remove':      result = result.filter((_, i) => i !== action.index); break;
      case 'replace_all': result = action.items.map(normalizeItem); break;
    }
  }
  return result;
}
```

4. **Resilient action check** — The hook does NOT solely rely on `action === 'update_fields'`. It uses:
```typescript
if (action !== 'no_change' || hasFieldUpdates || hasTaskActions) {
  // Apply updates
}
```
This handles edge cases where the LLM returns `no_change` but still includes field updates.

5. **`actionSummary`** — After applying updates, the hook builds a human-readable string like "Se actualizaron 2 campo(s) y 1 tarea(s)" which appears as a green badge below the assistant message.

### Voice Integration

The hook integrates voice recording through `useVoiceRecording`:

```typescript
const voice = useVoiceRecording({ maxDuration: 120 });  // 2 min max
```

Voice flow:
1. User presses mic → `voice.startRecording()`
2. User stops → `handleVoiceStop()` sets `shouldAutoSendRef = true`, calls `voice.stopRecording()`
3. `useEffect` detects `voice.status === 'stopped'` + `audioBlob` exists + `shouldAutoSendRef` → calls `processVoiceMessage(audioBlob)`
4. `processVoiceMessage`:
   - Sets `isTranscribing = true`
   - POSTs audio blob to `/api/voice/transcribe`
   - On success: calls `sendMessageRef.current(transcript)` (which triggers the normal chat flow)
   - On failure: adds error message to chat
   - Resets recording state

### ID Generation

Each message gets a unique ID via:
```typescript
let _counter = 0;
function generateId(): string {
  _counter++;
  return `<feature>_chat_${Date.now()}_${_counter}`;
}
```
This is module-level to ensure uniqueness across re-renders.

---

## 7. File 3: Panel Component

**Location:** `apps/doctor/src/components/<feature-area>/<Feature>ChatPanel.tsx`

### Props Interface

```typescript
interface <Feature>ChatPanelProps {
  onClose: () => void;
  currentFormData: <Feature>FormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdate<Items>: (items: <Item>[]) => void;
  // For batch pattern:
  accumulated<Items>?: <Item>[];
  onCreateBatch?: () => void;
}
```

### Component Structure

```
<div> (fixed position panel)
  ├── Drag handle (mobile only, hidden on sm+)
  ├── Header
  │   ├── Sparkles icon + "Chat IA" label
  │   ├── Message count badge (when collapsed)
  │   ├── "Limpiar" button (clear chat)
  │   ├── Collapse/Expand button (Minus/ChevronUp)
  │   └── Close button (X)
  ├── Messages area (scrollable)
  │   ├── Empty state (when no messages)
  │   │   ├── Sparkles icon
  │   │   ├── Title: "Asistente de <feature>"
  │   │   ├── Description text
  │   │   └── Suggestion buttons (3 predefined)
  │   ├── Message bubbles
  │   │   ├── User: blue bubble, right-aligned, User icon
  │   │   └── Assistant: gray bubble, left-aligned, Bot icon + action badge
  │   ├── Loading indicator (Loader2 spinner + "Pensando..." / "Transcribiendo...")
  │   └── Batch list (Tasks pattern only, when accumulatedTasks.length > 0)
  │       ├── BatchTaskList component
  │       └── "Crear X Pendientes" button
  └── Input area
      ├── VoiceRecordButton
      ├── Text input
      └── Send button
```

### Suggestions

Each implementation has 3 domain-specific suggestions:

**Prescriptions:**
```typescript
const SUGGESTIONS = [
  'Receta: Paracetamol 500mg cada 8 horas por 5 dias',
  'Diagnostico: infeccion respiratoria aguda',
  'Agrega Amoxicilina 500mg cada 8 horas por 7 dias',
];
```

**Tasks:**
```typescript
const SUGGESTIONS = [
  'Revisar resultados de laboratorio manana',
  'Llamar al paciente Garcia el viernes a las 10',
  'Crea 3 tareas: seguimiento Lopez, revisar radiografia, llamar farmacia',
];
```

### Markdown Rendering

The panel includes a `renderContent(text)` function that parses basic markdown:
- `**bold**` → `<strong>`
- Lines starting with `- ` or `* ` → `<li>` with `list-disc`
- Lines starting with `1. ` → `<li>` with `list-decimal`
- Empty lines → `<br>`
- Everything else → `<p>`

This is the same function across all chat panels (copy-pasted, not shared).

### CSS Classes (Fixed Position Panel)

```
Expanded:
- Mobile: inset-x-0 bottom-0, height: {panelHeight}vh, rounded-t-2xl
- Desktop: right-0 top-0 bottom-0, width: 24rem (sm:w-96), full height

Collapsed:
- Mobile: inset-x-0 bottom-0, height: auto
- Desktop: right-0 bottom-0, width: 24rem, height: auto

z-index: 60 (above most UI, below modals)
```

---

## 8. File 4: Page Integration

**What changes in the existing page:**

### A. New Imports

```typescript
import { Sparkles } from 'lucide-react';
import { <Feature>ChatPanel } from '@/components/<area>/<Feature>ChatPanel';
import type { <Feature>FormData } from '@/hooks/use<Feature>Chat';
// If batch pattern:
import type { Voice<Item>Data } from '@/types/voice-assistant';
```

Also add `useMemo` to the React import if not already there.

### B. New State

```typescript
const [chatPanelOpen, setChatPanelOpen] = useState(false);
// If batch pattern:
const [accumulatedItems, setAccumulatedItems] = useState<VoiceItemData[]>([]);
```

### C. Computed Form Data

```typescript
const chatFormData: <Feature>FormData = useMemo(() => ({
  field1: form.field1,
  field2: form.field2,
  // ... all fields the AI can update
  // For prescriptions, includes medications array
}), [form.field1, form.field2, ...]);
```

This `useMemo` ensures the form data object is stable and only re-created when actual field values change.

### D. Callbacks

```typescript
// Flat field updates
const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
  // PRESCRIPTIONS pattern (individual setters):
  if (updates.field1) setField1(updates.field1);
  if (updates.field2) setField2(updates.field2);

  // TASKS pattern (single form object):
  setForm(prev => ({ ...prev, ...updates }));
}, []);

// List item updates (medications, tasks, etc.)
const handleChatItemUpdates = useCallback((items: Item[]) => {
  setItems(items);  // or setMedications(items)
}, []);

// Batch creation (Tasks pattern only)
const handleChatBatchCreate = useCallback(() => {
  if (accumulatedItems.length === 0) return;
  executeBatchCreation(accumulatedItems);  // reuse existing batch creation function
  setAccumulatedItems([]);
  setChatPanelOpen(false);
}, [accumulatedItems]);
```

### E. UI Changes — Buttons

Replace the single "Asistente de Voz" button with two buttons:

```tsx
<div className="flex items-center gap-2">
  {/* Chat IA Button — indigo/purple */}
  <button
    onClick={() => setChatPanelOpen(true)}
    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
  >
    <Sparkles className="w-5 h-5" />
    Chat IA
  </button>
  {/* Asistente de Voz — disabled */}
  <button
    disabled
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg opacity-50 cursor-not-allowed"
  >
    <Mic className="w-5 h-5" />
    Asistente de Voz
  </button>
</div>
```

### F. Render Panel

After the existing VoiceChatSidebar (or at the end of the page component):

```tsx
{chatPanelOpen && (
  <FeatureChatPanel
    onClose={() => setChatPanelOpen(false)}
    currentFormData={chatFormData}
    onUpdateFields={handleChatFieldUpdates}
    onUpdateItems={handleChatItemUpdates}
    // Batch pattern:
    accumulatedItems={accumulatedItems}
    onCreateBatch={handleChatBatchCreate}
  />
)}
```

---

## 9. Data Flow - Text Input

Step-by-step flow when the doctor types "Paracetamol 500mg cada 8 horas":

1. Doctor types in input field, presses Enter or clicks Send
2. `handleSend()` → `sendMessage("Paracetamol 500mg cada 8 horas")`
3. Hook creates user message object, adds to `messages` state, adds to `conversationRef`
4. Hook sets `isLoading = true`
5. Hook POSTs to `/api/prescription-chat`:
   ```json
   {
     "messages": [{ "role": "user", "content": "Paracetamol 500mg cada 8 horas" }],
     "currentFormData": { "prescriptionDate": "2026-02-15", "diagnosis": "", "medications": [{ "drugName": "", ... }] }
   }
   ```
6. API route:
   - Authenticates doctor
   - Builds system prompt with current form state embedded
   - Constructs message array: `[system, fewShotUser, fewShotAssistant, realUser]`
   - Calls `getChatProvider().chatCompletion()` with `jsonMode: true`
   - Parses JSON response
   - Returns `{ success: true, data: { message, action, fieldUpdates, medicationActions } }`
7. Hook receives response:
   - `fieldUpdates = {}` (no flat fields mentioned)
   - `medicationActions = [{ type: "update", index: 0, updates: { drugName: "Paracetamol", dosage: "500mg", ... } }]`
   - Calls `applyMedicationActions(currentMeds, medicationActions)` → new medications array
   - Calls `onUpdateMedications(newMeds)` → form updates
   - Builds `actionSummary = "Se actualizaron 1 medicamento"`
   - Adds assistant message with actionSummary
8. Panel scrolls to bottom, form re-renders with populated medication fields

---

## 10. Data Flow - Voice Input

Step-by-step flow when the doctor uses voice:

1. Doctor presses mic button → `voice.startRecording()`
2. `useVoiceRecording` starts MediaRecorder, begins accumulating audio chunks
3. UI shows recording state (red pulse, duration counter)
4. Doctor presses stop → `handleVoiceStop()`
   - Sets `shouldAutoSendRef.current = true`
   - Calls `voice.stopRecording()`
5. MediaRecorder fires `onstop`, creates `audioBlob` from chunks
6. `useEffect` detects `voice.status === 'stopped'` + `audioBlob` + `shouldAutoSendRef`
7. Calls `processVoiceMessage(audioBlob)`:
   - Sets `isTranscribing = true`
   - Creates FormData with audio blob
   - POSTs to `/api/voice/transcribe`
   - Server transcribes via Whisper
   - Returns `{ success: true, data: { transcript: "paracetamol 500 miligramos cada 8 horas" } }`
8. Calls `sendMessageRef.current(transcript)` → same flow as text input from step 3 above
9. `isTranscribing` resets to false, recording resets

---

## 11. LLM System Prompt Architecture

The system prompt is rebuilt on EVERY API call with the current form state. This is critical because the LLM needs to know what's already filled to avoid overwriting or duplicating data.

### Prompt Structure

```
1. Role description
   "Eres un asistente de IA que ayuda a doctores a [crear recetas / crear tareas]."

2. Available fields with descriptions
   Each field listed with name, type, constraints, and examples

3. Valid values for enum fields
   Priority: ALTA, MEDIA, BAJA
   Category: SEGUIMIENTO, ADMINISTRATIVO, ...

4. Current form state (JSON)
   The actual current values of all form fields

5. Current list items state (JSON)
   Medications array, accumulated tasks array, etc.

6. Response format
   Exact JSON schema the LLM must return

7. Rules (numbered list)
   - When to use fieldUpdates vs itemActions
   - How to handle single vs multiple items
   - Date/time formats
   - Ambiguity handling
   - Output formatting (bullet points)
```

### Prescriptions System Prompt - Key Rules

```
1. When doctor mentions prescription data → action="update_fields"
2. Only include mentioned fields in fieldUpdates, NEVER include "medications"
3. Questions without data → action="no_change"
4. First medication slot empty → use "update" index 0 (not "add")
5. Existing meds → use "add" for new ones
6. Modify existing → "update" with correct index
7. Delete → "remove" with correct index
8. Replace all → "replace_all"
9. Spanish professional language
10. Concise confirmations
11. Dates in YYYY-MM-DD
12. Ambiguous input → ask for clarification
13. Calculate quantity from dose + frequency + duration
14. Always use bullet points for field/med listings
```

### Tasks System Prompt - Key Rules

```
1. Single task → use fieldUpdates
2. Only include mentioned fields
3. Multiple tasks → use taskActions with "add" for each
4. taskActions manages batch list
5. Questions → action="no_change"
6. Modify accumulated task → "update" with index
7. Delete accumulated task → "remove" with index
8. Replace all → "replace_all"
9. Spanish professional language
10. Concise responses
11. Dates YYYY-MM-DD, Times HH:mm
12. Ambiguous → ask for clarification
13. Calculate relative dates ("manana", "el viernes")
14. Always use bullet points
```

---

## 12. Few-Shot Examples (Pre-Prompt)

Every API call injects a hardcoded user/assistant exchange BEFORE the real conversation. This teaches the model the expected response format.

### Why this matters:
- The model sees a concrete example of correct JSON output before processing any real input
- Prevents format errors on the very first user message
- Reduces hallucination of extra fields or wrong structure

### Prescriptions Few-Shot:

```typescript
{ role: 'user', content: 'Paracetamol 500mg cada 8 horas por 5 dias, tomar con alimentos' },
{ role: 'assistant', content: JSON.stringify({
  message: 'He agregado el medicamento:\n\n- **Paracetamol** 500mg cada 8 horas por 5 dias\n\n¿Desea agregar otro medicamento?',
  action: 'update_fields',
  fieldUpdates: {},
  medicationActions: [
    { type: 'update', index: 0, updates: { drugName: 'Paracetamol', presentation: 'tabletas', dosage: '500mg', frequency: 'cada 8 horas', duration: '5 dias', quantity: '15 tabletas', instructions: 'Tomar con alimentos' } }
  ],
}) },
```

### Tasks Few-Shot:

```typescript
{ role: 'user', content: 'Revisar resultados de laboratorio manana a las 10' },
{ role: 'assistant', content: JSON.stringify({
  message: 'He actualizado el formulario:\n\n- **Titulo**: Revisar resultados de laboratorio\n- **Categoria**: LABORATORIO\n- **Hora de inicio**: 10:00\n\n¿Desea agregar mas detalles?',
  action: 'update_fields',
  fieldUpdates: { title: 'Revisar resultados de laboratorio', category: 'LABORATORIO', startTime: '10:00' },
  taskActions: [],
}) },
```

### Message Array Order (what the LLM actually sees):

```
[0] system prompt (with current state)
[1] few-shot user message (hardcoded)
[2] few-shot assistant response (hardcoded)
[3] real user message 1
[4] real assistant response 1
[5] real user message 2
...
```

---

## 13. JSON Response Format

### Prescriptions

```json
{
  "message": "Confirmacion en español con bullet points",
  "action": "update_fields" | "no_change",
  "fieldUpdates": {
    "prescriptionDate": "2026-02-15",
    "diagnosis": "Faringitis aguda",
    "clinicalNotes": "...",
    "doctorFullName": "...",
    "doctorLicense": "...",
    "expiresAt": "2026-03-15"
  },
  "medicationActions": [
    { "type": "add", "medication": { "drugName": "...", "dosage": "...", ... } },
    { "type": "update", "index": 0, "updates": { "dosage": "1g" } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "medications": [ {...}, {...} ] }
  ]
}
```

### Tasks

```json
{
  "message": "Confirmacion en español con bullet points",
  "action": "update_fields" | "no_change",
  "fieldUpdates": {
    "title": "...",
    "description": "...",
    "dueDate": "2026-02-16",
    "startTime": "10:00",
    "endTime": "11:00",
    "priority": "ALTA",
    "category": "LABORATORIO"
  },
  "taskActions": [
    { "type": "add", "task": { "title": "...", "dueDate": "...", ... } },
    { "type": "update", "index": 0, "updates": { "title": "..." } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "tasks": [ {...}, {...} ] }
  ]
}
```

### Generic Template

```json
{
  "message": "string",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { ... },
  "<item>Actions": [
    { "type": "add", "<item>": { ... } },
    { "type": "update", "index": N, "updates": { ... } },
    { "type": "remove", "index": N },
    { "type": "replace_all", "<items>": [ ... ] }
  ]
}
```

---

## 14. Field Updates vs List Actions (Flat + Nested)

The response always separates:

- **`fieldUpdates`** — Flat/scalar fields of the form (strings, dates, enums). Applied via `onUpdateFields(updates)` which merges into the form state.
- **`<item>Actions`** — Operations on a list/array (medications, tasks). Applied via `apply<Item>Actions()` which produces a new array.

### Why separate?

Because flat fields can be simply merged (`{ ...prev, ...updates }`), but list operations need index-aware logic (add at end, update at index, remove at index, replace all).

### Prescriptions:
- `fieldUpdates`: prescriptionDate, diagnosis, clinicalNotes, doctorFullName, doctorLicense, expiresAt
- `medicationActions`: operations on the medications array

### Tasks:
- `fieldUpdates`: title, description, dueDate, startTime, endTime, priority, category
- `taskActions`: operations on the accumulated batch tasks array

### Important Rule:
The system prompt explicitly tells the LLM: "NEVER include `medications` in `fieldUpdates` — always use `medicationActions`." This prevents the LLM from trying to set the entire medications array as a flat field.

---

## 15. Batch/Multi-Item Support (Tasks Pattern)

The Tasks implementation adds a batch creation flow on top of the base pattern:

### How it works:

1. Doctor says "Crea 3 tareas: llamar farmacia, seguimiento Lopez, revisar radiografia"
2. LLM returns `taskActions: [{ type: "add", task: {...} }, { type: "add", task: {...} }, { type: "add", task: {...} }]`
3. Hook calls `applyTaskActions([], actions)` → 3 tasks in array
4. Hook calls `onUpdateTasks(newTasks)` → page sets `accumulatedTasks` state
5. Panel renders `BatchTaskList` component below messages
6. Doctor can edit/remove tasks in the batch list
7. Doctor clicks "Crear 3 Pendientes" button
8. Page calls `handleChatBatchCreate()` → `executeBatchCreation(accumulatedTasks)` → API creates each task → redirect

### BatchTaskList Component

Reused from `@/components/voice-assistant/chat/BatchTaskList`:
- Shows each task as a card with title, priority badge, category badge, date, time
- Edit (pencil) and Delete (trash) buttons per task
- "Agregar" button to add empty task
- `onUpdateEntries` callback for all modifications

### Page State for Batch

```typescript
const [accumulatedTasks, setAccumulatedTasks] = useState<VoiceTaskData[]>([]);
```

### Batch Create Callback

```typescript
const handleChatBatchCreate = useCallback(() => {
  if (accumulatedTasks.length === 0) return;
  executeBatchCreation(accumulatedTasks);  // existing function from voice assistant
  setAccumulatedTasks([]);
  setChatPanelOpen(false);
}, [accumulatedTasks]);
```

### When NOT to use batch:

The Prescriptions implementation does NOT use batch because prescriptions are single documents with multiple medications inside. The medications are part of the single form, not separate entities.

Use batch when:
- Each item in the list is an independent entity that gets created via its own API call
- The page already has a `executeBatchCreation()` function (from the voice assistant)

---

## 16. Voice Recording Pipeline

### Dependencies

```typescript
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
```

### Hook Usage

```typescript
const voice = useVoiceRecording({ maxDuration: 120 });  // 2-minute max
```

### VoiceRecordButton Component

```typescript
import { VoiceRecordButton } from '@/components/voice-assistant/chat/VoiceRecordButton';

<VoiceRecordButton
  isRecording={voice.isRecording}
  isProcessing={voice.isProcessing}
  duration={voice.duration}
  disabled={isBusy}
  onStartRecording={voice.startRecording}
  onStopRecording={voice.stopRecording}
  onCancel={voice.cancelRecording}
/>
```

### Transcription Endpoint

POST `/api/voice/transcribe` with FormData containing audio blob:
```typescript
const fd = new FormData();
fd.append('audio', audioBlob, 'recording.webm');
const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
const json = await res.json();
// json.data.transcript = "the transcribed text"
```

### Auto-send Pattern

The hook uses a ref-based pattern to automatically send the transcribed text:
```typescript
const shouldAutoSendRef = useRef(false);

// When user clicks stop:
const handleVoiceStop = () => {
  shouldAutoSendRef.current = true;
  voice.stopRecording();
};

// When recording stops and blob is ready:
useEffect(() => {
  if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
    shouldAutoSendRef.current = false;
    processVoiceMessage(voice.audioBlob);
  }
}, [voice.status, voice.audioBlob]);
```

This prevents double-sends and ensures the transcript is only sent when the user explicitly stopped (not when the component mounts with stale state).

---

## 17. UI Component Anatomy

### Color Scheme

| Element | Color |
|---------|-------|
| Chat IA button | `bg-indigo-600` (purple) |
| Panel header | `bg-indigo-50` |
| Sparkles icon | `text-indigo-600` |
| Header text | `text-indigo-900` |
| Clear/collapse buttons | `text-indigo-500 hover:text-indigo-700` |
| User message bubble | `bg-blue-600 text-white` |
| Assistant message bubble | `bg-gray-100 text-gray-800` |
| User avatar | `bg-blue-600` (User icon) |
| Assistant avatar | `bg-indigo-100` (Bot icon) |
| Action summary badge | `bg-green-100 text-green-700` |
| Send button (active) | `bg-blue-600` |
| Send button (disabled) | `bg-gray-100 text-gray-300` |
| Suggestion buttons | `border-indigo-200 text-indigo-700` |
| Batch create button | `bg-indigo-600` |

### Icons Used

```typescript
import { Sparkles, X, Bot, User, Loader2, Send, Minus, ChevronUp } from 'lucide-react';
```

- `Sparkles` — Chat IA branding (header, empty state, button)
- `Bot` — Assistant messages avatar
- `User` — User messages avatar
- `Loader2` — Loading/thinking spinner
- `Send` — Send button
- `Minus` — Collapse panel
- `ChevronUp` — Expand panel
- `X` — Close panel

---

## 18. Drag, Collapse & Responsive Behavior

### Desktop (sm+)
- Panel is fixed to the right side, full height (top-0 bottom-0), 24rem wide
- No drag handle
- Collapse shrinks to header-only at bottom-right

### Mobile (< sm)
- Panel is fixed to bottom, full width, height = `panelHeight`vh (default 60)
- Drag handle visible at top (gray pill)
- User can drag to resize between 25vh and 90vh
- Rounded top corners (`rounded-t-2xl`)

### Drag Implementation

```typescript
const [panelHeight, setPanelHeight] = useState(60);
const isDragging = useRef(false);
const dragStartY = useRef(0);
const dragStartHeight = useRef(60);

const onDragStart = (clientY: number) => { ... };
const onDragMove = (clientY: number) => {
  const deltaVh = ((dragStartY.current - clientY) / window.innerHeight) * 100;
  const newHeight = Math.min(90, Math.max(25, dragStartHeight.current + deltaVh));
  setPanelHeight(newHeight);
};
```

Supports both touch events (mobile) and mouse events (desktop testing).

### Collapse Behavior

```typescript
const [collapsed, setCollapsed] = useState(false);
```

When collapsed:
- Messages and input are hidden
- Header shows message count badge
- Panel shrinks to header height only

---

## 19. Error Handling

### API Route Errors

| Error | Status | Response |
|-------|--------|----------|
| No messages | 400 | `{ code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' }` |
| Rate limited | 429 | `{ code: 'RATE_LIMITED', message: 'Demasiadas solicitudes...' }` |
| Network error | 503 | `{ code: 'CHAT_FAILED', message: 'Error de conexion...' }` |
| JSON parse failure | 500 | `{ code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' }` |
| Auth failure | 401 | Handled by `requireDoctorAuth` |
| Other errors | varies | Handled by `handleApiError` |

### Hook Error Handling

```typescript
// API returns error
if (!json.success) {
  const errText = json.error?.message || 'Error desconocido';
  // Add error message to chat as assistant message
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `Lo siento, ocurrio un error: ${errText}`,
  }]);
}

// Network/fetch failure
catch (err) {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: 'Lo siento, no pude conectarme con el servidor. Intente de nuevo.',
  }]);
}
```

Errors appear as assistant messages in the chat — no separate error UI.

### Voice Transcription Errors

```typescript
// Transcription failed
if (!json.success || !json.data?.transcript) {
  setMessages(prev => [...prev, {
    content: 'No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje.',
  }]);
}
```

---

## 20. Relationship to Existing Voice Assistant

The app has TWO AI input methods per form:

1. **Voice Assistant (Asistente de Voz)** — The original flow:
   - Modal → record audio → transcribe → structure → sidebar review → confirm
   - Multi-step, confirmation-required
   - Currently **disabled** (button visible but `disabled` prop)

2. **Chat IA** — The new flow (this pattern):
   - Panel → type or speak → AI extracts fields → immediate form update
   - Single-step, no confirmation
   - Currently **active**

Both share:
- `useVoiceRecording` hook
- `VoiceRecordButton` component
- `/api/voice/transcribe` endpoint
- `VoiceTaskData` / `VoicePrescriptionData` types
- `BatchTaskList` component (Tasks pattern)
- `executeBatchCreation()` function (Tasks pattern)

The Voice Assistant button is kept in the UI (disabled) for potential future re-enablement. The Chat IA replaces its functionality with a simpler, more interactive flow.

---

## 21. Step-by-Step Replication Checklist

To add Chat IA to a new feature `<Feature>` (e.g., appointments, encounters, sales):

### Step 1: Create API Route

- [ ] Create `apps/doctor/src/app/api/<feature>-chat/route.ts`
- [ ] Copy from `prescription-chat/route.ts` or `task-chat/route.ts`
- [ ] Update `buildSystemPrompt()`:
  - [ ] Change role description
  - [ ] List all form fields with names, types, valid values
  - [ ] Embed current form state as JSON
  - [ ] If has list items: embed current items as JSON
  - [ ] Define response JSON format
  - [ ] Write domain-specific rules
- [ ] Update few-shot example to match domain
- [ ] Update log prefix `[<Feature> Chat]`

### Step 2: Create Hook

- [ ] Create `apps/doctor/src/hooks/use<Feature>Chat.ts`
- [ ] Copy from `usePrescriptionChat.ts` or `useTaskChat.ts`
- [ ] Define `<Feature>ChatMessage` interface
- [ ] Define `<Feature>FormData` interface (mirrors form fields)
- [ ] Define `<Item>Action` interface if has list items
- [ ] Update API endpoint URL in `fetch()`
- [ ] Update `applyItemActions()` if has list items (field names differ per domain)
- [ ] Update `generateId()` prefix
- [ ] Update options interface with correct callback names
- [ ] Update `sendMessage()` body to include correct extra data
- [ ] Update action summary labels ("medicamento" → "tarea" → your term)

### Step 3: Create Panel Component

- [ ] Create `apps/doctor/src/components/<area>/<Feature>ChatPanel.tsx`
- [ ] Copy from `PrescriptionChatPanel.tsx` or `TaskChatPanel.tsx`
- [ ] Update imports (hook, types)
- [ ] Update suggestions array (3 domain-specific examples)
- [ ] Update empty state title ("Asistente de <feature>")
- [ ] Update empty state description
- [ ] Update input placeholder
- [ ] If batch pattern: add BatchTaskList + create button (or equivalent)
- [ ] Update props interface

### Step 4: Modify Existing Page

- [ ] Add imports: `Sparkles`, `<Feature>ChatPanel`, `<Feature>FormData`
- [ ] Add `useMemo` to React import
- [ ] Add state: `chatPanelOpen`, `accumulatedItems` (if batch)
- [ ] Add `chatFormData` useMemo
- [ ] Add `handleChatFieldUpdates` callback
- [ ] Add `handleChatItemUpdates` callback (if list items)
- [ ] Add `handleChatBatchCreate` callback (if batch)
- [ ] Add Chat IA button (indigo) next to or replacing Voice button
- [ ] Disable Voice Assistant button
- [ ] Render `<Feature>ChatPanel` conditionally on `chatPanelOpen`

### Step 5: Verify

- [ ] `npm run build` passes
- [ ] Panel opens/closes correctly
- [ ] Text input updates form fields
- [ ] Voice input works (record → transcribe → send)
- [ ] Suggestions work
- [ ] Collapse/expand works
- [ ] Mobile drag works
- [ ] Clear chat works
- [ ] Error messages appear in chat
- [ ] Batch creation works (if applicable)

---

## 22. Complete Code Examples

### Minimal API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;

function buildSystemPrompt(currentFormData: Record<string, any>) {
  return `Eres un asistente de IA que ayuda a doctores a [DESCRIPCION].

## CAMPOS DEL FORMULARIO
- "field1": Descripcion (tipo)
- "field2": Descripcion (tipo)

## ESTADO ACTUAL
${JSON.stringify(currentFormData, null, 2)}

## TU RESPUESTA
{
  "message": "string",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { ... }
}

## REGLAS
1. ...`;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { messages, currentFormData = {} } = await request.json();

    if (!messages?.length) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(currentFormData) },
      { role: 'user', content: 'example input' },
      { role: 'assistant', content: JSON.stringify({ message: '...', action: 'update_fields', fieldUpdates: { field1: '...' } }) },
      ...messages.filter((m: any) => m.content).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const responseText = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL, temperature: TEMPERATURE, maxTokens: MAX_TOKENS, jsonMode: true,
    });

    const parsed = JSON.parse(responseText);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    if (error?.status === 429) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' } }, { status: 429 });
    }
    return handleApiError(error, 'POST /api/<feature>-chat');
  }
}
```

---

## 23. Testing Checklist

### Basic Functionality
- [ ] Chat panel opens when clicking "Chat IA"
- [ ] Chat panel closes when clicking X
- [ ] Typing a message and pressing Enter sends it
- [ ] AI response appears as assistant message
- [ ] Form fields update after AI response
- [ ] Action summary badge appears (green)
- [ ] Suggestions work (click → sends message)

### Voice
- [ ] Mic button starts recording
- [ ] Recording shows duration
- [ ] Stop button sends audio for transcription
- [ ] Transcribed text appears as user message
- [ ] AI processes transcribed text normally
- [ ] Cancel recording discards audio

### UI States
- [ ] Loading spinner shows "Pensando..." during AI call
- [ ] Loading spinner shows "Transcribiendo..." during voice transcription
- [ ] Input and buttons disabled during loading
- [ ] Collapse button minimizes to header only
- [ ] Expand button restores full panel
- [ ] Message count badge shows in collapsed state
- [ ] "Limpiar" button clears all messages
- [ ] Panel scrolls to bottom on new messages

### Batch (Tasks only)
- [ ] Multiple tasks accumulate in batch list
- [ ] BatchTaskList renders below messages
- [ ] Edit/delete buttons work on batch items
- [ ] "Crear N Pendientes" button calls batch creation
- [ ] After batch creation: tasks cleared, panel closes, redirect occurs

### Error Cases
- [ ] Network error → error message in chat
- [ ] Rate limit → error message in chat
- [ ] Voice transcription failure → error message in chat
- [ ] Invalid JSON from LLM → error response from API

### Responsive
- [ ] Mobile: panel at bottom, drag handle visible, resizable
- [ ] Desktop: panel at right side, full height, no drag handle

---

## 24. Known Considerations

### 1. System prompt rebuilt every call
The system prompt includes the current form state, which means it's rebuilt on every message. This is intentional — the LLM needs to see what's already filled. But it also means token usage grows with form complexity.

### 2. Conversation history accumulates
All messages are sent to the API on every call via `conversationRef`. For long conversations, this can hit token limits. Consider implementing a sliding window or summary mechanism for very long sessions.

### 3. No undo mechanism
Field updates are applied immediately. There's no "undo last AI change" feature. The doctor must manually correct any wrong values. The "Limpiar" button only clears chat messages, not form values.

### 4. Race condition prevention
The hook checks `if (isLoading) return;` at the start of `sendMessage()` to prevent concurrent requests. The UI also disables the send button and input during loading.

### 5. Voice auto-send uses refs
The `shouldAutoSendRef` pattern prevents the `useEffect` from auto-sending on mount or re-render. Only an explicit user action (clicking stop) sets the flag.

### 6. The `sendMessageRef` pattern
The hook stores `sendMessage` in a ref (`sendMessageRef.current = sendMessage`) so that `processVoiceMessage` (which is created via `useCallback`) can always call the latest version without stale closures.

### 7. Module-level counter
The `_counter` variable for generating IDs is module-level (outside the component), so it persists across re-renders and even across multiple instances. This ensures truly unique IDs.

### 8. Two-button coexistence
The "Asistente de Voz" button is disabled but still rendered. This is intentional for two reasons:
- Visual indication that the feature exists but is superseded
- Easy re-enablement if needed (just remove `disabled` prop)

### 9. Form state coupling
The `currentFormData` passed to the hook must stay in sync with the actual form state. The `useMemo` in the page ensures this. If you add new form fields, you must also add them to the memo and the system prompt.

### 10. ItemActions apply client-side
The `applyItemActions()` function runs in the browser, not the server. The LLM returns instructions (add/update/remove), and the hook interprets them. This means the hook must correctly handle edge cases like out-of-bounds indices.
