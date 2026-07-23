# Auditoría del código de agenda por rangos (2026-07-03)

> 🔒 **SNAPSHOT — 2026-07-03.** Documento histórico, no se actualiza. **F1, F2 y F3 quedaron
> CERRADOS** (ver las secciones ✅ al final, incluida la ronda 2 del code-review); **F4
> (retícula de `startTime`) sigue abierto**, neutralizado por diseño del tool del agente.
> Su valor hoy: el razonamiento de por qué el sustrato se endurece ANTES de construir el
> agente, y el helper `booking-overlap.ts` que salió de aquí.
> Estado actual: [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).

> **Propósito.** Antes de construir el agente encima, revisar la correctitud del núcleo que el
> agente va a usar: cálculo de disponibilidad, creación de citas, bloqueos, transiciones de estado
> y autorización. **Alcance:** solo el modelo de rangos (lo vivo); no UI/estética, no el modelo
> legacy de slots. Verificado contra el código a esta fecha.

## Veredicto general

El núcleo está **bien construido**: calculadora pura y testeable, transiciones de estado con mapa
explícito, autorización correcta en casi todos los endpoints, chequeos de conflicto con listas
detalladas, y consideración del modelo legacy en los overlaps. **Pero hay 4 hallazgos reales**, dos
de los cuales conviene arreglar **antes** del agente porque el agente los amplificaría.

---

## Hallazgos (por severidad)

### F1 · ALTA — Cross-tenant en `POST /appointments/range-bookings`: un doctor puede crear citas AUTO-CONFIRMADAS en la agenda de OTRO doctor

`range-bookings/route.ts:20-27`: el endpoint es público a propósito (pacientes → PENDING), y si el
caller trae token de DOCTOR/ADMIN la cita nace **CONFIRMED**… pero **solo lee `auth.role`, nunca
compara `auth.doctorId` contra el `doctorId` del body**. Cualquier usuario con rol DOCTOR puede
crear citas confirmadas en la agenda de cualquier otro doctor (disparando SMS al doctor víctima,
evento en su Google Calendar y email de confirmación).

**La prueba de que es un descuido y no un diseño:** los endpoints hermanos SÍ lo validan —
`range-bookings/instant/route.ts:46` (`doctorId !== authenticatedDoctorId → 403`), `ranges` POST,
`ranges/block` POST, `bookings/[id]` PATCH. Solo este quedó sin el check.

**Fix sugerido:** si `callerRole === 'DOCTOR'` y `doctorId !== auth.doctorId` → 403 (o tratar al
caller como público → PENDING). Una línea, sin romper el flujo de pacientes.

### F2 · MEDIA-ALTA — Carrera de doble-booking: dos requests concurrentes al mismo horario pasan ambos

`range-bookings/route.ts:147-277`: el overlap check es **read-then-create dentro de
`$transaction`**, pero con aislamiento por default (READ COMMITTED) dos transacciones concurrentes
no se ven entre sí: ambas leen "sin conflicto", ambas crean → **doble cita en el mismo horario**.
No hay constraint de BD que lo ataje (los bookings freeform no tienen unique de horario, y no
podrían — ventanas de distinta duración se traslapan sin igualar `startTime`).

**Escenario real:** dos pacientes en el portal público eligiendo el último slot visible al mismo
tiempo. Hoy el tráfico lo hace improbable; **un agente que ejecute bookings lo hace más probable**
(retry, batch, latencia).

**Fix sugerido:** `SELECT pg_advisory_xact_lock(hashtext(doctorId || dateKey))` como primera
instrucción de la transacción — serializa por doctor+día, dos líneas, sin cambiar el schema.

### F3 · MEDIA — El buffer del doctor NO se aplica al crear la cita (solo al mostrar disponibilidad)

`range-bookings/route.ts`: el POST **selecciona** `appointmentBufferMinutes` del doctor (línea ~66)
pero **nunca lo usa** — el overlap check (líneas 206-228) solo considera `endTime` y
`extendedBlockMinutes`. En cambio `calculateAvailability` sí suma el buffer. Resultado:
**inconsistencia mostrar-vs-crear** — la disponibilidad oculta un slot pegado a otra cita, pero un
POST directo (UI stale, doble pestaña, o un tool del agente que no recalcule) lo acepta y crea
citas espalda-con-espalda violando el buffer configurado.

**Fix sugerido:** en el overlap check, `extendedEnd + bufferMinutes` (mismo cálculo que la
calculadora). Simétrico y barato.

### F4 · BAJA — El POST acepta cualquier `startTime` dentro del rango, sin validar la retícula de intervalos

El check `NO_RANGE` solo exige `range.startTime <= startTime` y `endTime <= range.endTime` (compare
de strings). Una cita a las `09:07` en un rango de intervalos de 30 es aceptada. La UI nunca lo
produce (los pickers salen de la calculadora), pero un caller directo — **o un tool del agente mal
prompteado** — sí, y fragmenta la disponibilidad del día. Fix: validar que `startTime` esté en la
retícula del rango (o al menos en frontera de 15 min, como exigen rangos y bloqueos).

### Observaciones menores (no bloquean)

- **GCal fire-and-forget:** el `googleEventId` se guarda en un `.then()` post-respuesta; si el
  proceso muere en medio, queda evento huérfano o cita sin link. Tolerable (Railway long-running).
- **Modo dates-only de `range-availability`** (sin `serviceId`): devuelve fechas con rangos sin
  restar bookings/bloqueos → un día lleno se ve "disponible" en el calendario hasta elegir
  servicio. Cosmético.
- **`check.sql` en la raíz del repo está corrupto** (UTF-16/espaciado raro) — limpiar junto con
  `diagnose-slots.sql`/`fix.sql` cuando se haga la limpieza v1/v2.

## Lo que está BIEN (y el agente puede asumir)

- `availability-calculator.ts`: función pura, ventanas [start,end) correctas, merge de bloqueos,
  retícula por rango, buffer y `extendedBlockMinutes` bien aplicados, cutoff de 1h en TZ México.
- `bookings/[id]` PATCH: mapa de transiciones explícito (PENDING→CONFIRMED/CANCELLED;
  CONFIRMED→COMPLETED/NO_SHOW/CANCELLED; terminales inmutables), authz por doctor, auto-cancelación
  de paciente solo con `confirmationCode` como prueba, limpieza de GCal al cancelar.
- `ranges` POST/DELETE: authz self-only, fronteras de 15 min, 409 con lista de conflictos, DELETE
  bloqueado si hay citas activas que traslapan.
- `ranges/block` POST: **`dryRun` por default**, detecta citas en conflicto por fecha, salta
  duplicados y fechas sin rangos — patrón excelente para tools del agente (preview→confirm).
- Los overlap checks incluyen bookings legacy (slot-based) — la coexistencia está considerada.
- TZ: convención consistente (fecha = medianoche UTC, horas = strings HH:MM hora México,
  comparaciones "ya pasó" vía `America/Mexico_City`).

## Implicación para el agente

1. **F1 y F2 arreglarse ANTES del agente** (F1 es seguridad; F2 la amplifica el agente).
2. **F3 idealmente antes** — si no, el tool `create_booking` del agente debe recalcular
   disponibilidad server-side antes de crear (no confiar en que el POST valida el buffer).
3. F4 se neutraliza si el tool del agente solo acepta `startTime` que venga de la calculadora
   (nunca texto libre del modelo) — regla que ya queríamos por seguridad.
4. El patrón `dryRun` de `ranges/block` es el molde para TODOS los tools de escritura del agente.

## ✅ FIXES APLICADOS (2026-07-03, pendiente de deploy/commit)

- **F1 — CERRADO:** `range-bookings/route.ts` ahora captura `auth.doctorId` y rechaza con **403**
  a un caller DOCTOR cuyo `doctorId` no coincida con el del body (admins pueden; público sigue
  PENDING para cualquier doctor). Mismo patrón que ya usaba `instant`.
- **F2 — CERRADO (ambas rutas):** `pg_advisory_xact_lock(hashtext(doctorId || ':' || dateKey))`
  como primera instrucción de la transacción en `range-bookings` **y** `range-bookings/instant` —
  serializa intentos concurrentes por doctor+día; el lock se libera al terminar la transacción.
- **F3 — CERRADO (solo ruta principal):** el overlap check de `range-bookings` ahora suma
  `doctor.appointmentBufferMinutes` al fin efectivo del bloque (`blockEnd = extendedEnd + buffer`),
  espejo exacto de `calculateAvailability`. **Decisión:** NO se aplicó a `instant` — esa ruta es el
  override deliberado del doctor ("book outside public ranges"); aplicarle buffer bloquearía
  elecciones intencionales.
- **F4 — abierto** (se neutraliza por diseño del tool del agente, ver arriba).
- Verificación: `tsc --noEmit` de `apps/api` pasa. Falta prueba en vivo (crear cita pegada a otra
  → debe 409 con el buffer; dos requests simultáneos → uno debe 409).

## ✅ RONDA 2 — hallazgos del code-review de los fixes, también APLICADOS (2026-07-03)

El `/code-review` de los fixes encontró que el hueco de doble-booking era **más ancho que las dos
rutas de rango** — dos endpoints hermanos y una mutación quedaban fuera. Todo aplicado:

- **Helper compartido `apps/api/src/lib/booking-overlap.ts`** (nuevo): `lockBookingDay(tx,
  doctorId, dateKey)` (el advisory lock, una sola definición de la llave) y
  `findBookingOverlap(tx, {…, bufferMinutes, freeformOnly, excludeBookingId})` (la fórmula
  canónica de ventana bloqueada `max(end, start+extendedBlock) + buffer`, espejo de
  `calculateAvailability`). Las 3 copias divergentes de la fórmula quedaron en 1; la exención de
  buffer del camino instant ahora es **un parámetro**, no una copia.
- **`bookings/instant` (slot instant, "Nuevo horario" + reschedule del chat) — CERRADO:** solo
  miraba `appointmentSlot` y era **ciego a los bookings freeform** → podía doble-agendar incluso
  sin carrera. Ahora toma el lock **y** chequea freeform (`freeformOnly: true`).
- **`bookings` POST (reserva pública de slot legacy) — CERRADO:** ahora toma el lock y rechaza si
  un booking freeform ocupa la ventana del slot.
- **`bookings/[id]` PATCH `extendedBlockMinutes` — CERRADO:** valida que la extensión no se
  traslape con otra cita activa (excluyéndose a sí misma) → 409 con detalle.
- **P2028 → 503 retriable** en las 4 rutas de creación (antes: 500 genérico si la espera del lock
  excedía el timeout de la transacción bajo ráfaga).
- **Mensaje 409 con hora inválida ("24:15") — CERRADO:** `blockEndTime` se clampea a 23:59 en el
  helper.
- **Diferido:** helper `assertSelfOrAdmin` para los ~17 checks de tenant hechos a mano (refactor
  transversal, no de esta pasada); F4 (retícula de startTime) sigue neutralizado por diseño del
  tool del agente.

Verificación: `turbo type-check` — `@healthcare/api` ✅ (el fallo de `@healthcare/doctor` es
pre-existente: módulo `openai` sin instalar localmente, archivos no tocados).

---

*Estado:* auditoría 2026-07-03, solo lectura de código (nada cambiado). Hallazgos por confirmar en
vivo si se desea (F2/F3 son reproducibles con dos requests). Relacionado:
[`00-RESEARCH-estado-actual.md`](00-RESEARCH-estado-actual.md).
