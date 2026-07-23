# 🗺️ Mapa — TODA la superficie de IA del doctor-app (asistente + el resto)

> **Qué es este doc.** El inventario de TODOS los puntos de entrada LLM de `apps/doctor` —
> no solo el asistente. Existe porque el asistente tiene 5 docs y el resto de la superficie
> IA (~15 endpoints) no tenía NINGUNO: cada sesión que tocaba "la funcionalidad de IA" la
> redescubría a mano. Creado 2026-07-18 tras migrar form-builder-chat. La verdad es el
> código; este doc es el mapa y dice dónde está cada cosa.

---

## 1. Las TRES arquitecturas de IA que conviven

| Arquitectura | Quién la usa | Modelo | Cliente |
|---|---|---|---|
| **A. Agente con tool loop** (lecturas autónomas + propuestas confirmadas, caché, evals, budget) | el asistente (`/api/agenda-agent`) | `claude-sonnet-5` (`AGENDA_AGENT_MODEL`) | `lib/agenda-agent/anthropic.ts` (`callClaude`, raw fetch) |
| **B. Chat single-shot con tool_use** (canvas/form manipulado por tools con schema, envelope `{message, actions[]}`, validación server-side, cliente honesto) | `form-builder-chat` (migrado 2026-07-18, `66d90b17`) | `claude-sonnet-5` (`FORM_BUILDER_CHAT_MODEL \|\| AGENDA_AGENT_MODEL`) | el mismo `callClaude` |
| **C. Chat single-shot jsonMode** (el modelo devuelve UN JSON `{message, action, ...}`; sin validación del payload; el mensaje de éxito se escribe ANTES de aplicar) | la familia `*-chat` heredada (abajo) | `gpt-4o` / `gpt-4o-mini` | `lib/ai` (`getChatProvider`, `LLM_PROVIDER`, default openai) |

⚠️ **La debilidad conocida de C** (probada en vivo en form-builder-chat): el modelo puede
aplanar shapes anidados o inventar nombres y el cliente aplica NADA mientras el chat dice
"listo". **La migración B es la plantilla para arreglar cualquiera de estos** — ver el
commit `66d90b17` (tools con schema + `additionalProperties:false` + whitelist strip +
validación server-side + fold sobre working copy + ⚠️ visible cuando no se aplicó nada).

## 2. Inventario endpoint por endpoint (2026-07-18)

| Endpoint (`/api/...`) | Arq. | Modelo | Qué hace | Notas |
|---|---|---|---|---|
| `agenda-agent` | A | claude-sonnet-5 | EL asistente (39 tools / 5 módulos) | docs propios: esta carpeta + `AGENTE */` |
| `form-builder-chat` | **B** | claude-sonnet-5 | construye/edita plantillas custom en el FormBuilder | migrado 2026-07-18; validación compartida en `lib/custom-template-validation.ts` |
| `encounter-chat` | C | gpt-4o | llena el form de consulta | |
| `prescription-chat` | C | gpt-4o | llena el form de receta (meds/estudios con acciones) | |
| `patient-chat` | C | gpt-4o-mini | llena el form de paciente | |
| `task-chat` | C | gpt-4o-mini | crea pendientes | |
| `ledger-chat` | C | gpt-4o-mini | crea movimientos de ledger | |
| `sale-chat` | C | gpt-4o-mini | llena ventas | |
| `purchase-chat` | C | gpt-4o-mini | llena compras | |
| `quotation-chat` | C | gpt-4o-mini | llena cotizaciones | |
| `appointments-chat` | C | gpt-4o | ChatWidget v1 (RAG) — **RETIRO planeado en PR 4** (no migrar, morir) | pipeline RAG completo muere con él (04-PLAN §2) |
| `voice/transcribe` | — | whisper-1 | audio → texto | alimenta a varios chats (incl. form-builder) |
| `voice/structure` | C | gpt-4o | transcript → campos estructurados (incl. plantillas custom) | prompts en `lib/voice-assistant/` |
| `voice/chat` | C | gpt-4o | conversación del voice assistant | |
| `bank-statement-parse` | C | gpt-4o | PDF de estado de cuenta → movimientos | |
| `medical-records/patients/[id]/summary` | C | gpt-4o | resumen del expediente | contenido clínico — ojo con el tier |
| (embeddings) | — | openai | `lib/ai` `getEmbeddingProvider` | usado por el RAG de v1 (muere en PR 4) |

## 3. Reglas transversales

- **Token logging:** TODO endpoint LLM llama `logTokenUsage` (`lib/ai/log-token-usage.ts`,
  tabla `llm_token_usage`). El budget cap semanal (2M cost-weighted) es SOLO del agente.
- **`lib/ai` vs `lib/agenda-agent/anthropic.ts`:** `lib/ai` es la factory genérica
  (OpenAI implementado; el provider Anthropic ahí es un STUB que lanza — no usarlo).
  Para Anthropic se usa `callClaude` directamente. Consolidarlos es cleanup futuro.
- **`callClaude` params:** model/system/messages/tools/maxTokens/`temperature` (opcional,
  agregado 2026-07-18 — el agente NO lo pasa)/toolChoice/timeoutMs.
- **Al migrar un endpoint C → B:** seguir el patrón de form-builder-chat completo
  (schemas estrictos, validación server-side, cliente honesto, smoke vs API real con el
  caso que fallaba) y el review de [`05-METODO`](05-METODO-code-review.md) — es lógica
  replicada + protocolo, siempre review completo.
- **Base de datos / migraciones:** procedimiento canónico en
  `docs/NEW.MD-GUIDES/database-architecture.md` (SQL manual + `prisma db execute`, NUNCA
  `db push` — revierte el composite FK). Queries read-only a prod:
  `docs/DESDE JUNIO/flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`.

---

*Relacionado: [`00-BLUEPRINT`](00-BLUEPRINT-asistente-modular.md) (el asistente),
[`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) (tools del asistente),
[`05-METODO`](05-METODO-code-review.md) (review). Mantener §2 al día cuando un endpoint
migre de arquitectura o cambie de modelo.*
