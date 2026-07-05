# Permutaciones de agenda — catálogo exhaustivo pre-PR 2

> **Qué es esto.** El mapa de **todas las permutaciones posibles** de la agenda (modelo de rangos):
> cada acción × cada actor × cada orden posible, con su resultado esperado y efectos secundarios.
> Es el equivalente agenda de
> [`../../flujo de dinero permutaciones/01-permutaciones-de-prueba.md`](../../flujo%20de%20dinero%20permutaciones/01-permutaciones-de-prueba.md)
> y [`04-permutaciones-por-flujo-ui.md`](../../flujo%20de%20dinero%20permutaciones/04-permutaciones-por-flujo-ui.md).
> **Propósito inmediato:** antes de construir PR 2 (propuestas del agente), tener mapeado qué puede
> pasar con cada acción para que (a) los tools del agente cubran cada rama, (b) las cards de
> confirmación muestren el resultado real, y (c) cada caso se convierta en eval (gap G11).
>
> Verificado contra el código 2026-07-04 (`bookings/[id]/route.ts` VALID_TRANSITIONS,
> `ranges/block` dryRun). Los checkboxes se marcan al validar en vivo (método del
> [`TOOLING`](TOOLING-acceso-railway-db-agenda.md)).

---

## 0. Las dimensiones que se permutan

| Dimensión | Valores |
|---|---|
| **Entidad** | `AvailabilityRange` · `BlockedTime` · `Booking` freeform (`slotId=null`) · `Booking` legacy (slot) · `AppointmentSlot` (legacy, **solo lectura** — la ÚNICA vía de crear disponibilidad es el modelo de rangos actual; los slots no se crean ni por UI ni por agente) |
| **Acción** | crear rango (único/bulk) · borrar rango · bloquear/desbloquear · crear cita (pública/doctor/instant) · transición de estado (ver matriz §2) · editar (`extendedBlockMinutes`, datos) · reagendar (cancelar→crear) · re-enviar confirmación · form links |
| **Actor** | paciente portal público (sin auth) · paciente self-cancel (`confirmationCode`) · doctor UI · admin · **agente (PR 2/3: propone → doctor confirma → cliente ejecuta)** |
| **Orden** | qué existía antes (cita↔bloqueo↔rango) — el orden cambia el resultado (§4) |
| **Tiempo** | futuro · pasado (*vencida*) · pegado a otra cita (buffer) · frontera de rango · fuera de retícula |
| **Concurrencia** | request solo · dos simultáneos (advisory lock) |
| **Efectos externos** | SMS · email · Telegram · Google Calendar · **LedgerEntry** (puente a Flujo de Dinero) — no reversibles una vez disparados |

### Leyenda de efectos secundarios

- 📱 = SMS al paciente/doctor · 📧 = email · 🤖 = Telegram al doctor · 📅 = Google Calendar
- 💰 = LedgerEntry (SOLO al completar; hoy lo crea el **frontend** vía `useBookings.completeBooking` — gap G1)
- ⚠️ = efecto **no reversible** (el paciente ya recibió la notificación)

---

## 1. Matriz actor × acción (quién puede hacer qué)

| Acción | Público (sin auth) | Paciente c/ código | Doctor (self) | Doctor (otro doctor) | Admin | Agente v1 |
|---|---|---|---|---|---|---|
| Crear cita (range-bookings) | ✅ → PENDING | — | ✅ → CONFIRMED | ❌ 403 (fix F1) | ✅ | 🔴 propone (PR 3) |
| Crear cita instant (override) | ❌ | — | ✅ CONFIRMED, **sin buffer ni rango** | ❌ 403 | ✅ | 🔴 propone (PR 3) |
| Cancelar cita | ❌ 401 | ✅ solo CANCELLED + código exacto | ✅ | ❌ 403 | ✅ | 🔴 propone (PR 3) |
| Confirmar / completar / no-show | ❌ 401 | ❌ 401 (solo CANCELLED) | ✅ | ❌ 403 | ✅ | 🔴 propone (PR 3) |
| Crear/borrar rango | ❌ | — | ✅ self-only | ❌ | ✅ | 🟡 propone (PR 2) |
| Bloquear/desbloquear | ❌ | — | ✅ self-only | ❌ | ✅ | 🟡 propone (PR 2) |
| `extendedBlockMinutes` | ❌ | ❌ | ✅ (valida overlap) | ❌ | ✅ | 🟡 propone (PR 3) |
| Re-enviar confirmación | ❌ | — | ✅ | ❌ | ✅ | 🔴 propone (PR 3) |
| Lecturas (7 tools) | — | — | ✅ | — | — | ✅ autónomo (PR 1, vivo) |

> Regla transversal ya en prod: `doctorId` del body ≠ `auth.doctorId` con rol DOCTOR → **403** en
> range-bookings, instant, ranges, block, bookings PATCH (auditoría `01`, F1 + patrón hermanos).

---

## 2. Matriz COMPLETA de transiciones de estado (todas las permutaciones de→a)

Fuente: `VALID_TRANSITIONS` en `bookings/[id]/route.ts` (enforced server-side, inválida → **400**
"Transición no permitida").

| de \ a | PENDING | CONFIRMED | COMPLETED | NO_SHOW | CANCELLED |
|---|---|---|---|---|---|
| **PENDING** | = | ✅ 📱📧📅 (confirmedAt) | ❌ 400 | ❌ 400 | ✅ 📧 (cancelledAt) |
| **CONFIRMED** | ❌ 400 | = | ✅ 💰📅 | ✅ 📅 | ✅ ⚠️📧📅 (borra evento GCal) |
| **COMPLETED** | ❌ 400 | ❌ 400 | = | ❌ 400 | ❌ 400 (terminal) |
| **NO_SHOW** | ❌ 400 | ❌ 400 | ❌ 400 | = | ❌ 400 (terminal) |
| **CANCELLED** | ❌ 400 | ❌ 400 | ❌ 400 | ❌ 400 | = (terminal) |

**Implicaciones para el agente:**
- No existe "des-completar" ni "reactivar cancelada" → si el doctor pide eso, el agente debe
  explicar que el camino es **crear una cita nueva** (y en completada, el LedgerEntry ya existe).
- PENDING **no** puede ir directo a COMPLETED/NO_SHOW → el agente debe proponer **dos pasos**
  (confirmar→completar) o avisar.
- Un reagendamiento de cita COMPLETED/NO_SHOW es imposible por transición — solo cita nueva.

### Checklist de transiciones (validar en vivo)

- [ ] **TRX-1** PENDING→CONFIRMED (doctor). → `confirmedAt` set, SMS+email al paciente, evento GCal actualizado.
- [ ] **TRX-2** PENDING→CANCELLED (doctor). → `cancelledAt` set, email de cancelación si hay `patientEmail`.
- [ ] **TRX-3** PENDING→CANCELLED (paciente con `confirmationCode` correcto, sin auth). → 200.
- [ ] **TRX-4** PENDING→CANCELLED con código incorrecto/ausente. → **401**.
- [ ] **TRX-5** Paciente intenta CONFIRMED con código (self-confirm). → **401** (solo CANCELLED sin auth).
- [ ] **TRX-6** CONFIRMED→COMPLETED. → 💰 LedgerEntry creado (verificar query #4 del TOOLING). ⚠️ Solo si se completa **desde la UI** (hook); un PATCH crudo NO crea el ledger (gap G1) — este caso es el eval crítico del executor de PR 3.
- [ ] **TRX-7** CONFIRMED→NO_SHOW. → sin ledger, GCal actualizado.
- [ ] **TRX-8** CONFIRMED→CANCELLED. → ⚠️ email + evento GCal **borrado** + `googleEventId` limpiado.
- [ ] **TRX-9** Cualquier transición desde terminal (p.ej. COMPLETED→CANCELLED). → **400** con mensaje en español.
- [ ] **TRX-10** PENDING→COMPLETED directo. → **400**.
- [ ] **TRX-11** Status inválido en el body (p.ej. "DONE"). → **400** lista de válidos.

---

## 3. Permutaciones por acción (el corte "ACCIONES × ramas")

### Bloque R — Rangos (`POST/DELETE appointments/ranges`, PR 2)

- [x] **RNG-1 · Crear rango único.** Setup: día sin rangos, 09:00–14:00 int. 30. → fila en `availability_ranges`. ~~📅 evento GCal~~ **corregido 2026-07-05: los rangos NO sincronizan con GCal** (el campo `googleEventId` existe pero nada lo escribe; solo citas sincronizan). Valida: alta básica. ✅ *Validado en vivo 2026-07-04 (rangos oct/nov creados y verificados en BD).*
- [ ] **RNG-2 · Crear rango duplicado exacto.** Mismo doctor+date+startTime. → rechazo por `@@unique([doctorId, date, startTime])`. Valida: unicidad.
- [x] **RNG-3 · Crear rango que traslapa otro rango.** 09:00–14:00 existe, crear 12:00–16:00. → **409 con lista de conflictos**. Valida: overlap de rangos. ✅ *Validado en vivo 2026-07-04: bulk de 14 rangos 09:00–14:00 sobre días con rango 07:00–14:00 → preview reportó "14 conflicto(s)" y la BD quedó sin ningún día con rangos traslapados (verificado: 1 rango por día en todo julio). ⚠️ UX: el botón "Crear" sigue habilitado con conflictos y al clickearlo NO pasa nada visible (el server rechaza en silencio) — backlog de UI; la card de `create_range` del agente debe hacerlo mejor: mostrar el 409 con su lista de conflictos (§7.1).*
- [ ] **RNG-4 · Crear rango fuera de frontera de 15 min.** startTime 09:07. → rechazo (fronteras de 15 min). Valida: retícula de rangos.
- [x] **RNG-5 · Bulk/recurrente.** "Todos los lunes de julio 09:00–14:00". → N filas, duplicados saltados. Valida: `ranges/bulk`. ✅ *Validado en vivo 2026-07-04: ~23 rangos recurrentes (patrón de días hábiles, oct–nov) creados en una operación, verificados en BD.*
- [ ] **RNG-6 · Borrar rango SIN citas.** → fila borrada (sin efectos GCal — los rangos no sincronizan). Valida: delete limpio.
- [ ] **RNG-7 · Borrar rango individual (`ranges/[id]`) CON cita activa dentro.** → **rechazo** con lista de citas (auditoría `01`). ⚠️ OJO: esta protección es SOLO del camino individual — ver RNG-11. Pendiente de probar en vivo.
- [ ] **RNG-8 · Borrar rango cuyas citas están todas CANCELLED/COMPLETED.** → permitido (solo citas *activas* bloquean en el camino individual). Las citas quedan (freeform, no dependen del rango). Valida: definición de "activa".
- [ ] **RNG-9 · Borrar rango con cita activa → cancelar la cita → reintentar borrado.** → segundo intento OK. Valida: el flujo de dos pasos que el agente propondrá (camino individual).
- [x] **RNG-11 · Borrado BULK por fechas (`ranges/bulk` DELETE) — política DISTINTA al individual.** → **procede aunque haya citas activas**: dryRun lista los rangos con citas ("protectedRanges" — nombre engañoso: se REPORTAN, no se protegen; el código lo dice: "Still delete — bookings are independent records"), los rangos se borran y las citas sobreviven como freeform huérfanas (siguen válidas y vigentes, solo desaparece la ventana para reservas nuevas). ✅ *Validado en vivo 2026-07-04: borrado jul 4–15 (12 rangos, 3 con citas) → vvvvvv/cita1/cita2 siguen CONFIRMED en BD, bloque extendido intacto.*
- [x] **RNG-12 · Cascada de bloqueos en el borrado bulk.** → si un día queda con CERO rangos tras el bulk delete, **sus `blocked_times` se borran también** (`ranges/bulk/route.ts` líneas ~135-145). ✅ *Validado en vivo 2026-07-04: los bloqueos de lun 6 (00:00–23:30) y mar 7 (10:00–12:00) desaparecieron solos al borrar los rangos de esos días.* **Implicación PR 2:** la card de `delete_range` (bulk) debe avisar las DOS cosas: "quedan N citas vivas sin ventana" y "se borrarán los bloqueos de los días que queden sin rangos".
- [ ] **RNG-10 · Rango en fecha pasada.** La **UI bloquea fechas pasadas**, pero el endpoint **NO** (verificado en código 2026-07-04: `ranges` POST valida retícula, endTime>startTime y overlaps — ninguna comparación contra hoy). Un caller directo lo crearía (inofensivo para pacientes: el cutoff lo oculta, pero ensucia datos). → **Requisito PR 2:** el tool `create_range` valida `date >= hoy (TZ MX)` server-side antes de proponer. Valida: paridad UI↔endpoint que el tool debe restaurar.

### Bloque B — Bloqueos (`POST appointments/ranges/block`, overlay; PR 2)

El patrón **dryRun (default `true`) → confirmar** es el molde de las cards del agente.

- [x] **BLK-1 · Bloquear día completo sin citas.** dryRun → preview (N días, 0 conflictos) → ejecutar. → filas en `blocked_times`; disponibilidad = 0. Valida: camino feliz. ✅ *Validado en vivo 2026-07-04 (bloqueo "ir por mi bici" dom 5 jul; el agente lo reportó con motivo).*
- [x] **BLK-2 · Bloquear rango de fechas multi-día.** "Vacaciones 15–22 jul". → un blocked_time por día **que tenga rangos**; `skippedNoRanges` cuenta los días sin agenda. Valida: expansión por fechas. ✅ *Validado incidentalmente 2026-07-04: un bloqueo 09:00–18:00 creó filas en jul 5 Y jul 6 (mismo created_at en BD). Pendiente menor: `skippedNoRanges` con días sin agenda.*
- [x] **BLK-3 · Bloquear sobre cita existente.** dryRun → `conflictDetails` lista la cita. → el bloqueo se crea IGUAL (overlay, no cancela nada) pero avisa. Valida: **el bloqueo no cancela citas** — la card del agente debe decir "hay 1 cita en ese horario, sigue viva". ✅ *Validado en vivo 2026-07-04 (lun 6 jul: bloqueo 07:00–18:00 + cita "vvvvvv" 09:00 CONFIRMED dentro; BD y agente coinciden, y el agente señaló la anomalía solo).*
- [x] **BLK-4 · Bloqueo duplicado (mismo día+horario).** → `skippedDuplicates`. Valida: idempotencia. ✅ *Validado 2026-07-04: la UI directamente no deja crearlo; el endpoint (verificado en código, `ranges/block/route.ts`) lo salta con `skipDuplicates: true` y lo reporta en `skippedDuplicates` — un caller directo (tool del agente) no truena, recibe el conteo.*
- [x] **BLK-5 · Bloqueo parcial (12:00–14:00 de un rango 09:00–18:00).** → disponibilidad muestra solo 09:00–12:00 y 14:00–18:00. Valida: overlay parcial. ✅ *Validado en vivo 2026-07-04 (mar 7 jul: bloqueo 10:00–12:00 sobre rango 07:00–14:00 → 14 huecos pasaron a exactamente los 10 correctos; el agente detectó el cambio entre turnos por sí solo).*
- [x] **BLK-6 · Desbloquear.** Borrar la fila de `blocked_times`. → disponibilidad restaurada. Valida: reversibilidad total (única acción de agenda 100% reversible). ✅ *Validado en vivo 2026-07-04 (segunda ronda): todas las filas de dom 5 y lun 6 borradas en BD tras desbloquear en la UI. ⚠️ El primer intento ("undo") no borró nada — no reproducido; si vuelve a pasar, anotar qué control de la UI se usó. **Resuelto 2026-07-05:** casi seguro NO era un borrado fallido — el modal "Gestionar Bloqueos" era ciego a otros meses (recibía solo los bloqueos del mes seleccionado en la página), así que un bloqueo fuera del mes visible parecía no-borrado/invisible con la BD perfectamente bien. Detectado porque el agente (correcto contra BD) contradijo al modal; corregido en `4ddab2ff` (el modal ahora consulta TODOS los bloqueos vigentes él mismo).*
- [x] **BLK-7 · Bloquear → paciente intenta reservar ese hueco.** → el horario ya no aparece en availability; POST directo al horario → 409/rechazo. Valida: el overlay se respeta al crear. ✅ *Validado en vivo 2026-07-04: la página pública no ofrece 10:00–12:00 el martes (bloqueado) — el POST directo queda pendiente de probar cuando exista el tool de PR 3.*

### Bloque C — Crear cita (`POST range-bookings` / `instant`; PR 3)

> **Campaña CIT corrida el 2026-07-05** (sin buffer — ver decisión en CIT-5). Método: UI/portal
> público + 2 probes de POST directo (los rechazos no crean filas — verificado `PROBE-% = 0`).

- [x] **CIT-1 · Público, horario válido.** → PENDING, 📱📧🤖📅, `confirmationCode` único. Valida: nacimiento público. ✅ *2026-07-05: "CIT1" PENDING, código `FA0ILVCR`, GCal ✓ (sin email — no se capturó dirección; los settings no lo exigen).*
- [x] **CIT-2 · Doctor (mismo endpoint).** → nace **CONFIRMED** directo. Valida: rama por rol. ✅ *2026-07-05: "CIT2" CONFIRMED en BD.*
- [ ] **CIT-3 · Doctor con `doctorId` de OTRO doctor.** → **403** (fix F1). Valida: cross-tenant cerrado. *Requiere token de un segundo doctor — queda auditado en código.*
- [x] **CIT-4 · Horario ocupado (overlap exacto).** → 409 con detalle. Valida: overlap básico. ✅ *2026-07-05: POST directo al horario de CIT2 → **409**, 0 filas creadas (la UI ni siquiera ofrece el hueco — el probe valida la capa que usará el agente).*
- [~] **CIT-5 · Buffer al crear.** ⏭️ **SKIPPED por decisión (2026-07-05):** el buffer agrega complejidad innecesaria — la feature está DORMIDA en prod (los 11 doctores tienen 0 y **no existe UI ni endpoint que lo escriba**; solo se lee en calculator/overlap). Con buffer=0 el código es inerte. Si algún día se activa, correr este caso primero.
- [ ] **CIT-6 · Fuera de horario vía `instant`.** → aceptado (override deliberado del doctor). **Hallazgo 2026-07-05: la UI ya NO puede producirlo** — el picker de "Agendar paciente" solo ofrece horarios de availability; el override existe SOLO a nivel endpoint (`range-bookings/instant`). → **Decisión explícita para PR 3:** si `create_booking` usa instant, el agente tendría una capacidad que la UI no tiene.
- [x] **CIT-7 · Horario fuera de todo rango (ruta normal).** → rechazo `NO_RANGE`. Valida: cita requiere ventana. ✅ *2026-07-05: POST directo a martes sin rangos → **400**, 0 filas creadas.*
- [ ] **CIT-8 · Horario fuera de retícula (09:07 dentro del rango).** → **aceptado hoy** (F4 abierto). No se probó en vivo a propósito (si acepta, CREA la cita). Neutralización vigente: el tool del agente solo propone `startTime` que salga de `get_availability`.
- [ ] **CIT-9 · Dos requests simultáneos al mismo hueco.** → uno crea, el otro **409** (advisory lock F2; `$executeRaw` — lección del outage). Bajo ráfaga extrema: **503** retriable (P2028). *Requiere script de concurrencia — diferido.*
- [ ] **CIT-10 · Campos requeridos por canal.** *Requiere togglear settings del doctor (hoy todos false) — diferido.*
- [ ] **CIT-11 · Cutoff de 1h (público).** *Requiere un rango dentro de la próxima hora real — probar cualquier día con agenda.*
- [x] **CIT-12 · Cita con `extendedBlockMinutes`.** Valida: bloque extendido en disponibilidad y overlap. ✅ *2026-07-05: CIT2 +165 min (09:00–09:45 → ocupado hasta 11:45); el agente respondió "te desocupas a las 11:45" correcto (E7 en vivo con datos frescos).*
- [x] **CIT-13 · Con `patientId` (expediente) vs walk-in.** → link al expediente vs datos sueltos. Valida: los dos modos que `find_patient` alimenta. ✅ *2026-07-05: walk-in ("CIT13", patient_id NULL) + vinculación post-hoc vía "Buscar paciente" del card ("cti13", patient_id escrito en BD). Nota: NO existe flujo "crear cita desde el expediente" — idea de feature a futuro (botón en el expediente → cita pre-vinculada); PR 3 da la versión conversacional gratis (find_patient → create_booking con patientId).*

### Bloque E — Editar cita (PATCH datos, no status; PR 3)

- [x] **EDT-1 · Extender `extendedBlockMinutes` sin vecino.** → aceptado. Valida: edición simple. ✅ *Validado en vivo 2026-07-04 (cita "vvvvvv" +347 min, visible en agente y UI).*
- [x] **EDT-2 · Extender hasta traslapar la siguiente cita.** → **409** con detalle (fix ronda 2, se excluye a sí misma). Valida: overlap en edición. ✅ *Validado en vivo 2026-07-04 (rechazo al extender sobre la siguiente cita).*
- [ ] **EDT-3 · Re-enviar confirmación (`send-email`).** → 📧⚠️. Tier 🔴 del agente. Valida: acción de notificación pura.
- [ ] **EDT-4 · Form link / fiscal form link.** → link generado para el paciente. Valida: acciones auxiliares (post-v1 del agente).

### Bloque G — Reagendar (secuencia compuesta; PR 3, gap G4)

- [ ] **RSC-1 · Camino feliz.** Cancelar vieja (⚠️📧) → crear nueva CONFIRMED (📱📧📅). → 2 operaciones, `isRescheduled=true` en la nueva. Valida: orden cancelar→crear.
- [ ] **RSC-2 · ¿Por qué NO crear→cancelar?** Nueva cita cercana a la vieja → **409** contra la vieja aún viva. Valida: la razón del orden (G4). *Negativo esperado.*
- [ ] **RSC-3 · La creación falla después de cancelar.** Cancelar OK → crear falla (hueco tomado en medio). → estado final: **cita cancelada, paciente notificado, sin cita nueva**. El agente/UI debe decirlo explícitamente y ofrecer horarios alternos. Valida: el modo de fallo conocido hasta que exista endpoint atómico.
- [ ] **RSC-4 · Reagendar al MISMO horario (no-op).** → detectar y no hacer nada (no cancelar por gusto). Valida: guard de no-op que el tool debe tener.

---

## 4. Permutaciones de ORDEN (el equivalente de §9.5 de flujo: el orden importa)

| # | Orden A→B | Resultado | vs. orden inverso B→A |
|---|---|---|---|
| ORD-1 | Cita → bloquear encima | Bloqueo se crea + conflicto avisado; **cita sigue viva** (BLK-3) | Bloqueo → intentar cita: **cita rechazada** (BLK-7). *Asimetría clave: el bloqueo no expulsa, solo previene.* |
| ORD-2 | Cita → borrar el rango | Individual: **rechazado** (RNG-7). Bulk: **procede**, cita queda huérfana pero viva (RNG-11) | Borrar rango → cita nueva: rechazo `NO_RANGE` (CIT-7). *La protección solo existe en el camino individual y solo hacia adelante.* |
| ORD-3 | Cancelar cita → borrar rango | OK (RNG-9) | — flujo de 2 pasos que el agente debe saber proponer |
| ORD-4 | Cita A → cita B pegada | B rechazada por buffer (CIT-5) | B → A: simétrico. *Pero por `instant` cualquiera de las dos entra (CIT-6).* |
| ORD-5 | Confirmar → completar | OK, 💰 | Completar PENDING directo: **400** (TRX-10) — el agente propone 2 pasos |
| ORD-6 | Reagendar: cancelar → crear | Correcto, con riesgo RSC-3 | Crear → cancelar: 409 (RSC-2) |
| ORD-7 | Bloquear → desbloquear → cita | OK — el desbloqueo restaura todo | (reversibilidad única de bloqueos, BLK-6) |
| ORD-8 | Completar → intentar reagendar/cancelar | **400** terminal — solo cita nueva | — |

---

## 5. Efectos secundarios por acción (qué se dispara y qué NO se puede deshacer)

| Acción | 📱 SMS | 📧 Email | 🤖 Telegram | 📅 GCal | 💰 Ledger | ¿Reversible? |
|---|---|---|---|---|---|---|
| Crear cita pública | pac+doc | confirmación | doc (si config) | crea evento | — | cancelable, pero notificaciones ya salieron ⚠️ |
| Crear cita doctor/instant | pac | sí | — | crea evento | — | ídem ⚠️ |
| Confirmar | pac | sí | — | actualiza | — | no hay CONFIRMED→PENDING (matriz §2) |
| Cancelar | — | sí (si hay email) | — | **borra evento** | — | terminal ⚠️ |
| Completar | — | — | — | actualiza | **crea** (frontend, G1) | terminal; ledger queda |
| No-show | — | — | — | actualiza | — | terminal |
| Crear/borrar rango | — | — | — | — (no sincroniza) | — | recreable (sin notificar a nadie) |
| Bloquear/desbloquear | — | — | — | — | — | **100% reversible** ✅ |
| Re-enviar confirmación | — | sí ⚠️ | — | — | — | no (email enviado) |

> **Consecuencia de diseño (ya decidida, no re-litigar):** PR 2 empieza por rangos/bloqueos
> justamente porque son las únicas acciones **sin efectos hacia el paciente**. Todo lo de la
> columna con ⚠️ es tier 🔴 (confirmación SIEMPRE) en PR 3.

---

## 6. Coexistencia con legacy (slots) — permutaciones de frontera

- [ ] **LEG-1 · Overlap cruzado freeform↔slot.** Cita freeform en horario de un booking legacy con slot → 409 (los overlap checks incluyen ambas familias, fix ronda 2). Hecho de prod: **0 slots futuros en toda la BD** → riesgo real ~0, pero el check existe.
- [ ] **LEG-2 · `bookings/instant` (slot instant) vs freeform.** → chequea freeform también (fix ronda 2, `freeformOnly: true`).
- [ ] **LEG-3 · El agente y los slots.** `get_day_schedule` los muestra; el agente **nunca** propone crear/abrir/cerrar slots (decisión de diseño `02` §1). Eval: pedir "abre un slot" → el agente redirige a rangos.

---

## 7. Qué significa esto para PR 2 (traducción a requisitos)

1. **Tools de PR 2 = Bloques R y B completos.** Cada rama con rechazo (RNG-2/3/4/7, BLK-3/4) debe
   llegar a la card como **resultado del dryRun/preview**, no como error críptico post-confirmación.
2. **La card de `block_time` muestra SIEMPRE `conflictDetails`** (BLK-3): "bloqueo creado, PERO hay
   2 citas vivas en ese horario — ¿quieres que proponga cancelarlas?" (la cancelación es PR 3 → en
   PR 2 solo avisar).
3. **La card de `delete_range` anticipa RNG-7/RNG-11/RNG-12**: el tool corre el check de citas
   activas ANTES de proponer. Camino individual: si hay citas, el endpoint rechaza — proponer el
   flujo ORD-3 (cancelar primero) como texto. Camino bulk: el endpoint NO protege — la card debe
   avisar explícitamente "quedan N citas vivas sin ventana" Y "los bloqueos de los días que queden
   sin rangos se borran en cascada" (validado en vivo, 2026-07-04).
4. **Regla 0 aplicada**: *activa*, *conflicto*, *duplicado*, *día sin rangos* se resuelven
   server-side (el dryRun del endpoint ya lo hace — el tool lo expone tal cual).
4b. **`create_range` valida `date >= hoy` (TZ MX)** — la UI lo bloquea pero el endpoint no
   (RNG-10); el tool restaura la paridad para que el agente no pueda crear rangos en el pasado.
5. **Evals (G11)**: cada checkbox de este doc es un caso candidato; mínimo los negativos
   (RNG-7, BLK-3, TRX-9/10, ORD-1/2) porque son donde el modelo tiende a prometer de más.
6. **Fuera de alcance PR 2** (documentado para no olvidar): CIT-*, RSC-*, EDT-* (PR 3);
   LEG-3 solo como regla de prompt.
7. **Regla aprendida (review de PR 2, 3 hallazgos de la misma clase):** todo pre-check de un tool
   se escribe LEYENDO el endpoint real (convención de daysOfWeek, fronteras de 30 min,
   todo-o-nada del 409), nunca asumiendo su semántica — es la regla 0 aplicada a los contratos
   entre capas (mismo patrón que la lección E7 v2).

---

*Estado:* catálogo creado y validado en vivo el 2026-07-04 (método TOOLING). BLK-1..7 ✅ ·
EDT-1/2 ✅ · RNG-1/3/5/11/12 ✅ · fase lectura ✅ (vencidas/E6/E7) · **CIT-1/2/4/7/12/13 ✅
(campaña 2026-07-05; CIT-5 skipped — buffer dormido por decisión; CIT-6 solo-endpoint → decisión
PR 3)**. Pendiente: RNG-2/7/8/9 (camino individual, auditado en código), TRX en vivo (la UI no
ofrece transiciones inválidas; TRX-6/ledger es el eval crítico de PR 3), CIT-9/10/11 (diferidos
con razón anotada). La campaña encontró y arregló 3 bugs del
agente (E6 fantasma, E7 v1/v2) + regla 10; hallazgo mayor: doble política de borrado de rangos
(RNG-11/12). Relacionado: [`01-AUDIT`](01-AUDIT-agenda-rangos.md),
[`02-DISENO`](02-DISENO-tools-y-arquitectura.md), [`03-EDGE-CASES`](03-EDGE-CASES-lectura.md),
resumen ejecutivo en [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).
