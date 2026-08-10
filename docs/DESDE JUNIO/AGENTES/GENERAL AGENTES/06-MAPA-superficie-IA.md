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

> ⚠️ **ACOPLE A vs B — leer antes de cambiar el modelo del agente (hallazgo 2026-07-23).**
> B **hereda** `AGENDA_AGENT_MODEL` cuando `FORM_BUILDER_CHAT_MODEL` no está puesta
> (`form-builder-chat/route.ts:30-33`). O sea: poner `AGENDA_AGENT_MODEL` en Railway para mover
> **el agente** mueve **también el form-builder** — y el form-builder tiene **0 casos** en la
> suite de 65, así que el cambio viajaría sin medir. Al cambiar el modelo del agente, fijar
> `FORM_BUILDER_CHAT_MODEL` explícitamente en la MISMA pasada.
> Segundo acople, del mismo `callClaude` compartido: **todo parámetro nuevo del request llega a
> las dos superficies**. Por eso el branch de `thinking` (rama `agent/haiku-viability`) se aplica
> **solo** a los modelos que lo necesitan y deja el request de Sonnet byte-idéntico.

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
| `medical-records/patients/[id]/reports/[reportId]/dictar` | C | gpt-4o | dictado sobre UNA página del formato de aseguradora | flujo 🔵 CONTENIDO, no el asistente. Transcribe con `lib/voice/transcribir-audio` (NO por `/api/voice/*`, que es OWNER_ONLY) |
| `medical-records/patients/[id]/reports/[reportId]/chat` | **C+** | gpt-4o | **conversar** con el formato: dice qué falta, pregunta, y coloca lo dictado en la hoja | igual 🔵. Añadido 2026-08-09 · docs en `INFORME MEDICO/06-AGENTE` |
| (embeddings) | — | openai | `lib/ai` `getEmbeddingProvider` | usado por el RAG de v1 (muere en PR 4) |

> ℹ️ **Los dos endpoints del INFORME son flujos 🔵 CONTENIDOS, no módulos del asistente**
> (`INFORME MEDICO/06-AGENTE` §4): no tienen entrada en `AGENT_MODULE_REQUIREMENTS`, ni evals
> del agente, ni tocan el prompt de `agenda-agent`. Heredan el permiso `expedientes` por colgar
> de `/api/medical-records/*`. El privacy tier de `modules/expediente.ts` **no les aplica** —
> gobierna al asistente 🟢, y el precedente de un flujo contenido que sí maneja contenido
> clínico ya está en prod (`voice/structure` estructura SOAP completo).
>
> 🔴 **`C+` no es `C`.** El chat del informe corrige la debilidad conocida de C: el envelope es
> `{mensaje, campos}` y **cada clave se valida contra la hoja real** antes de devolverse
> (existe · es de texto · imprime en WinAnsi). Lo que no pasa se devuelve en `descartados` y el
> cliente lo enseña, en vez del "listo" mientras no se aplicó nada. Y **el endpoint no escribe
> en la BD**: propone, y el `PATCH` lo dispara el cliente cuando el doctor aprieta Guardar.

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
