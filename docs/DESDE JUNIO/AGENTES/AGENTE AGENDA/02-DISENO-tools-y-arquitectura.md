# Diseño del agente de agenda — tools, arquitectura y plan de build

> **Propósito.** El diseño concreto para construir el agente (post-auditoría `01`, sustrato ya
> endurecido). Decisiones tomadas como **recomendación con rationale** — revisar antes de codificar.
> Lee primero [`00-RESEARCH-estado-actual.md`](00-RESEARCH-estado-actual.md).

---

## 1. Decisiones de arquitectura (recomendadas)

| Tema | Decisión | Por qué |
|---|---|---|
| **Patrón** | **Tool-calling nativo con loop multi-paso** (no context-stuffing) | El chat v1 metía 67 días de agenda en cada prompt; el agente consulta lo que necesita. Escala y permite razonamiento plan→consultar→proponer |
| **Modelo** | **Claude (Anthropic SDK directo)** — `claude-sonnet-5` por default; evaluar `claude-haiku-4-5` para abaratar | Tool use nativo maduro; `LLM_PROVIDER`/keys ya existen. El SDK directo evita reformar `ChatProvider` (los chats viejos siguen igual) |
| **Dónde vive** | `apps/doctor/src/app/api/agenda-agent/route.ts` | Junto a la infra IA existente (`lib/ai/log-token-usage`, auth `requireDoctorAuth`); lee Prisma directo como ya hace appointments-chat |
| **Lecturas** | El agente las ejecuta **server-side, en el loop** | Riesgo cero; es lo que lo hace útil |
| **Escrituras (v1)** | El agente **propone**; el cliente ejecuta tras confirmación del doctor (patrón probado de useAppointmentsChat) | Mantiene al humano en el loop mientras calibramos; los endpoints ya validan todo server-side (auditoría `01`) |
| **doctorId** | Siempre de la sesión (`requireDoctorAuth`), inyectado server-side en cada tool; **nunca** del output del modelo | Regla #1 de seguridad (ver `06` de flujo) |
| **Modelo de datos objetivo** | **Solo rangos** (AvailabilityRange + BlockedTime + bookings freeform) | Los slots legacy son solo-lectura para el agente (aparecen en get_day_schedule, no se crean) |
| **Voz** | Reusar `useVoiceRecording` → transcribe → mensaje | Ya integrado en el chat v1 |
| **UI** | Panel en `/appointments` (página default) | El chat viejo queda huérfano en v1; se retira cuando el agente lo reemplace |

## 2. Catálogo de tools

### Lectura (autónomas, server-side)

| Tool | Firma | Fuente |
|---|---|---|
| `get_day_schedule` | `{date}` → rangos + bloqueos + citas del día (incl. slots legacy) | Prisma (misma consulta que query #2 del TOOLING) |
| `get_availability` | `{date | dateRange, serviceId}` → horarios disponibles | **`calculateAvailability`** (la misma función que la UI; el agente NUNCA calcula disponibilidad por su cuenta) |
| `get_bookings` | `{status?, dateRange?, patientName?}` → citas filtradas (incl. **vencidas** derivadas) | Prisma |
| `get_services` | `{}` → catálogo con duración/precio | Prisma |
| `get_locations` | `{}` → consultorios | Prisma |
| `get_booking_detail` | `{bookingId}` → cita completa (form link, meet link, notas) | Prisma |

### Acción (v1: generan PROPUESTA que el doctor confirma; el cliente ejecuta el endpoint)

| Tool | Endpoint que ejecuta el cliente | Tier |
|---|---|---|
| `create_range` (único/recurrente) | `POST appointments/ranges` | 🟡 confirmar |
| `delete_range` | `DELETE appointments/ranges/[id]` | 🟡 confirmar (el endpoint ya bloquea si hay citas) |
| `block_time` / `unblock_time` | `POST/DELETE appointments/ranges/block` | 🟡 confirmar (usar su **dryRun** para preview) |
| `create_booking` | `POST range-bookings/instant` | 🔴 confirmar SIEMPRE (dispara SMS/email/GCal) |
| `cancel_booking` | `PATCH bookings/[id] {CANCELLED}` | 🔴 confirmar SIEMPRE (notifica al paciente) |
| `confirm_booking` / `complete_booking` / `no_show` | `PATCH bookings/[id]` | 🟡 confirmar (complete crea el LedgerEntry → costura con flujo) |
| `reschedule_booking` | **cancelar vieja → crear nueva** (ver gap G4 §5: el orden inverso haría 409 contra la cita vieja; este orden arriesga cancelación notificada sin re-creación → mensajería explícita de fallo) | 🔴 confirmar SIEMPRE |
| `set_extended_block` | `PATCH bookings/[id] {extendedBlockMinutes}` | 🟡 confirmar (el endpoint ya valida overlap, fix `01` ronda 2) |
| `resend_confirmation` | `POST bookings/[id]/send-email` | 🔴 confirmar (email al paciente) |

**Reglas duras (en código, no en prompt):**
0. **Las definiciones de negocio viven en el tool, no en el modelo.** Todo concepto con definición
   precisa (*vencida*, *disponible*, *completo*) es un **parámetro que el servidor resuelve** —
   nunca algo que el modelo reconstruya filtrando por su cuenta. *Validado en vivo:* el primer
   fallo del agente fue exactamente esto — reportó 1 de 13 vencidas porque filtró `status=PENDING`
   a mano; fix = `get_bookings({vencidas: true})` server-side (ver bitácora en
   [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md), commit `1be4ac90`).
1. `startTime` de `create_booking` **debe venir de un `get_availability` previo del mismo turno** (el server valida contra la calculadora antes de aceptar la propuesta) — neutraliza F4 y alucinaciones de horario.
2. IDs (bookingId, rangeId) se validan server-side como del doctor de la sesión.
3. Tope de N acciones propuestas por turno; todo va a `logTokenUsage`.
4. Los nombres de paciente/notas en el contexto son **input no confiable** (portal público) — el schema de acciones acotado es la defensa.

## 3. Flujo del loop (v1)

```
Doctor escribe/dicta → POST /api/agenda-agent {message, history}
  → loop server-side (máx ~8 iteraciones):
      Claude → tool_use (lecturas) → resultados → ...
      Claude → respuesta final = { reply, proposals[] }
  → UI: reply + cards de propuestas (resumen humano + detalle)
  → doctor confirma/rechaza cada card → cliente ejecuta el endpoint real
  → resultado por card (éxito / 409 con mensaje del server)
```

Las propuestas siguen el **patrón** del executor del chat v1 (`useAppointmentsChat`: validar →
confirmar → ejecutar secuencial → refresh), pero los action types son **nuevos** (los del v1 son de
slots); el re-mapeo a rangos es código nuevo, no reuso directo (gap G8 §5).

## 4. Plan de build (incremental)

1. **PR 1 — read-only:** endpoint `agenda-agent` con loop + tools de lectura + panel UI básico.
   Valor inmediato ("¿cómo está mi semana?", "¿citas vencidas?") con riesgo cero.
2. **PR 2 — propuestas internas:** create_range / block_time / delete_range con cards de
   confirmación (sin efectos hacia pacientes).
3. **PR 3 — propuestas de citas:** create/cancel/reschedule/complete con la regla
   availability-first y confirmación obligatoria.
4. **PR 4 — voz + retirar el chat v1** (y evaluar limpieza de `/v1`, `/v2`).

Cada PR se prueba con el método establecido: acción en la UI de prod → verificación read-only en
Railway ([`TOOLING`](TOOLING-acceso-railway-db-agenda.md)).

---

## 5. Revisión del plan (2026-07-03) — gaps encontrados y resoluciones

> Re-análisis del diseño buscando huecos, con verificación contra el código donde aplicaba.

| # | Gap (verificado) | Resolución |
|---|---|---|
| **G1** 🔴 | **`complete_booking` NO crea el LedgerEntry en el backend.** Verificado: `useBookings.completeBooking` hace **dos llamadas separadas desde el frontend** — PATCH status + `POST /practice-management/ledger` (soft-warning si falla). Un executor del agente que solo haga el PATCH **rompe el puente a Flujo de Dinero** silenciosamente. | v1: el executor del agente **reusa `completeBooking()` del hook**, nunca el PATCH crudo. Fix de fondo (post-v1, altitud correcta): mover la creación del ledger **al endpoint** PATCH para que sea atómica para todos los callers. |
| **G2** 🔴 | **`@anthropic-ai/sdk` NO está en `apps/doctor/package.json`** (solo `openai`; el provider anthropic existente no usa el SDK). Y no está confirmado que `ANTHROPIC_API_KEY` exista en el env de Railway (los chats actuales corren gpt-4o). | PR 1 agrega la dependencia + verificar/crear la key en Railway **antes** de codificar. Plan B: arrancar con OpenAI tool-calling (key ya existe) y cambiar por env. |
| **G3** 🟠 | **La regla "startTime debe venir de `get_availability` del mismo turno" está mal planteada:** rompe multi-turno ("agéndalo entonces" refiriéndose al turno anterior) y su punto de enforcement es difuso porque el cliente ejecuta directo contra `instant`, que **deliberadamente** no valida rango ni buffer → un horario stale/alucinado confirmado por el doctor se crearía. | El **endpoint del agente re-valida contra `calculateAvailability` al momento de EMITIR la propuesta** (no por procedencia del dato) y la card muestra el resultado del check. En ejecución, overlap+lock siguen guardando lo duro. La violación de buffer confirmada por el doctor se acepta (mismo trust que "Nuevo horario" manual). |
| **G4** 🟠 | **Orden del reschedule estaba invertido en este doc** (crear→cancelar haría 409 contra la cita vieja al moverla a un horario cercano). El flujo existente es cancelar→re-crear, con el riesgo conocido: paciente notificado de cancelación y la re-creación falla. | Corregido arriba (§2). v1: cancelar→crear con mensajería explícita si la creación falla ("la cita quedó cancelada, no se pudo re-crear porque X"). Post-v1: endpoint atómico de reschedule. |
| **G5** 🟠 | **Falta el tool `find_patient`.** `create_booking` exige nombre/email/teléfono (según settings del doctor) y opcionalmente `patientId` (link a expediente). El agente no puede inventar datos de contacto. | Agregar tool de lectura `find_patient({query})` → busca en `Patient` + bookings pasados y devuelve contacto + patientId. Si no hay match, el agente pide los datos al doctor. |
| **G6** 🟡 | **Sin tope de gasto:** `logTokenUsage` registra pero no limita; un loop de 8 iteraciones por mensaje puede escalar el costo. | Cap por request (máx iteraciones, ya previsto) + **cap diario por doctor** (contar en `LlmTokenUsage` antes de aceptar el request; 429 amable al excederlo). |
| **G7** 🟡 | **Convención de fechas no documentada para los tools:** fecha = medianoche UTC (truco `date + 'T12:00:00Z'`), horas = strings MX, "hoy" = `America/Mexico_City`. Un tool que construya `Date` naive consulta el día equivocado. | Nota de implementación: helpers de fecha compartidos con los endpoints; system prompt recibe `now()` de MX por turno. |
| **G8** 🟡 | El doc decía que el executor client-side "ya existe casi completo" — **overstated**: los action types del v1 son de slots; el re-mapeo a rangos es código nuevo. | Corregido en §3. El *patrón* se reusa; el código es nuevo. |
| **G9** 🟡 | **Latencia/UX:** loop multi-paso = varios round-trips LLM+DB por mensaje; sin feedback el panel se siente colgado. | v1: estado progresivo en el panel ("consultando disponibilidad…") emitido por tool ejecutado; streaming después si hace falta. |
| **G10** ⚪ | Persistencia de conversación sin definir. | v1: historial client-side por sesión (como los chats actuales). Las tablas `llm_assistant` (memoria) quedan disponibles para después. |
| **G11** ⚪ | Calidad no medible antes de dar más autonomía. | Antes del PR 3: **set de evals** (~15 prompts en español con tool-calls/propuestas esperadas) corrido contra el endpoint en cada cambio de prompt. |

**Impacto en el plan de PRs:** PR 1 suma G2 (dependencia/key) + G7 (helpers de fecha) + G6 (caps).
PR 3 suma G1 (executor vía hook), G3 (re-validación server-side al proponer), G4 (orden reschedule),
G5 (find_patient) y G11 (evals antes de mergear).

---

*Estado:* diseño 2026-07-03, revisado contra el código (§5) — listo para PR 1. Relacionado: `00`
(research), `01` (auditoría — sustrato ya endurecido), `../../flujo de dinero permutaciones/06`
(principios compartidos).
