# Voice Assistant for Appointment Slots Creation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Workflow](#complete-workflow)
4. [Data Schema](#data-schema)
5. [Implementation Guide](#implementation-guide)
6. [API Routes](#api-routes)
7. [Components](#components)
8. [Hooks](#hooks)
9. [LLM Prompts](#llm-prompts)
10. [Examples](#examples)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Appointment Slots Voice Assistant allows doctors to create recurring appointment availability using natural voice commands. Instead of manually filling out the CreateSlotsModal form with date ranges, days of week, time slots, pricing, and discounts, doctors can simply speak their requirements.

### Key Features

- 🎤 **Voice-to-Form**: Speak naturally to create appointment schedules
- 💬 **Chat Refinement**: Conversational interface to edit and perfect data
- 🔄 **Two-Phase Workflow**: Recording → Chat refinement
- 🎯 **No Hallucination**: LLM only extracts explicitly mentioned data
- 💾 **Session Persistence**: Auto-saves to localStorage with 24-hour expiry
- ✅ **Form Pre-fill**: Confirmed data automatically populates CreateSlotsModal

### Use Case

**Scenario**: A doctor wants to create appointment slots for February
- **Traditional**: Manually select dates, check days, input times, set prices (2-3 minutes)
- **With Voice**: "De lunes a viernes del 1 al 28 de febrero, de 9 a 5, citas de 60 minutos, precio 500 pesos" (15 seconds)

---

## Architecture

### Two-Phase Interaction Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: RECORDING                       │
│                                                                   │
│  1. User clicks "Asistente de Voz" button                       │
│  2. VoiceRecordingModal opens with visual guide                 │
│  3. User records voice dictation                                │
│  4. Audio → Whisper API (transcription)                         │
│  5. Transcript → GPT-4o (structured data extraction)            │
│  6. Auto-transition to Phase 2                                  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: CHAT REFINEMENT                      │
│                                                                   │
│  7. VoiceChatSidebar opens with initial data preview            │
│  8. User refines data via text or voice messages                │
│  9. LLM updates structured data with each message               │
│ 10. User clicks "Confirmar" when satisfied                      │
│ 11. Sidebar closes, CreateSlotsModal opens (pre-filled)         │
│ 12. User reviews and submits to create slots                    │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Speech-to-Text** | OpenAI Whisper | Transcribe Spanish audio to text |
| **LLM Processing** | GPT-4o with JSON mode | Extract structured data from transcript |
| **Chat Interface** | React + TypeScript | Conversational data refinement |
| **State Management** | React hooks | Session state and data flow |
| **Persistence** | localStorage | Auto-save sessions (24h expiry) |
| **Audio Recording** | MediaRecorder API | Browser-native audio capture |

---

## Complete Workflow

### Step-by-Step Flow

#### 1. User Initiates Voice Assistant

```typescript
// User clicks "Asistente de Voz" button on appointments page
<button onClick={() => setVoiceModalOpen(true)}>
  <Mic className="w-5 h-5" />
  Asistente de Voz
</button>
```

**What happens:**
- `VoiceRecordingModal` opens
- Visual guide shows what can be dictated
- Recording controls become available

---

#### 2. Voice Recording & Transcription

**User speaks:**
```
"De lunes a viernes, del 1 al 28 de febrero, de 9 de la mañana a 5 de la tarde,
citas de 60 minutos, con descanso de 12 a 1, precio 500 pesos"
```

**Processing:**
1. Audio captured via MediaRecorder API (WebM format)
2. Sent to `POST /api/voice/transcribe`
3. OpenAI Whisper transcribes to text
4. Transcript returned with ID for audit trail

**API Request:**
```typescript
POST /api/voice/transcribe
Content-Type: multipart/form-data

{
  audio: Blob,
  language: "es"
}
```

**API Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "De lunes a viernes, del 1 al 28 de febrero...",
    "transcriptId": "550e8400-e29b-41d4-a716-446655440000",
    "duration": 12.5,
    "language": "es"
  }
}
```

---

#### 3. Structured Data Extraction

**Processing:**
1. Transcript sent to `POST /api/voice/structure`
2. GPT-4o with JSON mode extracts structured fields
3. LLM follows strict prompt rules (no hallucination)
4. Returns `VoiceAppointmentSlotsData` object

**API Request:**
```typescript
POST /api/voice/structure
Content-Type: application/json

{
  "transcript": "De lunes a viernes, del 1 al 28 de febrero...",
  "transcriptId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionType": "CREATE_APPOINTMENT_SLOTS",
  "context": {
    "doctorId": "doc_123"
  }
}
```

**API Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "structuredData": {
      "startDate": "2024-02-01",
      "endDate": "2024-02-28",
      "daysOfWeek": [0, 1, 2, 3, 4],
      "startTime": "09:00",
      "endTime": "17:00",
      "duration": 60,
      "breakStart": "12:00",
      "breakEnd": "13:00",
      "basePrice": 500,
      "discount": null,
      "discountType": null
    },
    "fieldsExtracted": ["startDate", "endDate", "daysOfWeek", "startTime", "endTime", "duration", "breakStart", "breakEnd", "basePrice"],
    "fieldsEmpty": ["discount", "discountType"],
    "confidence": "high"
  }
}
```

---

#### 4. Chat Sidebar Opens

**Initial State:**
- Sidebar slides in from right
- Shows extracted data preview
- Displays initial AI message: "He registrado la configuración de horarios. Extraje 9 campos. ¿Deseas agregar o modificar algo?"

**Visual Components:**
```
┌─────────────────────────────────────────┐
│ Asistente - Crear Horarios        [X]  │
├─────────────────────────────────────────┤
│                                         │
│  [User Message - Voice]                 │
│  "De lunes a viernes, del 1 al..."     │
│  🎤 12.5s                                │
│                                         │
│  [AI Response]                          │
│  "He registrado la configuración..."    │
│                                         │
│  📊 Preview:                            │
│  ✓ Fecha Inicio: 1 feb 2024            │
│  ✓ Fecha Fin: 28 feb 2024               │
│  ✓ Días: Lun, Mar, Mié, Jue, Vie       │
│  ✓ Horario: 09:00 - 17:00              │
│  ✓ Duración: 60 minutos                 │
│  ✓ Descanso: 12:00 - 13:00             │
│  ✓ Precio: $500                         │
│  ○ Descuento: Sin capturar              │
│                                         │
├─────────────────────────────────────────┤
│  [Text Input / Voice Button]           │
│  [Confirmar] [Reintentar]              │
└─────────────────────────────────────────┘
```

---

#### 5. Conversational Refinement

**User can refine data via text or voice:**

**Example 1: Adding Missing Data**
```
User: "¿Qué me hace falta?"

AI: "Ya tenemos la configuración básica de horarios. Los campos que
     podrías agregar son:

     • Descuento (opcional): Puedes indicar un descuento en porcentaje
       o cantidad fija

     ¿Deseas agregar algún descuento?"
```

**Example 2: Modifying Data**
```
User: "Cambia el precio a 600 pesos y agrega descuento del 10%"

AI: "Perfecto, he actualizado:
     • Precio base: $600
     • Descuento: 10% (tipo porcentaje)

     El precio final será de $540 por cita."
```

**Example 3: Complex Changes**
```
User: "Elimina el descanso y cambia el horario de 8 a 6"

AI: "Entendido, he modificado:
     • Horario: 08:00 - 18:00 (en lugar de 09:00 - 17:00)
     • Descanso: Eliminado

     Esto creará más horarios disponibles al día."
```

**Chat API Request:**
```typescript
POST /api/voice/chat
Content-Type: application/json

{
  "sessionType": "CREATE_APPOINTMENT_SLOTS",
  "messages": [
    { "role": "user", "content": "De lunes a viernes..." },
    { "role": "assistant", "content": "He registrado..." },
    { "role": "user", "content": "Cambia el precio a 600" }
  ],
  "currentData": {
    "startDate": "2024-02-01",
    "endDate": "2024-02-28",
    // ... other fields
    "basePrice": 500
  },
  "context": {
    "doctorId": "doc_123"
  }
}
```

**Chat API Response:**
```json
{
  "success": true,
  "data": {
    "message": "Perfecto, he actualizado el precio base a $600.",
    "structuredData": {
      "startDate": "2024-02-01",
      "endDate": "2024-02-28",
      "daysOfWeek": [0, 1, 2, 3, 4],
      "startTime": "09:00",
      "endTime": "17:00",
      "duration": 60,
      "breakStart": "12:00",
      "breakEnd": "13:00",
      "basePrice": 600,
      "discount": null,
      "discountType": null
    },
    "fieldsExtracted": ["basePrice"],
    "isComplete": false
  }
}
```

---

#### 6. Data Confirmation

**User clicks "Confirmar" button:**

```typescript
const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
  const voiceData = data as VoiceAppointmentSlotsData;

  // Map voice data to CreateSlotsModal form format
  const mappedData = {
    startDate: voiceData.startDate || '',
    endDate: voiceData.endDate || '',
    daysOfWeek: voiceData.daysOfWeek || [1, 2, 3, 4, 5],
    startTime: voiceData.startTime || '09:00',
    endTime: voiceData.endTime || '17:00',
    duration: voiceData.duration || 60,
    breakStart: voiceData.breakStart || '12:00',
    breakEnd: voiceData.breakEnd || '13:00',
    hasBreak: Boolean(voiceData.breakStart && voiceData.breakEnd),
    basePrice: voiceData.basePrice?.toString() || '',
    discount: voiceData.discount?.toString() || '',
    discountType: voiceData.discountType || 'PERCENTAGE',
    hasDiscount: Boolean(voiceData.discount),
  };

  setVoiceFormData(mappedData);
  setVoiceSidebarOpen(false);
  setShowCreateModal(true); // Open pre-filled modal
}, []);
```

---

#### 7. CreateSlotsModal Pre-filled

**Modal opens with all fields populated:**

```typescript
// Modal receives initialData prop
<CreateSlotsModal
  isOpen={showCreateModal}
  onClose={handleClose}
  doctorId={doctorId}
  onSuccess={handleSuccess}
  initialData={voiceFormData} // ← Pre-fill data
/>

// useEffect in CreateSlotsModal applies initialData
useEffect(() => {
  if (initialData) {
    setMode("recurring"); // Force recurring mode
    if (initialData.startDate) setStartDate(initialData.startDate);
    if (initialData.endDate) setEndDate(initialData.endDate);
    if (initialData.daysOfWeek) setDaysOfWeek(initialData.daysOfWeek);
    // ... set all other fields
  }
}, [initialData]);
```

**Visual Result:**
```
┌────────────────────────────────────────────┐
│  Crear Horarios de Citas              [X] │
├────────────────────────────────────────────┤
│                                            │
│  Modo: [Recurrente] ✓                     │
│                                            │
│  📅 Fecha Inicio: [2024-02-01]            │
│  📅 Fecha Fin:    [2024-02-28]            │
│                                            │
│  Repetir en:                               │
│  [Lun] [Mar] [Mié] [Jue] [Vie] Sáb Dom   │
│   ✓     ✓     ✓     ✓     ✓               │
│                                            │
│  🕐 Hora Inicio:  [09:00]                 │
│  🕐 Hora Fin:     [17:00]                 │
│  ⏱️  Duración:     [60 minutos] ✓          │
│                                            │
│  ☑ Agregar descanso                       │
│     Inicio: [12:00]                        │
│     Fin:    [13:00]                        │
│                                            │
│  💰 Precio Base: [600] MXN                │
│                                            │
│  ☑ Agregar descuento                      │
│     Tipo:  [Porcentaje] ✓                 │
│     Valor: [10] %                          │
│                                            │
│  ℹ️  Vista Previa:                         │
│  Esto creará ~80 horarios de citas        │
│                                            │
│  [Cancelar]        [Crear 80 Horarios]    │
└────────────────────────────────────────────┘
```

---

#### 8. Final Submission

**User reviews and clicks "Crear Horarios":**

```typescript
const handleSubmit = async () => {
  const payload = {
    doctorId,
    mode: "recurring",
    startDate: "2024-02-01",
    endDate: "2024-02-28",
    daysOfWeek: [0, 1, 2, 3, 4],
    startTime: "09:00",
    endTime: "17:00",
    duration: 60,
    breakStart: "12:00",
    breakEnd: "13:00",
    basePrice: 600,
    discount: 10,
    discountType: "PERCENTAGE"
  };

  const response = await authFetch(`${API_URL}/api/appointments/slots`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // Success: 80 appointment slots created!
};
```

---

## Data Schema

### VoiceAppointmentSlotsData Interface

```typescript
export interface VoiceAppointmentSlotsData {
  // Date Range (recurring mode only)
  startDate?: string | null;        // ISO date: "2024-02-01"
  endDate?: string | null;          // ISO date: "2024-02-28"

  // Days of Week Selection
  // CRITICAL: 0=Monday, 1=Tuesday, ..., 6=Sunday
  daysOfWeek?: number[] | null;     // [0,1,2,3,4] = Mon-Fri

  // Time Configuration
  startTime?: string | null;        // "09:00" (HH:mm)
  endTime?: string | null;          // "17:00" (HH:mm)
  duration?: 30 | 60 | null;        // Minutes (30 or 60 only)

  // Break Time (optional)
  breakStart?: string | null;       // "12:00" (HH:mm)
  breakEnd?: string | null;         // "13:00" (HH:mm)

  // Pricing
  basePrice?: number | null;        // 500 (MXN)
  discount?: number | null;         // 10 (value)
  discountType?: 'PERCENTAGE' | 'FIXED' | null;
}
```

### Field Mapping Reference

| Voice Schema Field | CreateSlotsModal Field | Type | Example |
|-------------------|------------------------|------|---------|
| `startDate` | `startDate` | string | `"2024-02-01"` |
| `endDate` | `endDate` | string | `"2024-02-28"` |
| `daysOfWeek` | `daysOfWeek` | number[] | `[0,1,2,3,4]` |
| `startTime` | `startTime` | string | `"09:00"` |
| `endTime` | `endTime` | string | `"17:00"` |
| `duration` | `duration` | 30\|60 | `60` |
| `breakStart` | `breakStart` + `hasBreak` | string + boolean | `"12:00"` + `true` |
| `breakEnd` | `breakEnd` | string | `"13:00"` |
| `basePrice` | `basePrice` | string | `"600"` |
| `discount` | `discount` + `hasDiscount` | string + boolean | `"10"` + `true` |
| `discountType` | `discountType` | enum | `"PERCENTAGE"` |

### Days of Week Mapping

**CRITICAL**: The LLM uses indices where **Monday = 0**:

| Spanish | English | Index |
|---------|---------|-------|
| Lunes | Monday | 0 |
| Martes | Tuesday | 1 |
| Miércoles | Wednesday | 2 |
| Jueves | Thursday | 3 |
| Viernes | Friday | 4 |
| Sábado | Saturday | 5 |
| Domingo | Sunday | 6 |

**Examples:**
- "Lunes a viernes" → `[0, 1, 2, 3, 4]`
- "Solo lunes y jueves" → `[0, 3]`
- "Sábados y domingos" → `[5, 6]`
- "Todos los días" → `[0, 1, 2, 3, 4, 5, 6]`

---

## Implementation Guide

### File Structure

```
apps/doctor/src/
├── types/
│   └── voice-assistant.ts          # VoiceAppointmentSlotsData schema
├── lib/
│   └── voice-assistant/
│       └── prompts.ts               # LLM prompts for extraction
├── hooks/
│   ├── useVoiceRecording.ts         # Audio capture
│   ├── useVoiceSession.ts           # Phase 1 orchestration
│   ├── useChatSession.ts            # Phase 2 chat logic
│   └── useChatPersistence.ts        # localStorage saving
├── components/
│   └── voice-assistant/
│       ├── VoiceRecordingModal.tsx  # Phase 1 UI
│       └── chat/
│           ├── VoiceChatSidebar.tsx # Phase 2 UI
│           ├── ChatMessageList.tsx  # Message display
│           ├── ChatInput.tsx        # Text/voice input
│           └── StructuredDataPreview.tsx # Data preview
├── app/
│   ├── api/
│   │   └── voice/
│   │       ├── transcribe/route.ts  # Whisper API
│   │       ├── structure/route.ts   # GPT-4o extraction
│   │       └── chat/route.ts        # GPT-4o chat
│   └── appointments/
│       ├── page.tsx                 # Integration point
│       └── CreateSlotsModal.tsx     # Form modal
```

---

## API Routes

### POST /api/voice/transcribe

**Purpose**: Convert audio to text using OpenAI Whisper

**Request:**
```typescript
POST /api/voice/transcribe
Content-Type: multipart/form-data

FormData {
  audio: Blob,          // WebM audio file
  language: "es"        // Spanish
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "De lunes a viernes...",
    "transcriptId": "uuid-v4",
    "duration": 12.5,
    "language": "es"
  }
}
```

**Error Handling:**
- `INVALID_AUDIO`: No audio file provided
- `AUDIO_TOO_LONG`: Exceeds 10 minutes
- `AUDIO_TOO_SHORT`: Less than 0.5 seconds
- `TRANSCRIPTION_FAILED`: Whisper API error

---

### POST /api/voice/structure

**Purpose**: Extract structured data from transcript using GPT-4o

**Request:**
```typescript
POST /api/voice/structure
Content-Type: application/json

{
  "transcript": "De lunes a viernes...",
  "transcriptId": "uuid-from-transcribe",
  "sessionType": "CREATE_APPOINTMENT_SLOTS",
  "context": {
    "doctorId": "doc_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-v4",
    "structuredData": {
      "startDate": "2024-02-01",
      "endDate": "2024-02-28",
      "daysOfWeek": [0, 1, 2, 3, 4],
      "startTime": "09:00",
      "endTime": "17:00",
      "duration": 60,
      "breakStart": "12:00",
      "breakEnd": "13:00",
      "basePrice": 500,
      "discount": null,
      "discountType": null
    },
    "fieldsExtracted": ["startDate", "endDate", ...],
    "fieldsEmpty": ["discount", "discountType"],
    "confidence": "high" | "medium" | "low"
  }
}
```

**Confidence Calculation:**
```typescript
// For CREATE_APPOINTMENT_SLOTS:
if (extractedCount >= 5) return 'high';   // Has most fields
if (extractedCount >= 3) return 'medium'; // Has essential fields
return 'low';
```

---

### POST /api/voice/chat

**Purpose**: Conversational data refinement using GPT-4o

**Request:**
```typescript
POST /api/voice/chat
Content-Type: application/json

{
  "sessionType": "CREATE_APPOINTMENT_SLOTS",
  "messages": [
    { "role": "user", "content": "De lunes a viernes..." },
    { "role": "assistant", "content": "He registrado..." },
    { "role": "user", "content": "Cambia el precio a 600" }
  ],
  "currentData": {
    "startDate": "2024-02-01",
    // ... existing data
    "basePrice": 500
  },
  "context": {
    "doctorId": "doc_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Perfecto, he actualizado el precio base a $600.",
    "structuredData": {
      // ... merged data with basePrice: 600
    },
    "fieldsExtracted": ["basePrice"],
    "isComplete": false
  }
}
```

---

## Components

### VoiceRecordingModal

**Purpose**: Phase 1 - Audio recording and initial processing

**Props:**
```typescript
interface VoiceRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: 'CREATE_APPOINTMENT_SLOTS';
  context?: VoiceSessionContext;
  onComplete: (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => void;
}
```

**Reference Guide Content:**
```typescript
CREATE_APPOINTMENT_SLOTS: {
  title: 'Crear Horarios de Citas',
  icon: <Calendar className="w-5 h-5" />,
  items: [
    'Rango de fechas (ej: "del 1 al 28 de febrero")',
    'Días de la semana (ej: "lunes a viernes", "solo lunes y jueves")',
    'Horario de atención (ej: "de 9 de la mañana a 5 de la tarde")',
    'Duración de citas (ej: "citas de 60 minutos", "cada media hora")',
    'Descanso - OPCIONAL (ej: "con descanso de 12 a 1")',
    'Precio por cita (ej: "500 pesos", "precio 750")',
    'Descuento - OPCIONAL (ej: "con 10% de descuento", "menos 50 pesos")',
  ],
}
```

---

### VoiceChatSidebar

**Purpose**: Phase 2 - Conversational data refinement

**Props:**
```typescript
interface VoiceChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: 'CREATE_APPOINTMENT_SLOTS';
  patientId: string;  // Use "appointments" for appointments context
  doctorId: string;
  onConfirm: (data: VoiceStructuredData) => void;
  initialData?: InitialChatData;
}
```

**Key Features:**
- Resizable width (320px - 800px)
- Auto-saves to localStorage
- Text + voice message input
- Real-time data preview
- "Confirmar" / "Reintentar" actions

---

### StructuredDataPreview

**Purpose**: Display extracted fields in organized groups

**Field Grouping for Appointments:**
```typescript
const APPOINTMENT_SLOTS_GROUPS = {
  dateConfig: {
    label: 'Configuración de Fechas',
    fields: ['startDate', 'endDate', 'daysOfWeek'],
  },
  timeSettings: {
    label: 'Configuración de Horario',
    fields: ['startTime', 'endTime', 'duration', 'breakStart', 'breakEnd'],
  },
  pricing: {
    label: 'Precios',
    fields: ['basePrice', 'discount', 'discountType'],
  },
};
```

**Field Formatting:**
```typescript
// Days of week: [0,1,2,3,4] → "Lun, Mar, Mié, Jue, Vie"
if (field === 'daysOfWeek') {
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return value.map(day => dayNames[day]).join(', ');
}

// Duration: 60 → "60 minutos"
if (field === 'duration') {
  return `${value} minutos`;
}

// Prices: 500 → "$500"
if (field === 'basePrice' || field === 'discount') {
  return `$${value}`;
}
```

---

## Hooks

### useVoiceSession

**Purpose**: Orchestrate Phase 1 (recording → transcription → structuring)

**Usage:**
```typescript
const session = useVoiceSession({
  sessionType: 'CREATE_APPOINTMENT_SLOTS',
  context: { doctorId },
  onComplete: (data) => {
    // Auto-transition to Phase 2
  },
});

// Controls
session.startRecording();
session.stopRecording();
session.processRecording(); // Transcribe + structure
session.reset();
```

**State:**
- `sessionStatus`: 'idle' | 'recording' | 'transcribing' | 'structuring' | 'draft_ready'
- `transcript`: Transcribed text
- `structuredData`: Extracted data
- `fieldsExtracted`: Array of filled fields
- `confidence`: 'high' | 'medium' | 'low'

---

### useChatSession

**Purpose**: Manage Phase 2 (chat refinement)

**Usage:**
```typescript
const chat = useChatSession({
  sessionType: 'CREATE_APPOINTMENT_SLOTS',
  patientId: 'appointments',
  doctorId: doctorId,
  initialData: {
    transcript,
    structuredData,
    transcriptId,
    sessionId,
    audioDuration,
    fieldsExtracted,
  },
  onConfirm: (data) => {
    // Map to form and open CreateSlotsModal
  },
});

// Actions
chat.sendTextMessage("Cambia el precio a 600");
chat.startVoiceMessage();
chat.stopVoiceMessage();
chat.confirmData();
chat.resetSession();
```

**State:**
- `messages`: Full chat history
- `currentData`: Merged structured data
- `fieldsExtracted`: Cumulative extracted fields
- `status`: 'idle' | 'recording' | 'transcribing' | 'thinking' | 'ready'

---

### useChatPersistence

**Purpose**: Auto-save sessions to localStorage

**Key Behavior:**
```typescript
// Save on every message
saveSession(patientId, sessionType, session);

// Load on mount
const saved = loadSession(patientId, sessionType);

// Auto-expire after 24 hours
const EXPIRY_HOURS = 24;
if (now - session.createdAt > EXPIRY_HOURS * 3600 * 1000) {
  clearSession(patientId, sessionType);
}
```

**Storage Key:**
```typescript
`voice-chat-${sessionType}-${patientId}`
// Example: "voice-chat-CREATE_APPOINTMENT_SLOTS-appointments"
```

---

## LLM Prompts

### System Prompt for Structuring

**Location**: `apps/doctor/src/lib/voice-assistant/prompts.ts`

**Key Rules:**

1. **Days of Week Parsing**
```
CRITICAL: Use numeric indices where Monday=0, Tuesday=1, ..., Sunday=6

"lunes a viernes" → [0, 1, 2, 3, 4]
"solo lunes y jueves" → [0, 3]
"todos los días" → [0, 1, 2, 3, 4, 5, 6]
```

2. **Date Range Extraction**
```
"del 1 al 28 de febrero" →
  startDate: "2024-02-01"
  endDate: "2024-02-28"

"próxima semana" → Calculate actual dates
"este mes" → First and last day of current month
```

3. **Time Parsing**
```
"de 9 a 5" → startTime: "09:00", endTime: "17:00"
"de 8 de la mañana a 2 de la tarde" → "08:00" to "14:00"
```

4. **Duration Detection**
```
"citas de 30 minutos" → 30
"citas de una hora" → 60
"cada hora" → 60
"cada media hora" → 30
```

5. **Pricing & Discounts**
```
"500 pesos" → basePrice: 500
"con 10% de descuento" → discount: 10, discountType: "PERCENTAGE"
"menos 50 pesos" → discount: 50, discountType: "FIXED"
```

**Full Prompt:**
```typescript
export const CREATE_APPOINTMENT_SLOTS_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

## YOUR TASK: STRUCTURE APPOINTMENT SLOT CREATION INFORMATION

Extract appointment slot configuration from the transcript and return a JSON object.
This will be used to create recurring appointment slots for a doctor's availability.
Use null for any field not explicitly mentioned.

## OUTPUT SCHEMA
{
  "startDate": string | null,
  "endDate": string | null,
  "daysOfWeek": number[] | null,
  "startTime": string | null,
  "endTime": string | null,
  "duration": 30 | 60 | null,
  "breakStart": string | null,
  "breakEnd": string | null,
  "basePrice": number | null,
  "discount": number | null,
  "discountType": "PERCENTAGE" | "FIXED" | null
}

... [detailed extraction guidelines] ...
`;
```

---

### Chat System Prompt

**Purpose**: Guide conversational refinement

**Key Capabilities:**
1. Confirm extracted data
2. Suggest missing fields
3. Handle corrections
4. Merge new data with existing
5. Ask clarifying questions

**Example Interactions:**

```typescript
// User asks what's missing
User: "¿Qué me hace falta?"
AI: "Ya tenemos la configuración básica de horarios. Los campos
     que podrías agregar son:
     • Descuento (opcional): Puedes indicar un descuento en
       porcentaje o cantidad fija
     ¿Deseas agregar algún descuento?"

// User corrects data
User: "Cambia el horario a de 8 a 6"
AI: "Perfecto, he actualizado:
     • Horario de inicio: 08:00 (antes 09:00)
     • Horario de fin: 18:00 (antes 17:00)
     Esto creará más horarios disponibles al día."

// User adds discount
User: "Agrega 15% de descuento"
AI: "Entendido, he agregado:
     • Descuento: 15% (tipo porcentaje)
     Con el precio base de $500, el precio final será $425 por cita."
```

---

## Examples

### Example 1: Basic Weekly Schedule

**Voice Command:**
```
"De lunes a viernes, del 1 al 28 de febrero, de 9 de la mañana a 5 de la tarde,
citas de una hora, precio 500 pesos"
```

**Extracted Data:**
```json
{
  "startDate": "2024-02-01",
  "endDate": "2024-02-28",
  "daysOfWeek": [0, 1, 2, 3, 4],
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": 60,
  "breakStart": null,
  "breakEnd": null,
  "basePrice": 500,
  "discount": null,
  "discountType": null
}
```

**Result:** ~80 appointment slots created (20 weekdays × 8 hours / 60 min)

---

### Example 2: Partial Week with Break

**Voice Command:**
```
"Solo lunes, miércoles y viernes, del 5 al 30 de marzo, de 10:00 a 18:00,
citas de 30 minutos, con descanso de 1 a 2 de la tarde, precio 750 pesos"
```

**Extracted Data:**
```json
{
  "startDate": "2024-03-05",
  "endDate": "2024-03-30",
  "daysOfWeek": [0, 2, 4],
  "startTime": "10:00",
  "endTime": "18:00",
  "duration": 30,
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "basePrice": 750,
  "discount": null,
  "discountType": null
}
```

**Calculation:**
- Total hours: 8 hours (10:00-18:00)
- Break: 1 hour (13:00-14:00)
- Available: 7 hours × 2 slots/hour = 14 slots per day
- Days: ~13 Mon/Wed/Fri in range
- Total: ~182 slots

---

### Example 3: Weekend Schedule with Discount

**Voice Command:**
```
"Sábados y domingos del 1 al 31 de enero, de 8 de la mañana a 2 de la tarde,
sesiones de 60 minutos, mil pesos con 20% de descuento"
```

**Extracted Data:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "daysOfWeek": [5, 6],
  "startTime": "08:00",
  "endTime": "14:00",
  "duration": 60,
  "breakStart": null,
  "breakEnd": null,
  "basePrice": 1000,
  "discount": 20,
  "discountType": "PERCENTAGE"
}
```

**Final Price:** $800 per appointment (20% off $1000)

---

### Example 4: Minimal Information

**Voice Command:**
```
"De lunes a viernes de 9 a 5, precio 600"
```

**Extracted Data:**
```json
{
  "startDate": null,
  "endDate": null,
  "daysOfWeek": [0, 1, 2, 3, 4],
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": null,
  "breakStart": null,
  "breakEnd": null,
  "basePrice": 600,
  "discount": null,
  "discountType": null
}
```

**Chat Refinement:**
```
AI: "He registrado la configuración básica de horarios.
     Extraje 4 campos. Para crear los horarios, necesito:

     • Rango de fechas (ej: 'del 1 al 30 de abril')
     • Duración de citas (30 o 60 minutos)

     ¿Podrías proporcionar estos datos?"
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot read properties of undefined (reading 'title')"

**Cause:** Missing welcome message for session type

**Fix:**
```typescript
// In ChatMessageList.tsx
const WELCOME_MESSAGES: Record<VoiceSessionType, { title: string; subtitle: string }> = {
  // ... other types
  CREATE_APPOINTMENT_SLOTS: {
    title: 'Crear Horarios de Citas',
    subtitle: 'Dicte o escriba la configuración de horarios...',
  },
};
```

---

#### 2. "400 Invalid value for 'content': expected a string, got null"

**Cause:** Missing welcome message in chat session

**Fix:**
```typescript
// In useChatSession.ts
function generateAssistantWelcomeMessage(data, sessionType) {
  const messages: Record<VoiceSessionType, string> = {
    // ... other types
    CREATE_APPOINTMENT_SLOTS: `He registrado la configuración de horarios.
                                Extraje ${fieldCount} campos.
                                ¿Deseas agregar o modificar algo?`,
  };
  return messages[sessionType];
}
```

---

#### 3. "POST /api/voice/structure 400 (Bad Request)"

**Cause:** Session type not in valid session types

**Fix:**
```typescript
// In apps/doctor/src/app/api/voice/structure/route.ts
const validSessionTypes: VoiceSessionType[] = [
  'NEW_PATIENT',
  'NEW_ENCOUNTER',
  'NEW_PRESCRIPTION',
  'CREATE_APPOINTMENT_SLOTS', // ← Add this
];
```

Also update:
- `/api/voice/chat/route.ts`
- `prompts.ts` - `getSystemPrompt()`, `getSchemaForSessionType()`, `getAllFieldsForSessionType()`, `getSessionTypeGuidelines()`

---

#### 4. Days of Week Not Working

**Symptom:** Wrong days selected in form

**Cause:** Index mismatch (0=Sunday in JavaScript vs 0=Monday in our system)

**Solution:** Always use our mapping:
```typescript
// Our system (used by LLM):
0=Monday, 1=Tuesday, ..., 6=Sunday

// When mapping to/from form:
const daysOfWeek = voiceData.daysOfWeek || [0,1,2,3,4];
```

---

#### 5. CreateSlotsModal Not Pre-filling

**Cause:** `initialData` not being passed or applied

**Debug:**
```typescript
// In appointments/page.tsx
console.log('Voice form data:', voiceFormData);

// In CreateSlotsModal.tsx
useEffect(() => {
  console.log('Received initialData:', initialData);
  if (initialData) {
    // ... apply fields
  }
}, [initialData]);
```

**Fix:** Ensure `initialData` prop is passed:
```typescript
<CreateSlotsModal
  isOpen={showCreateModal}
  onClose={handleClose}
  doctorId={doctorId}
  onSuccess={handleSuccess}
  initialData={voiceFormData} // ← Must pass this
/>
```

---

### Debug Checklist

When voice assistant doesn't work:

- [ ] Check browser console for errors
- [ ] Verify `CREATE_APPOINTMENT_SLOTS` in all API routes
- [ ] Confirm prompts file has all functions updated
- [ ] Check welcome messages in ChatMessageList and useChatSession
- [ ] Verify localStorage key format
- [ ] Test with simple voice command first
- [ ] Check network tab for API responses
- [ ] Verify OpenAI API key is set

---

### Performance Optimization

**Audio File Size:**
- WebM codec: ~10KB per second
- 30-second recording: ~300KB
- Acceptable for API upload

**LLM Token Usage:**
```
Structure API:
- System prompt: ~2,500 tokens
- User prompt: ~100 tokens
- Response: ~200 tokens
- Total: ~2,800 tokens/request

Chat API:
- System prompt: ~3,000 tokens
- Conversation: ~50 tokens/message
- Total: ~3,000 + (50 × messages)
```

**Recommendations:**
- Keep prompts concise
- Limit chat history to last 10 messages
- Use GPT-4o (faster than GPT-4)
- Cache system prompts where possible

---

## Best Practices

### 1. Voice Recording

✅ **Do:**
- Speak clearly and naturally
- Mention all required fields
- Use complete sentences
- Include context (dates, times, prices)

❌ **Don't:**
- Rush or speak too fast
- Skip essential fields (days, times, price)
- Use ambiguous dates ("next week" without context)

---

### 2. Chat Refinement

✅ **Do:**
- Ask "¿Qué me hace falta?" to see missing fields
- Be specific when correcting ("Cambia el precio a 600")
- Confirm before clicking "Confirmar"

❌ **Don't:**
- Assume AI knows unstated information
- Make multiple changes in one message
- Skip reviewing the data preview

---

### 3. Form Review

✅ **Do:**
- Always review pre-filled CreateSlotsModal
- Check slot preview count
- Verify all dates and times
- Confirm pricing calculations

❌ **Don't:**
- Blindly submit without review
- Ignore validation warnings
- Create overlapping time slots

---

## Future Enhancements

### Planned Features

1. **Multi-location Support**
   - Voice: "Consultorio A: lunes y martes, Consultorio B: miércoles a viernes"

2. **Recurring Templates**
   - Save common schedules
   - "Usa mi horario habitual de febrero"

3. **Smart Suggestions**
   - AI suggests optimal slot duration based on specialty
   - Recommend break times based on schedule length

4. **Batch Operations**
   - "Elimina todos los horarios del próximo lunes"
   - "Bloquea la próxima semana"

5. **Voice Commands for Bulk Actions**
   - "Bloquear del 15 al 20 de marzo"
   - "Eliminar horarios de sábados en febrero"

---

## Conclusion

The Appointment Slots Voice Assistant streamlines the process of creating recurring availability by:

1. **Reducing time** from 2-3 minutes to 15 seconds
2. **Improving accuracy** with conversational refinement
3. **Enhancing UX** with natural language input
4. **Maintaining flexibility** with manual form fallback

The two-phase workflow (recording → chat) ensures data quality while the auto-save feature prevents data loss. Integration with the existing CreateSlotsModal maintains consistency across the application.

---

**Version**: 1.0.0
**Last Updated**: January 2026
**Author**: Claude Code Implementation Team
