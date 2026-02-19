# LLM Assistant — Expert System Architecture

**Status:** Phases 1, 2 & 3 Complete · Pending: pgvector re-ingestion
**Last Updated:** 2026-02-18
**Scope:** Transforms the LLM help assistant from a "doc reader chatbot" into a deterministic, context-aware in-product expert

---

## Table of Contents

1. [The Problem We Solved](#1-the-problem-we-solved)
2. [Architecture Overview — 3-Layer Knowledge Model](#2-architecture-overview--3-layer-knowledge-model)
3. [What Was Built (Phase 1 & 2)](#3-what-was-built-phase-1--2)
4. [What Was Built (Phase 3)](#4-what-was-built-phase-3)
5. [File-by-File Reference](#5-file-by-file-reference)
6. [How the System Works End-to-End](#6-how-the-system-works-end-to-end)
7. [The Capability Map — Full Reference](#7-the-capability-map--full-reference)
8. [Re-Ingestion Instructions](#8-re-ingestion-instructions)
9. [Future Roadmap (Post Phase 3)](#9-future-roadmap-post-phase-3)

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
| `pendientes` | Tarea (Pendiente) | 5 actions |
| `profile` | Perfil Público | 3 actions |

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
- Updated `DOCS_SKIP_FILES` to exclude 6 developer-facing setup docs

#### `query/prompt-assembler.ts`
Fully rewritten. New system prompt structure:
1. Role definition with updated rules (capability map has priority)
2. Module list (static)
3. **Capability map** (new — injected before docs)
4. Memory (last 2 turns)
5. **UI context** (new — "User is on: /appointments")

#### `query/pipeline.ts`
Fully rewritten. Key changes:
- Accepts and threads `uiContext` through the pipeline
- **Cache key now includes current path** (`[/appointments] question text`)
- Path-based modules are **prepended** to detected modules (higher priority)
- Capability map is built for ALL relevant modules (path + detected + RAG-retrieved)

#### `app/api/llm-assistant/chat/route.ts`
- Reads `uiContext` from request body
- Validates `uiContext.currentPath` is a string

#### `hooks/useLlmChat.ts`
- Added `usePathname()` from Next.js
- Sends `uiContext: { currentPath }` with every API request

---

## 4. What Was Built (Phase 3)

Phase 3 overhauled all RAG documentation with field-level accuracy verified against source code, and created the missing CLI sync module.

### 4A — `modules.ts` Updated

**File:** `apps/doctor/src/lib/llm-assistant/modules.ts`

Added/updated:

| Module | Change |
|--------|--------|
| `appointments` | Added `bookings` and `create-slots` submodules + file paths |
| `practice-management` | Added `quotations` and `areas` submodules + file paths |
| `pendientes` | **NEW** — full module registration with keywords and file path |
| `profile` | **NEW** — full module registration with keywords and file path |

---

### 4B — `capabilities.ts` Updated

**File:** `apps/doctor/src/lib/llm-assistant/capabilities.ts`

- Added `pendientes` module with `Tarea (Pendiente)` entity
- Added `profile` module with `Perfil Público` entity
- Fixed `cotizaciones` → `'convertir a venta'` rule (direct POST button, not a modal flow)
- Added `'exportar PDF'` action to Cotización
- Updated `getModulesFromPath()` — added `/dashboard/pendientes` and `/dashboard/mi-perfil`

---

### 4C — RAG Docs Rewritten

All docs verified against source code for field names, error messages, and business rules.

#### Medical Records

| File | Key Changes |
|------|-------------|
| `encounters.md` | SOAP fields with exact hints, all 7 vital sign fields with units, SOAP↔Simple toggle, Chat IA button, follow-up fields, removed non-existent "Diagnósticos" section |
| `prescriptions.md` | **Full rewrite** — state machine (draft/issued/cancelled/expired), exact medication required fields (name+dosage+frequency+instructions), exact error messages, confirmation dialog wording, cancel requires reason, PDF only on issued |
| `patients.md` | All 4 form sections, etiquetas system, ID Interno immutability, patient profile tabs |
| `media.md` | File types (JPG/PNG/GIF/PDF only — no video), permanent delete, no linking to encounters |
| `timeline.md` | Read-only, auto-generated only, no filtering |

#### Practice Management

| File | Key Changes |
|------|-------------|
| `sales.md` | Full 6-state machine (PENDING→CONFIRMED→EN PROCESO→ENVIADA→ENTREGADA/CANCELADA), 3 payment states, strict sequential transitions |
| `purchases.md` | Mirror of sales with RECIBIDA as final state instead of ENTREGADA |
| `cash-flow.md` | Two tabs (Movimientos + Estado de Resultados), 5 payment methods, "Por Realizar" concept, voice batch creation |
| `clients.md` | Distinct from patients, RFC field, no consolidated history |
| `suppliers.md` | Mirror of clients for purchase side |
| `products.md` | No inventory tracking, single price, no categories |
| `areas.md` | **NEW** — INGRESO/EGRESO type immutable after creation, cascade delete to subareas, exact confirmation text |
| `quotations.md` | **NEW** — 6 states (DRAFT/SENT/APPROVED/REJECTED/EXPIRED/CANCELLED), "por vencer" warning (<7 days), PDF batch export, direct "convertir a venta" button |

#### Other Modules

| File | Key Changes |
|------|-------------|
| `blog.md` | DRAFT/PUBLISHED states, slug locked after publishing, TipTap editor, stats widget |
| `pendientes.md` | **NEW** — due date is REQUIRED, 30-min time increments, exact error messages, conflict dialog wording ("⚠️ Conflicto de Horario"), 7 categories with colors, 4 statuses, calendar+list views |
| `profile.md` | **NEW** — 7 tabs, identity fields read-only (admin-only), conditions/procedures in Clínica tab (not Servicios), bio max 300 chars, experience 1–60, service duration 1–480 min |

#### Features

| File | Key Changes |
|------|-------------|
| `features/navigation.md` | Full sidebar structure with pendientes and mi-perfil; all 35+ URLs documented |
| `modules/medical-records/overview.md` | Removed false "filter by event type" for timeline |
| `modules/practice-management/overview.md` | Added cotizaciones and areas to module list and capability matrix |

---

### 4D — `sync.ts` Created

**File:** `apps/doctor/src/lib/llm-assistant/sync.ts`

The CLI script `scripts/docs-sync.ts` was importing from this file but it didn't exist. Created it with:

- `syncAll(options?)` — wraps `runIngestionPipeline`, groups results by module
- `syncModule(moduleId, options?)` — syncs a single module
- `listModules()` — queries DB for chunk/file counts per module
- `getStatus()` — aggregate stats (total chunks, files, modules, cache entries)
- `showHistory(moduleId?)` — version history from `llm_docs_versions` table

This makes `pnpm docs:sync-all --force` fully operational.

---

## 5. File-by-File Reference

```
apps/doctor/src/lib/llm-assistant/
│
├── capabilities.ts              ← CREATED (Ph1) + UPDATED (Ph3) — primary source of truth
├── sync.ts                      ← CREATED (Ph3) — CLI sync functions
├── types.ts                     ← MODIFIED (Ph2) — added UIContext, extended UserQuery
├── constants.ts                 ← MODIFIED (Ph2) — TOKEN_BUDGET_CAPABILITIES, DOCS_SKIP_FILES
├── modules.ts                   ← MODIFIED (Ph3) — added pendientes, profile, bookings, areas, quotations
│
├── query/
│   ├── pipeline.ts              ← MODIFIED (Ph2) — threads UIContext, builds capability map
│   ├── prompt-assembler.ts      ← MODIFIED (Ph2) — injects capability map + UI context
│   ├── retriever.ts             ← unchanged
│   ├── module-detector.ts       ← unchanged
│   ├── cache.ts                 ← unchanged
│   ├── deduplicator.ts          ← unchanged
│   └── memory.ts                ← unchanged
│
└── ingestion/
    └── pipeline.ts              ← unchanged

apps/doctor/src/
├── app/api/llm-assistant/chat/route.ts   ← MODIFIED (Ph2) — accepts uiContext
└── hooks/useLlmChat.ts                   ← MODIFIED (Ph2) — sends currentPath

docs/llm-assistant/
├── index.md                              ← unchanged
├── faq.md                                ← unchanged
├── features/
│   ├── voice-assistant.md                ← unchanged (accurate)
│   └── navigation.md                     ← UPDATED (Ph3) — full URL list + sidebar structure
├── modules/
│   ├── blog.md                           ← REWRITTEN (Ph3)
│   ├── pendientes.md                     ← CREATED (Ph3)
│   ├── profile.md                        ← CREATED (Ph3)
│   ├── medical-records/
│   │   ├── overview.md                   ← UPDATED (Ph3) — fixed timeline description
│   │   ├── encounters.md                 ← REWRITTEN (Ph3)
│   │   ├── prescriptions.md              ← REWRITTEN (Ph3)
│   │   ├── patients.md                   ← REWRITTEN (Ph3)
│   │   ├── media.md                      ← REWRITTEN (Ph3)
│   │   └── timeline.md                   ← REWRITTEN (Ph3)
│   ├── appointments/
│   │   ├── slots.md                      ← REWRITTEN (Ph3)
│   │   ├── bookings.md                   ← REWRITTEN (Ph3)
│   │   └── create-slots.md               ← CREATED (Ph3)
│   └── practice-management/
│       ├── overview.md                   ← UPDATED (Ph3) — added areas, quotations
│       ├── sales.md                      ← REWRITTEN (Ph3)
│       ├── purchases.md                  ← REWRITTEN (Ph3)
│       ├── cash-flow.md                  ← REWRITTEN (Ph3)
│       ├── clients.md                    ← REWRITTEN (Ph3)
│       ├── suppliers.md                  ← REWRITTEN (Ph3)
│       ├── products.md                   ← REWRITTEN (Ph3)
│       ├── areas.md                      ← CREATED (Ph3)
│       └── quotations.md                 ← CREATED (Ph3)
```

---

## 6. How the System Works End-to-End

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
  Capability map        ≤700 tokens
  Memory                ≤300 tokens
  UI context            ~20 tokens

User turn:
  RAG docs              ≤2500 tokens
  Question              ≤200 tokens

Total:                  ~4220 tokens  (gpt-4o-mini: 128K context, no issue)
Output:                 ≤1024 tokens
```

### Cache Key

**Before:** `SHA256("¿por qué no puedo cerrar el horario?")`
**After:** `SHA256("[/appointments] ¿por qué no puedo cerrar el horario?")`

Same question on different pages gets separate cache entries, allowing context-appropriate answers.

---

## 7. The Capability Map — Full Reference

**File:** `apps/doctor/src/lib/llm-assistant/capabilities.ts`

### Modules Covered

| Module ID | Display Name | Routes | Entities |
|-----------|-------------|--------|----------|
| `appointments` | Citas | `/appointments` | Horario (Slot), Reservación (Booking) |
| `medical-records` | Expedientes Médicos | `/dashboard/medical-records/*` | Paciente, Consulta, Prescripción, Multimedia |
| `practice-management` | Gestión de Consultorio | `/dashboard/practice/*` | Venta, Cotización, Compra, Movimiento, Área, Producto, Cliente/Proveedor |
| `pendientes` | Pendientes | `/dashboard/pendientes` | Tarea (Pendiente) |
| `profile` | Mi Perfil | `/dashboard/mi-perfil` | Perfil Público |

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

### How to Add a New URL → Module Mapping

Update `getModulesFromPath()` at the bottom of `capabilities.ts`:

```typescript
export function getModulesFromPath(path: string): string[] {
  if (path.startsWith('/appointments')) return ['appointments'];
  if (path.startsWith('/dashboard/medical-records')) return ['medical-records'];
  if (path.startsWith('/dashboard/practice')) return ['practice-management'];
  if (path.startsWith('/dashboard/blog')) return ['blog'];
  if (path.startsWith('/dashboard/pendientes')) return ['pendientes'];
  if (path.startsWith('/dashboard/mi-perfil')) return ['profile'];
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
```

### RAG Doc Writing Guidelines

Every doc should have field-level accuracy:
- Exact current UI button labels and field names
- All form fields with required/optional status and validation rules
- Exact error messages (copy-pasted from source, not paraphrased)
- Step-by-step flows using real navigation paths
- No duplicate rules (rules live in `capabilities.ts` — docs explain the *why* and the *how*)

---

## 8. Re-Ingestion Instructions

After any doc changes, re-ingest to rebuild the pgvector index.

### CLI (recommended)

```bash
# Force full re-sync of all modules (ignores hash cache):
pnpm docs:sync-all --force

# Sync only one module after targeted edits:
pnpm docs:sync medical-records
pnpm docs:sync pendientes

# Check current status:
pnpm docs:status

# List all modules with chunk counts:
pnpm docs:list
```

### API Endpoint (alternative — requires admin auth)

```bash
curl -X POST http://localhost:3001/api/llm-assistant/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session cookie]" \
  -d '{"force": true}'
```

### What the Ingestion Does

1. Scans all `.md` files in `docs/llm-assistant/` (skips `DOCS_SKIP_FILES`)
2. For each file: checks SHA-256 hash against `llm_docs_file_hashes` table
3. If changed: deletes old chunks, generates new embeddings (OpenAI `text-embedding-3-small`), inserts new chunks in `llm_docs_chunks`
4. Updates `llm_module_summaries` embeddings for all modules in `MODULE_DEFINITIONS`
5. Unchanged files are skipped (incremental — fast)

### Verify After Ingestion

Test these questions in the chat widget:

| Question | Expected source |
|----------|----------------|
| "¿Cómo creo una receta?" | RAG: prescriptions.md |
| "¿Por qué no puedo editar esta receta?" | Capability map (no RAG needed) |
| "¿Qué es el SOAP?" | RAG: encounters.md |
| "¿Por qué no puedo cerrar el horario?" | Capability map + RAG |
| "¿Dónde están las cotizaciones?" | RAG: navigation.md + quotations.md |
| "¿Puedo cambiar el tipo de un área?" | Capability map: areas entity |
| "¿Cómo agrego una tarea pendiente?" | RAG: pendientes.md |

---

## 9. Future Roadmap (Post Phase 3)

### 9.1 — Entity-Level UI Context

Currently we send `currentPath: "/appointments"` — the module level.

The next level is entity-level context: "User is viewing slot #42, which has status BOOKED".

**What this enables:**
> "¿Por qué no puedo cerrar ESTE horario?" → "Porque el horario que tienes seleccionado tiene 2 reservas activas. Para cerrarlo debes cancelar la reserva de [PatientName] primero."

**How to implement:**
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

### 9.2 — Action Agent (Execute, Don't Just Guide)

Currently the assistant only explains. The next evolution is an agent that can take actions:

```
User: "Cancela la reservación de María García"
Agent: [looks up booking] → [PATCH /api/appointments/bookings/{id}]
       "Listo, cancelé la reservación de María García para el 15 de febrero."
```

**Requires:** Tool calling via OpenAI function calling. The `CAPABILITY_MAP` becomes the permission system — `blockedIf` conditions prevent the agent from taking forbidden actions.

### 9.3 — Proactive Suggestions

When the user navigates to a page with blocked actions, the assistant proactively surfaces a tip:

> "Veo que tienes 3 horarios con reservaciones activas. Si quieres cerrarlos, primero cancela las reservas."

### 9.4 — Onboarding Flows

Use the capability map + UI context to guide new doctors through setup:

> "Veo que aún no has creado horarios. ¿Quieres que te guíe? Es fácil: 1. Abre Citas → 2. Click en Crear Horarios..."

### 9.5 — Error Message Interception

When the app shows an error toast, the chat widget automatically offers help:

> "Veo que tuviste un error. ¿Quieres que te explique cómo resolverlo?"

**Requires:** Error event system communicating from the app to the ChatWidget.

---

## Quick Reference — All Modules

| Module ID | Display Name | Routes | Capability Map | RAG Docs |
|-----------|-------------|--------|----------------|----------|
| `appointments` | Citas | `/appointments` | ✅ Complete | ✅ Rewritten (Ph3) |
| `medical-records` | Expedientes Médicos | `/dashboard/medical-records/*` | ✅ Complete | ✅ Rewritten (Ph3) |
| `practice-management` | Gestión de Consultorio | `/dashboard/practice/*` | ✅ Complete | ✅ Rewritten (Ph3) |
| `pendientes` | Pendientes | `/dashboard/pendientes` | ✅ Added (Ph3) | ✅ Created (Ph3) |
| `profile` | Mi Perfil | `/dashboard/mi-perfil` | ✅ Added (Ph3) | ✅ Created (Ph3) |
| `blog` | Blog | `/dashboard/blog` | ⚠️ RAG only | ✅ Rewritten (Ph3) |
| `voice-assistant` | Asistente de Voz | (global feature) | ⚠️ RAG only | ✅ Accurate |
| `navigation` | Navegación | (global) | ⚠️ RAG only | ✅ Updated (Ph3) |
| `general` | General | (global) | ⚠️ RAG only | ✅ Accurate |

**⏳ Pending:** Run `pnpm docs:sync-all --force` to re-ingest all Phase 3 docs into pgvector.

---

*Document maintained by engineering. Update after every significant change to the capability map or RAG documents.*
