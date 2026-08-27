# 📋 Inventario — dónde vive cada chat de IA y a qué proveedor está cableado

> **Qué es este doc.** La lista COMPLETA de superficies de IA del producto, con **la pantalla
> donde el doctor la abre**, el archivo que la llama, el endpoint, y **si va a OpenAI o a
> Anthropic**. Levantado del código el **2026-08-27**, no copiado de otro doc.
>
> **Por qué existe.** Son **19** puntos de entrada LLM repartidos por todo el dashboard y es
> fácil perderles la pista. El mapa arquitectónico vive en
> [`../GENERAL AGENTES/06-MAPA-superficie-IA.md`](../GENERAL%20AGENTES/06-MAPA-superficie-IA.md)
> (las 3 arquitecturas y el porqué de cada una); **este doc es el índice de UBICACIÓN y
> PROVEEDOR**. Si difieren, gana el código.
>
> ⚠️ **Ojo con DOS nombres para lo mismo.** Las tablas de abajo usan la **RUTA** del endpoint
> (`/api/llm-assistant/chat`, `…/reports/[reportId]/chat`). Lo que se **GUARDA** en
> `llm_token_usage.endpoint` —y lo que ves en el admin— es una etiqueta más corta que escribe
> cada ruta a mano: `llm-assistant`, `informe-chat`, `informe-dictado`, `voice-transcribe`…
> Son **18** literales; la lista exacta sale de
> `grep -rhoE "endpoint: '[^']+'" apps/doctor/src`, y su traducción a nombre humano vive en
> `apps/api/src/lib/llm-features.ts`. Buscar por la ruta en la base de datos no encuentra nada.
>
> 🔎 **Cómo se levantó** (repetible cuando dudes que esté al día):
> `grep -rlniE "openai|anthropic|callClaude|getChatProvider|gpt-4|whisper" apps packages --include=*.ts --include=*.tsx`
> y de ahí hacia la UI siguiendo el `fetch('/api/…')`.

---

## 1. La respuesta corta

| | |
|---|---|
| **Anthropic (Claude)** | **2** superficies: el asistente 🟢 y el chat del FormBuilder |
| **OpenAI (GPT / Whisper)** | **17** superficies: TODO lo demás |

**La regla mental:** si el chat **llena un formulario** o **transcribe voz**, es OpenAI. Solo las
dos superficies que manipulan algo con *tools de schema* están en Anthropic.

⚠️ **`lib/ai` NO es un interruptor entre proveedores.** La factory (`getChatProvider`, env
`LLM_PROVIDER`, default `openai`) tiene el provider de Anthropic como **STUB que LANZA**
(`lib/ai/providers/anthropic.ts`: *"not yet implemented"*). Poner `LLM_PROVIDER=anthropic`
**tumba todas las superficies** que pasan por ahí. Para Anthropic se usa `callClaude` directo.

---

## 2. Anthropic — 2 superficies

| Pantalla donde se abre | Componente / hook | Endpoint | Modelo (y su env) |
|---|---|---|---|
| **Cualquiera del dashboard** (panel acoplado) · 🚫 **HOY OCULTO** | `components/agent/AgendaAgentPanel` ← `contexts/AgentContext` | `/api/agenda-agent` | **`claude-haiku-4-5`** · `AGENDA_AGENT_MODEL` |
| **Plantillas**: `/dashboard/medical-records/custom-templates/new` y `/[id]/edit` | `components/form-builder/AIChatPanel` ← `FormBuilder` ← `hooks/useFormBuilderChat` | `/api/form-builder-chat` | **`claude-sonnet-5`** · `FORM_BUILDER_CHAT_MODEL` ‖ `AGENDA_AGENT_MODEL` |

Las dos pasan por `lib/agenda-agent/anthropic.ts` (`callClaude`, fetch crudo al Messages API).

> 🔴 **DOS acoples que muerden, los dos en el renglón del form-builder:**
>
> 1. **`AGENDA_AGENT_MODEL` mueve las DOS.** El form-builder cae a esa variable cuando
>    `FORM_BUILDER_CHAT_MODEL` no está puesta. Usar esa env para hacerle rollback al asistente
>    **también mueve el form-builder** — que tiene **0 casos** en la suite de evals, así que el
>    cambio viaja sin medir. Fijar `FORM_BUILDER_CHAT_MODEL` explícitamente en la MISMA pasada.
> 2. **Ya NO corren el mismo modelo.** El asistente se movió a Haiku 4.5 en el CÓDIGO
>    (`run-turn.ts:54`), a propósito para no arrastrar al form-builder, que sigue en Sonnet 5.
>    ⚠️ **Un número de tokens o un precio SIN su modelo al lado es una trampa**: el mismo prompt
>    da cuentas distintas en Sonnet y en Haiku.

---

## 3. OpenAI — 17 superficies

### 3.1 Familia "llena este formulario" (arquitectura C, todas por `getChatProvider()`)

| Pantalla | Panel ← hook | Endpoint | Modelo |
|---|---|---|---|
| `…/patients/[id]/encounters/new` | `EncounterChatPanel` ← `useEncounterChat` | `/api/encounter-chat` | `gpt-4o` |
| **Recetas**: `…/patients/[id]/prescriptions/new` | `PrescriptionChatPanel` ← `usePrescriptionChat` | `/api/prescription-chat` | `gpt-4o` |
| `/dashboard/medical-records/patients/new` | `PatientChatPanel` ← `usePatientChat` | `/api/patient-chat` | `gpt-4o-mini` |
| `/dashboard/pendientes/new` (y dentro de `AppointmentChatPanel`) | `TaskChatPanel` ← `useTaskChat` | `/api/task-chat` | `gpt-4o-mini` |
| `/dashboard/practice/flujo-de-dinero/new` | `LedgerChatPanel` ← `useLedgerChat` | `/api/ledger-chat` | `gpt-4o-mini` |
| `/dashboard/practice/ventas/new` | `SaleChatPanel` ← `useSaleChat` | `/api/sale-chat` | `gpt-4o-mini` |
| `/dashboard/practice/compras/new` | `PurchaseChatPanel` ← `usePurchaseChat` | `/api/purchase-chat` | `gpt-4o-mini` |
| `/dashboard/practice/cotizaciones/new` | `QuotationChatPanel` ← `useQuotationChat` | `/api/quotation-chat` | `gpt-4o-mini` |

### 3.2 Informe médico / aseguradoras (arquitectura **C+**)

C+ valida cada campo contra la hoja real antes de devolverlo, y lo que no pasa lo reporta en
`descartados` en vez de decir "listo".

| Pantalla | Componente | Endpoint | Modelo |
|---|---|---|---|
| `…/patients/[id]/informe` · `…/encounters/[encounterId]/informe` · `…/encounters/new` | `ChatInforme` ← `PantallaInforme` | `…/reports/[reportId]/chat` | `gpt-4o` |
| las mismas tres (botón de dictado) | `PantallaInforme` | `…/reports/[reportId]/dictar` | `gpt-4o` |

### 3.3 Voz — montada en 7 pantallas

`patients/new` · `encounters/new` · `prescriptions/new` · `pendientes/new` · `ventas/new` ·
`compras/new` · `flujo-de-dinero/new`.

| Qué hace | Componente ← hook | Endpoint | Modelo |
|---|---|---|---|
| grabar → texto | varios (incl. `useFormBuilderChat` y las notas) | `/api/voice/transcribe` | `whisper-1` |
| transcript → campos | `VoiceRecordingModal` ← `useVoiceSession` | `/api/voice/structure` | `gpt-4o` |
| conversación de voz | `VoiceChatSidebar` ← `useChatSession` | `/api/voice/chat` | `gpt-4o` |

### 3.4 Los sueltos

| Pantalla | Componente ← hook | Endpoint | Modelo | Nota |
|---|---|---|---|---|
| `/dashboard/practice/conciliacion-bancaria` | `usePdfImport` | `/api/bank-statement-parse` | `gpt-4o` | PDF de estado de cuenta → movimientos |
| ficha del paciente | — | `…/patients/[id]/summary` | `gpt-4o` | ⚠️ **NO pasa por la factory**: instancia `OpenAIChatProvider` a mano (`route.ts:213`), así que **ignora `LLM_PROVIDER`** |
| **TODO el dashboard** (widget flotante) | `components/llm-assistant/ChatWidget`, montado en `app/dashboard/layout.tsx` | `/api/llm-assistant/chat` | `gpt-4o-mini` | RAG sobre los docs. Su modelo NO vive donde los demás: `lib/llm-assistant/constants.ts` (`LLM_MODEL`). **Retiro planeado en PR 4** |
| `/dashboard/appointments/v1` | `AppointmentChatPanel` ← `useAppointmentsChat` | `/api/appointments-chat` | `gpt-4o` | el chat v1 de la agenda. **Muere en PR 4** |
| (embeddings del RAG) | — | `lib/ai` `getEmbeddingProvider` | `text-embedding-3-small` | muere con el RAG |

---

## 4. Lo que NO es una superficie de IA (aunque lo parezca)

- **`apps/api/.../practice-management/conciliacion-bancaria/route.ts`** — dice *"GPT-4o"*, pero es
  un **comentario**: recibe los movimientos que ya parseó `/api/bank-statement-parse`. No llama a
  ningún modelo. De hecho **`apps/api` no tiene ni una llamada LLM**: toda la IA vive en
  `apps/doctor`.
- **`packages/*`** — cero llamadas LLM.
- Los scripts (`agenda-agent-evals`, `agent-cost-benchmark`, `measure-agent-prefix`) sí llaman a
  Anthropic, pero son herramientas de desarrollo, no producto.

---

## 5. Antes de tocar cualquiera de estas

- **Todas llaman `logTokenUsage`** (`lib/ai/log-token-usage.ts`, tabla `llm_token_usage`). El cap
  semanal de presupuesto es **solo del asistente**.
- **Dos llaves distintas**: `OPENAI_API_KEY` y `ANTHROPIC_API_KEY`. Que una superficie funcione no
  dice nada de las otras.
- **La debilidad conocida de la arquitectura C** (las 8 de formulario + voz): el modelo puede
  aplanar shapes anidados o inventar nombres, y **el cliente aplica NADA mientras el chat dice
  "listo"**. La plantilla para arreglarlo es la migración del form-builder (`66d90b17`): tools con
  schema, `additionalProperties:false`, validación server-side y cliente honesto.
- **Cuánto cuesta cada uno y quién lo usa** se mide desde 2026-08-27 — dónde verlo y las
  trampas del cálculo: [`02-COSTO-y-uso-por-doctor.md`](02-COSTO-y-uso-por-doctor.md).
- **El asistente 🟢 está OCULTO de la UI** desde 2026-08-27 (`ASISTENTE_IA_VISIBLE = false`).
  Sigue vivo en el código y su endpoint sigue respondiendo — ver
  [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md).

---

*Índice de esta carpeta: [`README.md`](README.md) · Arquitecturas y el porqué de cada una:
[`../GENERAL AGENTES/06-MAPA-superficie-IA.md`](../GENERAL%20AGENTES/06-MAPA-superficie-IA.md).*
