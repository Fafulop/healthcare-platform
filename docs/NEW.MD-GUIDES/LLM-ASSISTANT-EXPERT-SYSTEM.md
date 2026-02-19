# LLM Assistant — Expert System Architecture

**Status:** Phase 1 & 2 Complete · Phase 3 Pending
**Last Updated:** 2026-02-18
**Scope:** Transforms the LLM help assistant from a "doc reader chatbot" into a deterministic, context-aware in-product expert

---

## Table of Contents

1. [The Problem We Solved](#1-the-problem-we-solved)
2. [Architecture Overview — 3-Layer Knowledge Model](#2-architecture-overview--3-layer-knowledge-model)
3. [What Was Built (Phase 1 & 2)](#3-what-was-built-phase-1--2)
4. [File-by-File Reference](#4-file-by-file-reference)
5. [How the System Works End-to-End](#5-how-the-system-works-end-to-end)
6. [The Capability Map — Full Reference](#6-the-capability-map--full-reference)
7. [What Still Needs to Be Built (Phase 3)](#7-what-still-needs-to-be-built-phase-3)
8. [RAG Doc Rewrite Spec — Module by Module](#8-rag-doc-rewrite-spec--module-by-module)
9. [Re-Ingestion Instructions](#9-re-ingestion-instructions)
10. [Future Roadmap (Post Phase 3)](#10-future-roadmap-post-phase-3)

---

## 1. The Problem We Solved

### Before

The assistant was a pure RAG chatbot:

```
User question → embed → pgvector similarity search → LLM reads docs → answer
```

**Problems:**
- Business rules lived only in markdown docs (could be vague, outdated, or never written)
- The LLM had to infer rules from explanatory text — could hallucinate or get them wrong
- No awareness of where the user was in the app
- Same answer regardless of context (user on appointments page vs. medical records)
- For questions like "why can't I delete this?" → unreliable answers

### After

The assistant is a 3-layer expert system:

```
User question + current URL path
  → Layer 1: Capability Map   (deterministic rules — always injected, zero hallucination)
  → Layer 2: RAG Documents    (explanations, how-to, walkthroughs)
  → Layer 3: UI Context       (which page/module the user is on right now)
  → LLM generates precise, grounded answer
```

**Result:** The LLM knows that a slot with `currentBookings > 0` cannot be closed, gives the exact error message, and tells the user to cancel the booking first — because that rule is hardcoded in TypeScript, not embedded in a paragraph.

---

## 2. Architecture Overview — 3-Layer Knowledge Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYSTEM PROMPT                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: CAPABILITY MAP                                │   │
│  │  Source: capabilities.ts (TypeScript — no DB needed)    │   │
│  │  Content: What actions exist, when allowed, when        │   │
│  │           blocked, exact resolution steps               │   │
│  │  Priority: HIGHEST — overrides everything else          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: UI CONTEXT                                    │   │
│  │  Source: usePathname() → sent with each request         │   │
│  │  Content: "User is on page: /appointments"              │   │
│  │  Purpose: Module detection boost + situational answers  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Memory (last 2 conversation turns)                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          USER TURN                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: RAG DOCUMENTS                                 │   │
│  │  Source: pgvector (Railway) — markdown chunks           │   │
│  │  Content: Explanations, flows, how-to walkthroughs      │   │
│  │  Retrieved via: HNSW cosine similarity search           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  User Question                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Each Layer Exists

| Layer | Answers | Why not RAG? | Why not hardcode? |
|-------|---------|--------------|-------------------|
| Capability Map | What's allowed/blocked and why | Rules must be deterministic — RAG can miss or misstate them | — |
| RAG Documents | How does this work? What is this module? Step-by-step guides | Too much content to hardcode | Explanatory content is large and changes with the app |
| UI Context | Why can't I do THIS specific thing right now? | No way to know where user is from question text alone | Changes every page navigation |

---

## 3. What Was Built (Phase 1 & 2)

### Phase 1 — Capability Map

**File created:** `apps/doctor/src/lib/llm-assistant/capabilities.ts`

A TypeScript file (not a database table, not markdown) containing a structured map of every module's entities, their possible states, every action with its conditions:

- When it's allowed
- When it's blocked (and the exact reason)
- The exact resolution steps the user must take
- Important notes (error messages, side effects, constraints)

**Modules covered:**

| Module | Entities | Actions documented |
|--------|----------|--------------------|
| `appointments` | Horario (Slot), Reservación (Booking) | 9 actions |
| `medical-records` | Paciente, Consulta, Prescripción, Multimedia, Plantilla | 14 actions |
| `practice-management` | Venta, Cotización, Compra, Movimiento (Flujo), Área, Producto, Cliente/Proveedor | 16 actions |

**Helper functions also in `capabilities.ts`:**
- `formatCapabilityMapForPrompt(moduleIds[])` — formats the map as a readable prompt block for the LLM
- `getModulesFromPath(path)` — maps a URL path to its module ID(s)

---

### Phase 2 — UI Context Threading

**6 existing files modified:**

#### `types.ts`
Added:
```typescript
export interface UIContext {
  currentPath: string; // e.g. "/appointments" or "/dashboard/practice/ventas"
}
```
Extended `UserQuery` with optional `uiContext?: UIContext`.

#### `constants.ts`
- Added `TOKEN_BUDGET_CAPABILITIES = 700` (capability map gets 700 tokens in the system prompt)
- Reduced `TOKEN_BUDGET_DOCS` from 3000 → 2500 (to make room)
- Updated `DOCS_SKIP_FILES` to exclude 6 developer-facing setup docs that should never be used as RAG content for end users

#### `query/prompt-assembler.ts`
Fully rewritten. New system prompt structure:
1. Role definition with updated rules (capability map has priority)
2. Module list (static)
3. **Capability map** (new — injected before docs)
4. Memory (last 2 turns)
5. **UI context** (new — "User is on: /appointments")

User turn: RAG docs + question (unchanged structure, reduced token budget)

#### `query/pipeline.ts`
Fully rewritten. Key changes:
- Accepts and threads `uiContext` through the pipeline
- **Cache key now includes current path** (`[/appointments] question text`) so the same question on different pages can return different answers
- Path-based modules are **prepended** to detected modules (higher priority)
- Capability map is built for ALL relevant modules (path + detected + RAG-retrieved)
- Passes `capabilityMapText` and `uiContext` to `assemblePrompt`

#### `app/api/llm-assistant/chat/route.ts`
- Reads `uiContext` from request body
- Validates `uiContext.currentPath` is a string before passing to pipeline

#### `hooks/useLlmChat.ts`
- Added `usePathname()` from Next.js
- Sends `uiContext: { currentPath }` with every API request
- `currentPath` updates automatically on every page navigation

---

## 4. File-by-File Reference

```
apps/doctor/src/lib/llm-assistant/
│
├── capabilities.ts              ← NEW — the capability map (primary source of truth)
├── types.ts                     ← MODIFIED — added UIContext, extended UserQuery
├── constants.ts                 ← MODIFIED — TOKEN_BUDGET_CAPABILITIES, DOCS_SKIP_FILES
│
├── query/
│   ├── pipeline.ts              ← MODIFIED — threads UIContext, builds capability map
│   ├── prompt-assembler.ts      ← MODIFIED — injects capability map + UI context
│   ├── retriever.ts             ← unchanged
│   ├── module-detector.ts       ← unchanged
│   ├── cache.ts                 ← unchanged (cache key logic moved to pipeline)
│   ├── deduplicator.ts          ← unchanged
│   └── memory.ts                ← unchanged
│
├── ingestion/
│   └── pipeline.ts              ← unchanged
│
├── sync/
│   └── index.ts                 ← unchanged
│
├── embedding.ts                 ← unchanged
├── llm-client.ts                ← unchanged
├── db.ts                        ← unchanged
├── modules.ts                   ← unchanged (see Phase 3 — needs new modules added)
├── tokenizer.ts                 ← unchanged
└── errors.ts                    ← unchanged

apps/doctor/src/
├── app/api/llm-assistant/chat/route.ts   ← MODIFIED — accepts uiContext
└── hooks/useLlmChat.ts                   ← MODIFIED — sends currentPath
```

---

## 5. How the System Works End-to-End

### Request Flow

```
1. User types question in ChatWidget
        ↓
2. useLlmChat.sendMessage()
   - Captures currentPath via usePathname()
   - POST /api/llm-assistant/chat
     { question, sessionId, uiContext: { currentPath } }
        ↓
3. route.ts
   - Auth check
   - Validates uiContext.currentPath
   - Calls processQuery({ question, sessionId, userId, uiContext })
        ↓
4. pipeline.ts — processQuery()
   ├── Step 1: Validate (not empty, ≤200 tokens)
   ├── Step 2: Check cache (key = "[/path] question")
   ├── Step 3: Generate embedding (OpenAI text-embedding-3-small)
   ├── Step 4: Detect modules
   │           - pathModules = getModulesFromPath(currentPath)
   │           - detectedModules = hybrid keyword + embedding detection
   │           - merged = [...pathModules, ...detectedModules] (path first)
   ├── Step 5: Retrieve chunks (pgvector HNSW cosine, threshold 0.5, top 10)
   ├── Step 6: Deduplicate chunks
   ├── Step 7: Load memory (last 2 turns from DB)
   ├── Step 8: Build capability map
   │           - allModuleIds = path + detected + RAG modules (deduplicated)
   │           - capabilityMapText = formatCapabilityMapForPrompt(allModuleIds)
   ├── Step 9: Assemble prompt (system + capability map + UI context + docs + question)
   ├── Step 10: Call LLM (gpt-4o-mini, temp 0.1, max 1024 tokens)
   ├── Step 11: Save to cache (24h TTL)
   └── Step 12: Update memory
        ↓
5. Response: { answer, sources, confidence, cached, modulesUsed }
        ↓
6. ChatWidget renders the answer
```

### Token Budget Breakdown

```
System prompt:
  Role + rules          ~300 tokens
  Module list           ~200 tokens
  Capability map        ≤700 tokens  ← new
  Memory                ≤300 tokens
  UI context            ~20 tokens   ← new

User turn:
  RAG docs              ≤2500 tokens (was 3000)
  Question              ≤200 tokens

Total:                  ~4220 tokens  (gpt-4o-mini: 128K context, no issue)
Output:                 ≤1024 tokens
```

### Cache Key Change

**Before:** `SHA256("¿por qué no puedo cerrar el horario?")`
**After:** `SHA256("[/appointments] ¿por qué no puedo cerrar el horario?")`

Same question on `/appointments` vs `/dashboard/medical-records` now gets separate cache entries, allowing context-appropriate answers.

---

## 6. The Capability Map — Full Reference

**File:** `apps/doctor/src/lib/llm-assistant/capabilities.ts`

### How to Add a New Module

```typescript
export const CAPABILITY_MAP: Record<string, ModuleCapabilities> = {
  // ... existing modules ...

  'new-module-id': {
    name: 'Display Name',
    routes: ['/dashboard/new-module'],
    entities: {
      'Entity Name': {
        states: 'state1 (description) | state2 (description)',
        transitions: 'state1 → action → state2',
        actions: {
          'action name': {
            allowedIf: 'condition when allowed',
            blockedIf: 'condition when blocked',
            resolution: 'exact steps to unblock',
            notes: 'extra context, error messages, side effects',
          },
        },
      },
    },
  },
};
```

### How to Add a New Entity to an Existing Module

Find the module in `CAPABILITY_MAP` and add a new key to `entities`:

```typescript
'medical-records': {
  entities: {
    // existing entities...
    'New Entity': {
      states: '...',
      actions: { ... },
    },
  },
},
```

### How to Add a New URL → Module Mapping

Update `getModulesFromPath()` at the bottom of `capabilities.ts`:

```typescript
export function getModulesFromPath(path: string): string[] {
  if (path.startsWith('/appointments')) return ['appointments'];
  if (path.startsWith('/dashboard/medical-records')) return ['medical-records'];
  if (path.startsWith('/dashboard/practice')) return ['practice-management'];
  if (path.startsWith('/dashboard/blog')) return ['blog'];
  if (path.startsWith('/dashboard/pendientes')) return ['pendientes'];  // ← add new
  return [];
}
```

### How the Prompt Block Looks

When the user is on `/appointments`, this is injected into the system prompt:

```
REGLAS DE LA APLICACIÓN (fuente de verdad — prioridad sobre documentación):

━━━ CITAS ━━━

[Horario (Slot)]
Estados: Disponible (isOpen=true, sin reservas) | Lleno (isOpen=true, reservas al máximo) | Cerrado (isOpen=false)
  · eliminar:
    ✅ Siempre — incluso si tiene reservas activas.
    ℹ Si el horario tiene reservas activas el sistema muestra confirmación que cancela todas las reservas automáticamente.
  · cerrar:
    ✅ Solo si el horario NO tiene reservas activas (currentBookings = 0).
    ❌ BLOQUEADO: El horario tiene reservas activas (currentBookings > 0).
    → SOLUCIÓN: Primero cancela las reservas activas desde "Citas Reservadas", luego ciérralo.
    ℹ Mensaje exacto: "No se puede cerrar este horario porque tiene N reserva(s) activa(s). Por favor cancela las reservas primero."

[Reservación (Booking)]
Transiciones: PENDING → Confirmar o Cancelar | CONFIRMED → Completada, No Asistió, o Cancelar | COMPLETED/CANCELLED/NO_SHOW → sin acciones
  · cancelar:
    ✅ Desde PENDING o CONFIRMED.
    ❌ BLOQUEADO: Estado es COMPLETED, CANCELLED o NO_SHOW.
    ℹ Al cancelar la reservación el horario vuelve a estado Disponible.
```

---

## 7. What Still Needs to Be Built (Phase 3)

Phase 3 has two components that must both be done for the system to reach full expert quality:

### 3A — Update `modules.ts` (Add Missing Modules)

The module list drives keyword detection AND determines which RAG docs get retrieved. These modules exist in the app but have no entries in `modules.ts` or docs in `docs/llm-assistant/`:

| Missing Module | Routes | What it covers |
|----------------|--------|----------------|
| `pendientes` | `/dashboard/pendientes` | Task management — PENDIENTE/EN_PROGRESO/COMPLETADA/CANCELADA, priority (ALTA/MEDIA/BAJA), linked patients, time conflicts |
| `profile` | `/dashboard/profile` (implied) | Doctor public profile — general info, clinic, education, services, FAQs, social links, color palette, reviews, media |
| `audiovisual` | `/dashboard/contenido-audiovisual` | Audiovisual content management |
| `dashboard` | `/` | Home dashboard — recent activity table, day details widget, stats |

**How to add to `modules.ts`:**
```typescript
{
  id: 'pendientes',
  name: 'Pendientes y Tareas',
  description: 'Gestión de tareas y pendientes del consultorio con prioridades y fechas límite',
  keywords: [
    'pendiente', 'tarea', 'tareas', 'pendientes', 'recordatorio',
    'prioridad', 'alta', 'media', 'baja', 'completar', 'vencimiento',
    'EN_PROGRESO', 'COMPLETADA', 'CANCELADA',
  ],
  submodules: [],
  filePaths: ['docs/llm-assistant/modules/pendientes.md'],
},
```

Also add to `CAPABILITY_MAP` in `capabilities.ts`:
```typescript
pendientes: {
  name: 'Pendientes',
  routes: ['/dashboard/pendientes'],
  entities: {
    'Tarea (Pendiente)': {
      states: 'PENDIENTE | EN_PROGRESO | COMPLETADA | CANCELADA',
      actions: {
        crear: { allowedIf: 'Siempre.' },
        editar: { allowedIf: 'Siempre.' },
        eliminar: { allowedIf: 'Siempre — requiere confirmación.' },
        'vincular a paciente': { notes: 'Opcional. Aparece en el perfil del paciente vinculado.' },
        'conflicto de horario': {
          notes:
            'El DayDetailsModal detecta automáticamente conflictos entre pendientes y citas reservadas en el mismo horario. ' +
            'Es solo una advertencia informativa — no bloquea ninguna acción.',
        },
      },
    },
  },
},
```

---

### 3B — Rewrite RAG Documentation (Module by Module)

The existing docs in `docs/llm-assistant/modules/` are outdated and too generic. They need to be rewritten with:

- Exact current UI labels and button names
- All current form fields with validation rules
- All error messages (exact text)
- Step-by-step flows using real navigation paths
- Edge cases and common points of confusion
- No duplicate rules (rules live in `capabilities.ts` — docs explain the *why* and the *how*, not the *what is allowed*)

**Priority order for rewrite (highest impact first):**

| # | File | Why high priority | Current quality |
|---|------|-------------------|-----------------|
| 1 | `appointments/slots.md` | Most user confusion | OK but missing bulk actions, voice flow, conflict on create |
| 2 | `appointments/bookings.md` | Critical flows | OK but missing NO_SHOW, booking → encounter link |
| 3 | `medical-records/encounters.md` | Complex — SOAP, templates, versions | Outdated — missing AI chat, template system details |
| 4 | `medical-records/prescriptions.md` | High stakes — PDF, status lifecycle | Outdated — missing AI chat, cancel flow details |
| 5 | `practice-management/sales.md` | Daily use | Outdated — missing inline edit, bulk PDF export |
| 6 | `practice-management/cash-flow.md` | Complex areas/subareas | Outdated — missing voice batch, area type constraint |
| 7 | `medical-records/patients.md` | Foundation | Mostly OK |
| 8 | `practice-management/purchases.md` | Similar to sales | Outdated |
| 9 | `practice-management/clients.md` | Mostly simple | OK |
| 10 | `practice-management/suppliers.md` | Mostly simple | OK |
| 11 | `medical-records/media.md` | Media constraints | Missing file size limits, body areas |
| 12 | `blog.md` | Lower traffic | Unknown state |
| 13 | `features/voice-assistant.md` | Cross-module | Missing new flows |
| 14 | `features/navigation.md` | Cross-module | May be OK |

**NEW docs that need to be created (don't exist yet):**

| File to create | Content |
|----------------|---------|
| `modules/pendientes.md` | Full pendientes module — statuses, priority system, time conflict detection, patient linking |
| `modules/profile.md` | Doctor profile sections — general info, clinic, education, services, FAQs, social, colors, media, reviews |
| `modules/appointments/create-slots.md` | Deep dive into CreateSlotsModal — single vs recurring, break config, conflict detection on create, voice flow |
| `modules/practice-management/quotations.md` | Cotizaciones — status machine, create from client, link to sale |
| `modules/practice-management/areas.md` | Areas and subareas — immutable type rule, cascade delete, subarea management |

---

### 3C — Spec for Each Doc Rewrite

#### `appointments/slots.md` — What to add/fix

**Currently missing:**
- Bulk actions (Cerrar/Abrir/Eliminar múltiples) and their constraints
- Voice assistant flow for creating slots (VoiceRecordingModal → VoiceChatSidebar → CreateSlotsModal)
- CreateSlotsModal: Single Day vs Recurring mode distinction
- Recurring: day-of-week picker, date range, preview count
- Break configuration in CreateSlotsModal
- Conflict detection on create: what happens when a conflicting slot exists (409 response, option to replace)
- Discount types: PERCENTAGE vs FIXED
- `finalPrice` calculation formula
- `maxBookings` field — a slot can have multiple bookings (not just 1)
- Calendar dots indicate days with slots
- List view vs Calendar view differences
- "Ver todos" toggle (show all months vs single day)

#### `appointments/bookings.md` — What to add/fix

**Currently missing:**
- All 5 booking statuses: PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
- Exact status transitions and available action buttons per status
- `patientWhatsapp` field in booking data
- `confirmationCode` format and use
- Day Details Modal shows bookings alongside tasks — conflict detection
- DayDetailsWidget floating button with badge count
- After attending a booking — no automatic link to medical records, must create encounter manually

#### `medical-records/encounters.md` — What to add/fix

**Currently missing:**
- AI Chat panel (indigo "Chat IA" button) — real-time field suggestions from AI
- Voice assistant for encounters (currently shown as disabled on new encounter page)
- Full SOAP field structure: S (Subjetivo), O (Objetivo), A (Evaluación), P (Plan) with exact hints
- Vitals: all 7 fields, their units, valid ranges (e.g., temperature 30-45°C, O2 0-100%)
- BMI auto-calculation from weight + height, with categories
- Template system: useSOAPMode toggle, fieldVisibility object — which template shows which fields
- Custom templates vs standard templates — different required fields
- Version history: auto-created on every edit, accessible from /versions page
- Encounter updates patient's `lastVisitDate` automatically
- `encounterType` options: consultation, follow-up, emergency, telemedicine

#### `medical-records/prescriptions.md` — What to add/fix

**Currently missing:**
- AI Chat panel for prescriptions
- Medication validation rules: needs drugName + dosage + frequency + instructions to be "valid"
- Cancellation flow requires a reason (mandatory text field)
- `expiresAt` field — prescription can expire automatically
- `encounterId` optional link to encounter
- PDF opens in new browser tab (window.open '_blank')
- Status badges: exact colors (yellow=draft, green=issued, red=cancelled, gray=expired)
- `doctorLicense` is labeled "Cédula Profesional" in the UI

#### `practice-management/sales.md` — What to add/fix

**Currently missing:**
- Inline amount editing (click the Cobrado column value to edit)
- Payment status auto-calculation: 0=PENDING, partial=PARTIAL, full=PAID
- PDF export requires checkbox selection first
- All 6 sale statuses and exact transitions
- Item types: "service" (default) vs "product"
- Item unit options: servicio, pza, kg, lt, hora, sesion
- AI chat panel for creating/editing sales
- Voice batch creation for multiple sales at once

#### `practice-management/cash-flow.md` — What to add/fix

**Currently missing:**
- Area type is immutable — this is the most important rule and must be prominent
- Deleting an area cascades to all subareas
- 5 payment methods: efectivo, transferencia, tarjeta, cheque, depósito
- Voice batch entry — multiple movements detected in one dictation
- Batch entry preview UI (BatchEntryList component)
- Filtering: by entry type, por realizar, date range
- Concept max 500 characters
- transactionType field (inferred from context: "Sale", "Purchase", "N/A")

---

## 8. RAG Doc Rewrite Spec

### Writing Guidelines for All Docs

Every rewritten doc should follow this structure:

```markdown
# [Module Name] — [Entity/Feature]

## Qué es
One paragraph explaining what this is and why it exists.

## Acceso
Exact navigation path: Menu item → Submenu → Page name
URL: /exact/url/path

## Estados [if entity has states]
| Estado | Color/Badge | Significado | Acciones disponibles |
|--------|-------------|-------------|---------------------|
| ...    | ...         | ...         | ...                 |

## Flujos principales

### [Flow 1 Name]
Step by step using exact UI button labels.
Note any preconditions.
Note what happens after (side effects).

### [Flow 2 Name]
...

## Campos del formulario [for create/edit forms]
| Campo | Tipo | Requerido | Validación | Placeholder/Ejemplo |
|-------|------|-----------|-----------|---------------------|
| ...   | ...  | ...       | ...       | ...                 |

## Mensajes de error
List every error message the user can see (exact text).

## Preguntas frecuentes
Q&A format for the top 5-8 questions users will actually ask.

## Lo que NO es posible
Explicit list of limitations (things users try and can't do).
```

### What NOT to Put in Docs

- Do not duplicate rules that are already in `capabilities.ts` — the LLM will use the capability map for those
- Do not say "you cannot delete a reserved slot" without also explaining the flow to fix it (that's the capability map's job)
- Do not put developer notes, API specs, or database details — user-facing content only

---

## 9. Re-Ingestion Instructions

After completing Phase 3 doc rewrites, re-ingest the updated docs into pgvector:

### Development (Local Machine → Railway pgvector)

```bash
# Ensure LLM_DATABASE_URL is set in apps/doctor/.env.local
# Then hit the ingest endpoint (requires admin auth):
curl -X POST http://localhost:3000/api/llm-assistant/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session cookie]"
```

Or trigger from the admin panel if one exists.

### What the Ingestion Does

1. Scans all files in `docs/llm-assistant/` (skips `DOCS_SKIP_FILES`)
2. For each file: checks SHA-256 hash against `llm_docs_file_hashes` table
3. If changed: deletes old chunks, generates new embeddings, inserts new chunks
4. If unchanged: skips (incremental sync)

### After Ingestion

Verify with a few test questions in the chat widget:
- "¿Cómo creo una receta?" → should describe the full prescription creation flow
- "¿Por qué no puedo editar esta receta?" → capability map should answer (no RAG needed)
- "¿Qué es el SOAP?" → RAG should answer
- "¿Por qué no puedo cerrar el horario?" → capability map answer + RAG for context

---

## 10. Future Roadmap (Post Phase 3)

These are ideas from the original design brief that go beyond the current implementation. Listed in order of impact:

### 10.1 — Entity-Level UI Context

Currently we send `currentPath: "/appointments"` — the module level.

The next level is entity-level context: "User is viewing slot #42, which has status BOOKED".

**What this enables:**
> "¿Por qué no puedo cerrar ESTE horario?" → "Porque el horario que tienes seleccionado tiene 2 reservas activas. Para cerrarlo debes cancelar la reserva de [PatientName] primero."

**How to implement:**
1. When user opens a slot/booking/sale detail, capture the entity state
2. Pass it in `uiContext`:
   ```typescript
   uiContext: {
     currentPath: '/appointments',
     entity: {
       type: 'slot',
       id: slot.id,
       status: slot.isOpen ? (slot.currentBookings > 0 ? 'booked' : 'open') : 'closed',
       currentBookings: slot.currentBookings,
     }
   }
   ```
3. Update `UIContext` type in `types.ts`
4. Format in `prompt-assembler.ts`: "Usuario está viendo: Horario del 15 Feb 10:00-11:00 — Estado: Reservado (2 reservas activas)"

### 10.2 — Action Agent (Execute, Don't Just Guide)

Currently the assistant only explains. The next evolution is an agent that can actually take actions:

```
User: "Cancela la reservación de María García"
Agent: [looks up booking] → [calls PATCH /api/appointments/bookings/{id} with status CANCELLED]
       "Listo, cancelé la reservación de María García para el 15 de febrero."
```

**Requires:**
- New system prompt mode: "agent" vs "guide"
- Tool calling via OpenAI function calling
- The `CAPABILITY_MAP` becomes the permission system for the agent (if `blockedIf` conditions are met, agent refuses)
- Careful confirmation flows before destructive actions

### 10.3 — Proactive Suggestions

When the user navigates to a page with blocked actions, the assistant could proactively surface a tip:

> "Veo que tienes 3 horarios con reservaciones activas. Si quieres cerrarlos, primero cancela las reservas."

**Requires:** Page-level hooks that check state and trigger pre-emptive messages.

### 10.4 — Onboarding Flows

Use the capability map + UI context to guide new doctors through setup:

> "Veo que aún no has creado horarios. ¿Quieres que te guíe? Es fácil: 1. Abre Citas → 2. Click en Crear Horarios..."

### 10.5 — Error Message Interception

When the app shows an error toast (e.g., "No se puede cerrar este horario..."), the chat widget could automatically offer help:

> "Veo que tuviste un error. ¿Quieres que te explique cómo resolverlo?"

**Requires:** Error event system that communicates from the app to the ChatWidget.

---

## Quick Reference — Capability Map Modules

| Module ID | Display Name | Routes | Status |
|-----------|-------------|--------|--------|
| `appointments` | Citas | `/appointments` | ✅ Complete |
| `medical-records` | Expedientes Médicos | `/dashboard/medical-records/*` | ✅ Complete |
| `practice-management` | Gestión de Consultorio | `/dashboard/practice/*` | ✅ Complete |
| `blog` | Blog | `/dashboard/blog` | ⚠️ Not in capability map |
| `pendientes` | Pendientes | `/dashboard/pendientes` | ❌ Missing — Phase 3 |
| `profile` | Perfil del Médico | `/dashboard/profile` | ❌ Missing — Phase 3 |
| `audiovisual` | Contenido Audiovisual | `/dashboard/contenido-audiovisual` | ❌ Missing — Phase 3 |
| `navigation` | Navegación | (global) | ⚠️ RAG only — no rules needed |
| `general` | General | (global) | ⚠️ RAG only — no rules needed |

---

*Document maintained by engineering. Update after every significant change to the capability map or RAG documents.*
