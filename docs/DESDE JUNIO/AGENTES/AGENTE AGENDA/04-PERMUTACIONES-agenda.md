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

- [ ] **RNG-1 · Crear rango único.** Setup: día sin rangos, 09:00–14:00 int. 30. → fila en `availability_ranges`, 📅 evento GCal (`googleEventId`). Valida: alta básica.
- [ ] **RNG-2 · Crear rango duplicado exacto.** Mismo doctor+date+startTime. → rechazo por `@@unique([doctorId, date, startTime])`. Valida: unicidad.
- [ ] **RNG-3 · Crear rango que traslapa otro rango.** 09:00–14:00 existe, crear 12:00–16:00. → **409 con lista de conflictos**. Valida: overlap de rangos.
- [ ] **RNG-4 · Crear rango fuera de frontera de 15 min.** startTime 09:07. → rechazo (fronteras de 15 min). Valida: retícula de rangos.
- [ ] **RNG-5 · Bulk/recurrente.** "Todos los lunes de julio 09:00–14:00". → N filas, duplicados saltados. Valida: `ranges/bulk`.
- [ ] **RNG-6 · Borrar rango SIN citas.** → fila borrada, 📅 evento GCal removido. Valida: delete limpio.
- [ ] **RNG-7 · Borrar rango CON cita activa (PENDING/CONFIRMED) dentro.** → **rechazo** con lista de citas. Valida: la protección que la card del agente debe mostrar ("no puedo: hay 2 citas").
- [ ] **RNG-8 · Borrar rango cuyas citas están todas CANCELLED/COMPLETED.** → permitido (solo citas *activas* bloquean). Las citas quedan (freeform, no dependen del rango). Valida: definición de "activa".
- [ ] **RNG-9 · Borrar rango con cita activa → cancelar la cita → reintentar borrado.** → segundo intento OK. Valida: el flujo de dos pasos que el agente propondrá.
- [ ] **RNG-10 · Rango en fecha pasada.** La **UI bloquea fechas pasadas**, pero el endpoint **NO** (verificado en código 2026-07-04: `ranges` POST valida retícula, endTime>startTime y overlaps — ninguna comparación contra hoy). Un caller directo lo crearía (inofensivo para pacientes: el cutoff lo oculta, pero ensucia datos). → **Requisito PR 2:** el tool `create_range` valida `date >= hoy (TZ MX)` server-side antes de proponer. Valida: paridad UI↔endpoint que el tool debe restaurar.

### Bloque B — Bloqueos (`POST appointments/ranges/block`, overlay; PR 2)

El patrón **dryRun (default `true`) → confirmar** es el molde de las cards del agente.

- [ ] **BLK-1 · Bloquear día completo sin citas.** dryRun → preview (N días, 0 conflictos) → ejecutar. → filas en `blocked_times`; disponibilidad = 0. Valida: camino feliz.
- [ ] **BLK-2 · Bloquear rango de fechas multi-día.** "Vacaciones 15–22 jul". → un blocked_time por día **que tenga rangos**; `skippedNoRanges` cuenta los días sin agenda. Valida: expansión por fechas.
- [ ] **BLK-3 · Bloquear sobre cita existente.** dryRun → `conflictDetails` lista la cita. → el bloqueo se crea IGUAL (overlay, no cancela nada) pero avisa. Valida: **el bloqueo no cancela citas** — la card del agente debe decir "hay 1 cita en ese horario, sigue viva".
- [ ] **BLK-4 · Bloqueo duplicado (mismo día+horario).** → `skippedDuplicates`. Valida: idempotencia.
- [ ] **BLK-5 · Bloqueo parcial (12:00–14:00 de un rango 09:00–18:00).** → disponibilidad muestra solo 09:00–12:00 y 14:00–18:00. Valida: overlay parcial.
- [ ] **BLK-6 · Desbloquear.** Borrar la fila de `blocked_times`. → disponibilidad restaurada. Valida: reversibilidad total (única acción de agenda 100% reversible).
- [ ] **BLK-7 · Bloquear → paciente intenta reservar ese hueco.** → el horario ya no aparece en availability; POST directo al horario → 409/rechazo. Valida: el overlay se respeta al crear.

### Bloque C — Crear cita (`POST range-bookings` / `instant`; PR 3)

- [ ] **CIT-1 · Público, horario válido.** → PENDING, 📱📧🤖📅, `confirmationCode` único. Valida: nacimiento público.
- [ ] **CIT-2 · Doctor (mismo endpoint).** → nace **CONFIRMED** directo. Valida: rama por rol.
- [ ] **CIT-3 · Doctor con `doctorId` de OTRO doctor.** → **403** (fix F1). Valida: cross-tenant cerrado.
- [ ] **CIT-4 · Horario ocupado (overlap exacto).** → 409 con detalle. Valida: overlap básico.
- [ ] **CIT-5 · Horario pegado a otra cita, dentro del buffer.** Buffer=15, cita existente termina 10:00, intentar 10:00. → **409** (fix F3: `blockEnd = extendedEnd + buffer`). Valida: buffer al crear.
- [ ] **CIT-6 · Mismo caso vía `instant`.** → **aceptado** (decisión: instant es el override deliberado del doctor, sin buffer ni rango). Valida: la diferencia de rutas que el agente debe conocer — *proponer instant solo cuando el doctor pide explícitamente fuera de horario*.
- [ ] **CIT-7 · Horario fuera de todo rango (ruta normal).** → rechazo `NO_RANGE`. Valida: cita requiere ventana.
- [ ] **CIT-8 · Horario fuera de retícula (09:07 dentro del rango).** → **aceptado hoy** (F4 abierto). Neutralización: el tool del agente solo propone `startTime` que salga de `get_availability`. Valida: el hueco conocido que el diseño del tool tapa.
- [ ] **CIT-9 · Dos requests simultáneos al mismo hueco.** → uno crea, el otro **409** (advisory lock F2; `$executeRaw` — lección del outage). Bajo ráfaga extrema: **503** retriable (P2028). Valida: anti doble-booking.
- [ ] **CIT-10 · Campos requeridos por canal.** Doctor con `bookingPublicEmailRequired=true`: POST público sin email → 400; el mismo doctor por `bookingHorarios` puede tener otra config. Valida: requisitos por canal — el tool `create_booking` del agente debe pedir los datos que la config exija.
- [ ] **CIT-11 · Cutoff de 1h (público).** Hueco a 30 min de ahora: no aparece al paciente; el doctor/agente con `skipCutoff=1` sí lo ve. Valida: la asimetría doctor/paciente de PR 1.
- [ ] **CIT-12 · Cita con `extendedBlockMinutes`.** Cita 10:00–10:30 +30 ext. → siguiente hueco disponible 11:00 (+buffer). Valida: bloque extendido en disponibilidad y overlap.
- [ ] **CIT-13 · Con `patientId` (expediente) vs walk-in.** → link al expediente vs datos sueltos. Valida: los dos modos que `find_patient` alimenta.

### Bloque E — Editar cita (PATCH datos, no status; PR 3)

- [ ] **EDT-1 · Extender `extendedBlockMinutes` sin vecino.** → aceptado. Valida: edición simple.
- [ ] **EDT-2 · Extender hasta traslapar la siguiente cita.** → **409** con detalle (fix ronda 2, se excluye a sí misma). Valida: overlap en edición.
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
| ORD-2 | Cita → borrar el rango | **Rechazado** si activa (RNG-7) | Borrar rango → cita: rechazo `NO_RANGE` (CIT-7). *El rango protege en ambas direcciones.* |
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
| Crear/borrar rango | — | — | — | crea/borra | — | recreable (sin notificar a nadie) |
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
3. **La card de `delete_range` anticipa RNG-7**: el tool corre el check de citas activas ANTES de
   proponer, y si hay, propone el flujo ORD-3 (cancelar primero) como texto, no como acción.
4. **Regla 0 aplicada**: *activa*, *conflicto*, *duplicado*, *día sin rangos* se resuelven
   server-side (el dryRun del endpoint ya lo hace — el tool lo expone tal cual).
4b. **`create_range` valida `date >= hoy` (TZ MX)** — la UI lo bloquea pero el endpoint no
   (RNG-10); el tool restaura la paridad para que el agente no pueda crear rangos en el pasado.
5. **Evals (G11)**: cada checkbox de este doc es un caso candidato; mínimo los negativos
   (RNG-7, BLK-3, TRX-9/10, ORD-1/2) porque son donde el modelo tiende a prometer de más.
6. **Fuera de alcance PR 2** (documentado para no olvidar): CIT-*, RSC-*, EDT-* (PR 3);
   LEG-3 solo como regla de prompt.

---

*Estado:* catálogo creado 2026-07-04, verificado contra código (transiciones, block dryRun,
auth). Pendiente: validar en vivo los checkboxes (método TOOLING) y confirmar RNG-10 (rango en
pasado) contra el código. Relacionado: [`01-AUDIT`](01-AUDIT-agenda-rangos.md) (los fixes que
estas permutaciones asumen), [`02-DISENO`](02-DISENO-tools-y-arquitectura.md) (tools y tiers),
[`03-EDGE-CASES`](03-EDGE-CASES-lectura.md) (fase lectura).
