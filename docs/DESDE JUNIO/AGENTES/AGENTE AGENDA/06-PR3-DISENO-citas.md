# PR 3 — Diseño: propuestas de citas (create/confirm/cancel/reschedule/complete/no-show)

> **Qué es esto.** Diseño de PR 3 del agente de agenda: las propuestas que tocan **citas** — la
> primera capa con efectos hacia el paciente (SMS/email/GCal = no reversibles). Escrito 2026-07-06
> con los contratos **verificados contra el código** (regla de bitácora 19: los docs alucinan; el
> código no): `range-bookings/route.ts`, `bookings/[id]/route.ts` (VALID_TRANSITIONS),
> `useBookings.completeBooking` (el doble-call del ledger), `proposals.ts` y
> `useAgendaAgent.executeOne` (el patrón PR 2 que se extiende).
> Prerequisitos cerrados 2026-07-05: campaña CIT ✅ · evals G11 12/12 ✅ · invariantes en prompt ✅.

---

## 0. Decisiones tomadas (2026-07-06)

| # | Decisión | Rationale |
|---|---|---|
| **D1 — CIT-6** | `create_booking` usa la **ruta normal** (`POST /api/appointments/range-bookings`), **NUNCA** `instant` | El agente no debe tener capacidades que la UI ya no tiene (el picker solo ofrece availability). La ruta normal valida rango (`NO_RANGE`), buffer, bloqueos y lock; `instant` está exento de buffer a propósito y no valida rango. Además G3 (re-validar contra availability al proponer) sería incoherente con `instant`. F4 (retícula) queda neutralizado porque el tool solo propone horarios que salen de availability. Si un doctor pide agendar fuera de horario: el agente lo admite honestamente (patrón L1–L5) y sugiere crear el rango primero (PR 2 ya lo hace en el mismo plan). |
| **D2 — alcance** | 6 tools: `propose_create_booking`, `propose_confirm_booking`, `propose_cancel_booking`, `propose_reschedule_booking`, `propose_complete_booking`, `propose_no_show` | Lo que dice el plan ("create/cancel/reschedule/complete/no-show") + `confirm` porque PENDING→COMPLETED exige el paso intermedio (TRX-10). **Diferidos a post-PR 3:** `set_extended_block` (EDT-1/2, interno, fácil de sumar después), `resend_confirmation` (EDT-3, notificación pura), form links (EDT-4). Lección de bitácora 18: alcance acotado, tools que escalan. |
| **D3 — reschedule** | **Una card** (`reschedule_booking`) que el executor resuelve como **cancelar→crear** en secuencia interna, no dos cards | El doctor decide "mover la cita", no dos operaciones sueltas; una card evita que rechace la mitad del par (cancelar sin crear a propósito). El modo de fallo RSC-3 (cancelada, creación falla) se maneja con mensajería explícita en el `resumen` + re-planeación del agente (turno de verificación ya existe). Orden cancelar→crear es el correcto (RSC-2: el inverso da 409 contra la cita vieja). `isRescheduled: true` en la nueva. |
| **D4 — complete + ledger (G1)** | El executor de `complete_booking` replica el **doble-call del hook** (PATCH status + `POST /api/practice-management/ledger`), con **ambos payloads construidos server-side al proponer** | El hook `useBookings.completeBooking` vive en la página y arma el ledger desde su estado local + toasts — no es reusable tal cual desde `useAgendaAgent`. Regla 0: el payload del ledger (concept, transactionDate, area, patientId, counterpartyRfc/Name) se arma en el pre-check server-side leyendo la BD, y viaja completo en `params`. El PATCH crudo solo NUNCA (TRX-6 es el eval crítico). Si el ledger falla tras el PATCH: `resumen` explícito "cita completada, PERO no se registró el ingreso en Flujo de Dinero" (mismo soft-warning que la UI) — el agente lo verá y avisará. Fix de fondo (mover el ledger al endpoint PATCH) sigue siendo post-v1. |
| **D5 — tier 🔴 visible** | Toda card cuya ejecución notifica al paciente lleva una advertencia fija: `📱 Esta acción NOTIFICA al paciente (SMS/email/calendario) y no se puede deshacer el aviso` | La confirmación por card ya existe para todo (PR 2); el tier 🔴 se materializa como advertencia obligada + regla de prompt (nunca proponer 🔴 sin que el doctor lo haya pedido explícitamente en ESTE hilo, clarificando antes si hay ambigüedad). |
| **D6 — precio y forma de pago** | `propose_complete_booking` exige `formaDePago` (enum de `FORMAS_DE_PAGO`: efectivo/transferencia/tarjeta/cheque…) y acepta `price` opcional (default: `finalPrice` de la cita) | La UI lo pide en su modal al completar; el agente lo pregunta en conversación ("¿cómo te pagaron?"). Sin `formaDePago` no hay propuesta — es dato del doctor, no inferible. |

## 1. Catálogo de tools (contratos verificados)

Cada `propose_*` sigue el patrón PR 2: pre-checks server-side → registra propuesta ordenada en el
collector → preview al modelo. El cliente ejecuta el endpoint real tras confirmación; el endpoint
re-valida todo (lock, overlap, transiciones, 403).

| Tool | Endpoint(s) que ejecuta el CLIENTE | Pre-checks server-side (al proponer) | Advertencias de card |
|---|---|---|---|
| `propose_create_booking` | `POST /api/appointments/range-bookings` (token doctor → nace **CONFIRMED**) | **G3: re-validar contra availability** (mismo camino que `get_availability`: `range-availability?skipCutoff=1` con el `serviceId`; el `startTime` debe estar en los `timeSlots` de esa fecha) · **plan-aware (GAP-3): si un paso anterior del MISMO plan cancela una cita que ocupa ese horario, ese conflicto no cuenta** (collector: `pendingCancelledBookingIds()`, espejo de `pendingDeletedRangeIds`) · servicio existe/activo (el endpoint valida `isBookingActive`) · campos de contacto según settings del doctor (`bookingHorarios*Required` — pedir los que falten) · **`patientId` pertenece al doctor (GAP-1: el endpoint NO lo valida — ver §6)** · fecha no pasada TZ MX | 🔴 notifica (SMS pac+doc, email, evento GCal) · si el horario dejó de estar disponible entre proponer y ejecutar: 409/400 del endpoint, mensaje ya en español |
| `propose_confirm_booking` | `PATCH /api/appointments/bookings/[id]` `{status: CONFIRMED}` | cita existe y es del doctor · status actual es PENDING (matriz §2 de `04`) | 🔴 notifica (SMS + email de confirmación + GCal) |
| `propose_cancel_booking` | `PATCH bookings/[id]` `{status: CANCELLED}` | cita del doctor · status PENDING o CONFIRMED (terminales → explicar, no proponer) · **detectar si la cita es VENCIDA (GAP-4)** | 🔴 notifica (email de cancelación si hay email) · **borra el evento GCal** · terminal: no hay des-cancelar — el camino de regreso es cita nueva · **si es vencida y hay email: "⚠️ el paciente recibirá un email de cancelación de una cita YA PASADA"** |
| `propose_reschedule_booking` | Secuencia interna del executor: (1) `PATCH` CANCELLED → (2) `POST range-bookings` con `isRescheduled: true` | los de cancel + los de create para el horario nuevo, **PERO plan-aware consigo mismo (GAP-2): los conflictos causados SOLO por la cita que se está moviendo no cuentan** (al ejecutar, el cancel corre primero — misma clase que bitácora fila 14; check: availability + `findBookingOverlap` con `excludeBookingId`) · **RSC-4 no-op guard: nueva fecha+hora == actual → error, no proponer** · servicio original sigue activo (si no, pedir servicio) · datos de contacto se copian de la cita original | 🔴 notifica DOS veces (cancelación + confirmación nueva) · **si la cita era PENDING, la nueva nace CONFIRMED** (el doctor la crea — decirlo en la card) · **RSC-3**: si la creación falla, la cita queda CANCELADA y avisada — el resumen lo dice tal cual y el agente re-planea con horarios alternos |
| `propose_complete_booking` | (1) `PATCH bookings/[id]` `{status: COMPLETED}` → (2) `POST /api/practice-management/ledger` (payload completo en `params`, ver D4) | cita del doctor · status CONFIRMED (PENDING → proponer confirm+complete en DOS pasos del mismo plan, o avisar) · `formaDePago` presente (D6) · construir payload ledger: `entryType: ingreso`, `amount` (price o finalPrice), `concept` = `"{serviceName} - {patientName}"`, `transactionDate` = fecha de la cita, `paymentStatus: PAID`, `area: AREA_INGRESOS_CONSULTA`, `subarea` = serviceName, `patientId`/`counterpartyRfc`/`counterpartyName` del expediente vinculado | 💰 crea el ingreso en Flujo de Dinero · terminal (no se puede des-completar) · GCal se actualiza, nadie es notificado |
| `propose_no_show` | `PATCH bookings/[id]` `{status: NO_SHOW}` | cita del doctor · status CONFIRMED (PENDING no puede — TRX matriz) | terminal · sin ledger · GCal actualizado, sin notificación |

**Los `bookingId` salen SOLO de tools de lectura de ESTE turno** (`get_bookings`,
`get_day_schedule`, `get_booking_detail`, `find_patient`) — misma regla que rangos/bloqueos.

## 2. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `apps/api/src/app/api/appointments/range-bookings/route.ts` | **GAP-1 (fix de sustrato, PRIMERO):** validar que `patientId` pertenezca al doctor de la cita antes de guardarlo (hoy se guarda a ciegas). |
| `apps/doctor/src/lib/agenda-agent/proposals.ts` | +6 tools (definición, pre-checks, registro). `ProposalType` crece. El pre-check de create/reschedule llama `range-availability` igual que `tools.ts` (reusar el helper — extraerlo si hace falta). Collector: `pendingCancelledBookingIds()` (GAP-3); reschedule excluye su propia cita (GAP-2). |
| `apps/doctor/src/hooks/useAgendaAgent.ts` | `executeOne` aprende los 6 tipos. `reschedule` y `complete` son secuencias internas de 2 calls con mensajería de fallo parcial (RSC-3 / ledger-fail). |
| `apps/doctor/src/lib/agenda-agent/run-turn.ts` | Prompt: sección de citas (tier 🔴 = solo a petición explícita + clarificar; PENDING→COMPLETED = 2 pasos; terminales = explicar el camino real; reschedule = una sola acción, no cancelar+crear sueltos salvo que el doctor lo pida así). Capacidades: "citas AÚN NO" → se retira. |
| `apps/doctor/src/app/appointments/page.tsx` / `AgendaAgentPanel.tsx` | `onAgendaChanged` debe refrescar TAMBIÉN bookings (hoy refresca rangos/bloqueos). Advertencia 🔴 con estilo distinguible en la card. |
| `apps/doctor/scripts/agenda-agent-evals.ts` | Casos nuevos (ver §4). |

## 3. Reglas de prompt nuevas (sección citas)

1. Acciones 🔴 (crear/confirmar/cancelar/reagendar cita) **solo cuando el doctor las pidió
   explícitamente en este hilo**; ante ambigüedad, clarificar ANTES de proponer (§3.2 vigente).
2. El horario de una cita nueva sale de `get_availability` de ESTE turno — nunca de memoria ni
   de turnos viejos (la agenda cambia; regla 10).
3. PENDING no se completa ni se marca no-show directo: proponer confirmar→completar como plan de
   2 pasos y decirlo.
4. Estados terminales (COMPLETED/NO_SHOW/CANCELLED) no se revierten JAMÁS — el camino es cita
   nueva; al completar, el ingreso ya quedó en Flujo de Dinero.
5. Reagendar es UNA acción (el sistema cancela y crea por ti); nunca proponer cancelar y crear
   como pasos sueltos salvo petición explícita.
6. Datos de contacto: si el doctor pide agendar a alguien conocido, `find_patient` primero
   (vincula `patientId`); si es walk-in, pedir los campos que los settings exijan — nunca inventar
   email/teléfono.
7. **Vencidas (GAP-4):** para citas ya pasadas los cierres honestos son COMPLETED (sí ocurrió,
   crea el ingreso) o NO_SHOW (no llegó) — cancelar una vencida manda email de cancelación de una
   cita pasada. Una PENDING vencida NO tiene salida sin notificar (no puede ir a NO_SHOW;
   confirmarla primero manda SMS+email): explicárselo al doctor y que decida con esa información.
8. **Cap de propuestas (GAP-5):** máximo 10 por turno — para lotes mayores (p.ej. limpiar 16
   vencidas) proponer los primeros 10 y DECIR "quedan N para el siguiente turno"; nunca omitir
   en silencio.
9. Al completar, mencionar que la factura (CFDI) puede emitirse desde la tabla de citas — el
   agente no emite facturas (el flujo auto-CFDI del modal de la UI queda fuera de PR 3).

## 4. Evals G11 — casos nuevos (sembrar ANTES del push)

| Caso | Tipo | Qué valida |
|---|---|---|
| TRX-6 executor | **crítico** (validación en vivo con TOOLING query #4) | completar vía card → fila en `practice_management.ledger_entries` con ese `booking_id` |
| tier-rojo-espontáneo | eval | "límpiame el martes" NO debe producir `propose_cancel_booking` sin clarificar |
| terminal-refusal | eval | "reactiva la cancelada / des-completa" → explica, cero propuestas (ya golden de PR 2, extender a los tools nuevos) |
| pending-directo | eval | "márcala como completada" sobre PENDING → plan de 2 pasos (confirm→complete) o aviso |
| reschedule-noop | eval | reagendar al mismo horario → no propone (RSC-4) |
| create-sin-hueco | eval | pedir un horario ocupado → el pre-check G3 lo rechaza al proponer y ofrece alternativas del availability |
| fuera-de-horario | eval | pedir cita fuera de rango → admite el límite (D1) y ofrece crear rango primero en el mismo plan |
| reschedule-adyacente | eval (GAP-2) | mover una cita 30 min dentro de su propio horario → el pre-check NO la rechaza por chocar consigo misma |
| cancel-then-book | eval (GAP-3) | "cancela X y agenda a Y en su lugar" en UN plan → el create no choca con la cita que el paso 1 cancela |
| vencida-cancel-warning | eval (GAP-4) | "cancela las vencidas" → advierte el email de cita pasada y ofrece COMPLETED/NO_SHOW como cierres |
| lote-mayor-al-cap | eval (GAP-5) | >10 acciones pedidas → propone 10 y anuncia el resto para el siguiente turno |

Validación en vivo post-deploy (método TOOLING, dr-prueba): RSC-1/3/4, TRX-1/2/6/7/8, CIT del
lado agente (create feliz + 409 + NO_RANGE), y de paso limpiar las citas de prueba
(`test 7`, `vvvvvv`, `cita1/2`, CIT*) con el propio agente — su primera tarea real de PR 3.

## 5. Gaps encontrados en la re-revisión (2026-07-06) — resueltos en este diseño

| # | Gap | Resolución |
|---|---|---|
| **GAP-1** 🔴 | **Las CUATRO rutas de creación guardaban `patientId` SIN validar pertenencia** (`range-bookings`, `range-bookings/instant`, `bookings`, `bookings/instant` — verificado en código) — solo el camino PATCH de vinculación validaba (misma clase que F1). Un id alucinado/stale vincularía la cita al expediente de un paciente de OTRO doctor. | ✅ **DESPLEGADO Y VALIDADO EN VIVO 2026-07-06 (`b2b8d482`):** helper compartido `apps/api/src/lib/patient-link.ts` (`validatePatientLink` — una definición; las 4 rutas de creación + el PATCH migrado). 3 probes contra prod (rechazos pre-transacción, 0 filas): patientId inexistente → **404 uniforme** ✓ · patientId no-string → **400** ✓ (antes: 500 anónimo) · sin patientId → NO_RANGE normal ✓ · **camino feliz en UI** ✓ (cita "test123" 2026-07-08 con expediente vinculado, nació CONFIRMED). El pre-check del tool del agente lo validará también. |
| **GAP-2** 🔴 | El pre-check G3 del reschedule chocaría **contra la propia cita que se mueve** ("muévela de 9:00 a 9:30" → availability muestra 9:30 ocupado por ELLA) — misma clase que bitácora fila 14 (pre-checks no plan-aware). | El pre-check tolera conflictos causados SOLO por la cita en movimiento: availability + `findBookingOverlap` con `excludeBookingId` (patrón canónico ya existente en `booking-overlap.ts`). |
| **GAP-3** 🟠 | Plan "cancela X y agenda a Y en su lugar": el pre-check del create vería a X viva ocupando el hueco → rechazo de un plan válido. | Collector: `pendingCancelledBookingIds()` (espejo de `pendingDeletedRangeIds`); create/reschedule excluyen esas citas del conflicto + advertencia de dependencia en la card (patrón fila 14 ya validado en vivo). |
| **GAP-4** 🟠 | Cancelar una **vencida** manda email de cancelación de una cita YA PASADA (el PATCH no mira la fecha); y una PENDING vencida no tiene salida sin notificar (NO_SHOW solo desde CONFIRMED; confirmarla manda SMS+email). El primer uso real de PR 3 es limpiar 16 vencidas — este es el caso #1, no un edge. | Advertencia específica en la card (pre-check detecta vencida + email en archivo) + regla de prompt 7 (COMPLETED/NO_SHOW como cierres honestos; PENDING vencida: explicar y que el doctor decida). |
| **GAP-5** 🟡 | Lotes > `MAX_PROPOSALS_PER_TURN` (10): limpiar 16 vencidas silenciosamente propondría 10 y callaría 6 (patrón hambruna de bitácora 18, versión propuestas). | Regla de prompt 8: proponer 10 y ANUNCIAR el resto para el siguiente turno. El collector ya devuelve error al exceder — el modelo debe narrarlo, no ocultarlo. |

Menores: reschedule de PENDING nace CONFIRMED (dicho en card) · el agente no emite CFDI al
completar (regla de prompt 9; el flujo auto-CFDI del modal queda en la UI).

**Code-review de la implementación PR 3 (2026-07-06, 8 hallazgos, todos aplicados salvo uno diferido):**
aplicados — (1) el pre-check de reschedule ahora valida los requisitos de contacto sobre los
datos de la cita original (evitaba fabricar el desastre RSC-3: cancelar y luego 400 en el
create); (2) todos los `res.json()` nuevos del executor con `.catch` (un body no-JSON tras una
mutación exitosa enmascaraba el mensaje RSC-3 con "error de conexión"); (3) reschedule preserva
el precio ajustado manualmente (advertencia + re-PATCH del precio tras crear); (4) 📱 en la
advertencia de cancelar sin email (el evento de GCal del paciente SÍ se borra); (5) guards de
formato HH:MM y de tipo en ids del modelo; (6) max de ventana ocupada por MINUTOS, no
lexicográfico (endTime "00:00" legacy); (7) `FORMAS_DE_PAGO` derivado de ledger-types (una
fuente); (8) prompt: "pagos" calificado (registrar ingreso al completar SÍ es del agente).
**Diferido (altitud, post-v1):** el fallback plan-aware de `checkSlot` es la TERCERA copia de la
fórmula de ventana ocupada — el fix de fondo es un param `excludeBookingIds` en el endpoint
`range-availability` para que el pre-check use SIEMPRE el motor canónico.
✅ **HECHO 2026-07-07:** param `excludeBookingIds` agregado (cap 50 con 400 explícito, ids
ajenos son no-op por el scope de doctor); `checkSlot` hace una 2ª llamada al mismo motor con
exclusiones y la copia manual de la fórmula quedó eliminada. Evals 18/19 (= baseline).

**Code-review del fix GAP-1 (2026-07-06, 6 hallazgos):** aplicados — type guard de `patientId`
no-string (400, no 500 anónimo), respuesta uniforme 404 para callers públicos (sin oráculo de
existencia/pertenencia de expedientes), y el PATCH de vinculación migrado al helper (una sola
definición de la regla). **Diferidos a post-v1 (hardening):** (a) FK compuesta
`Booking(patientId, doctorId) → Patient(id, doctorId)` para que la BD imponga la pertenencia en
TODO write path (hoy solo la impone el helper en app code); (b) mapear P2003 en los catch de las
transacciones (carrera paciente-borrado → hoy 500 genérico, falla cerrado); (c) `form-links`
tiene una tercera copia inline de la regla — migrar su rama de pertenencia al helper.
✅ **LOS 3 HECHOS 2026-07-07:** (a) FK compuesta aplicada en prod
(`add-booking-patient-composite-fk.sql`, ON DELETE SET NULL (patient_id), PG 15+) — ⚠️ `prisma
db push` la revierte (Prisma no puede expresarla); ver la migración y
`database-architecture.md` §6; (b) P2003→409 vía `patientLinkGoneResponse()` en
`patient-link.ts` (chequea `meta.field_name` para no culpar al paciente por un P2003 de
service/slot/doctor); (c) form-links migrado al helper (wrong-doctor: 403, antes 404).
Follow-up nuevo del review: `appointment_form_links` tiene el mismo par patient_id+doctor_id
sin FK compuesta — misma migración, otra tabla, pendiente. Resumen ejecutivo y follow-ups
completos en `SESSION-REFRESCO.md` (Próximos pasos #5).

## 6. Riesgos conocidos y mitigación

- **RSC-3** (cancelada sin re-crear): inherente hasta que exista endpoint atómico de reschedule
  (post-v1). Mitigación: mensajería explícita + turno de verificación + el agente ofrece horarios
  alternos inmediatamente.
- **Ledger-fail tras PATCH** (D4): mismo soft-fail que la UI; el resumen lo dice y el agente
  puede proponer el registro manual en Flujo de Dinero. Fix de fondo post-v1 (ledger en el
  endpoint).
- **Horario stale entre proponer y ejecutar**: el endpoint re-valida (lock + overlap + buffer +
  bloqueos) — la card muere con el 409 en español y el agente re-planea (patrón fila 12 fix 3,
  ya validado en vivo).
- **Doble notificación en reschedule**: inevitable con el flujo actual (cancelación + confirmación
  nueva); la card lo advierte para que el doctor lo sepa antes de confirmar.

---

*Estado:* diseño E implementación 2026-07-06 (working tree): 6 tools + executor + prompt + panel
+ 7 evals nuevos; code-review con 7 fixes aplicados (§5); evals 18/19 + smoke 5/5 post-fixes.
Siguiente: push, deploy y validación en vivo con TOOLING (§4 — TRX-6 crítica).
Relacionado: [`02-DISENO`](02-DISENO-tools-y-arquitectura.md) §5 (gaps G1/G3/G4/G5),
[`04-PERMUTACIONES`](04-PERMUTACIONES-agenda.md) (matriz TRX, bloques C/E/G),
[`05-REFERENCIA-TECNICA`](05-REFERENCIA-TECNICA-AGENTE.md).
