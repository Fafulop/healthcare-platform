# TOOLING — verificar datos de AGENDA en la BD de producción (Railway, solo lectura)

> **Para qué.** Durante las pruebas del agente de agenda, verificar en la BD de prod el estado real
> de citas, rangos, bloqueos y slots — igual que el TOOLING de Flujo de Dinero. El **método de
> conexión es el mismo** (ver
> [`../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)
> para el detalle completo); aquí solo lo esencial + las tablas y queries de agenda.
>
> ⚠️ **Solo lectura** (`SELECT`). Nunca imprimir el password. Flujo de trabajo: el usuario hace la
> acción en la UI de prod → el LLM consulta y asevera el estado.

---

## Conexión (resumen del método)

1. La URL pública vive en el **servicio de Postgres** (`pgvector`), no en el de la app:
   `DATABASE_PUBLIC_URL` (host `*.proxy.rlwy.net`). El `DATABASE_URL` del repo es una BD local vacía.
2. Script en el scratchpad que lee `process.env.DATABASE_PUBLIC_URL` y usa el cliente Prisma de
   `packages/database/node_modules/@prisma/client` con `$queryRawUnsafe` (SQL fijo, solo SELECT).
3. Correr: `railway run --service pgvector node <scratchpad>/query.cjs`

```js
// scratchpad/agenda-query.cjs — plantilla
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient } = require('C:/Users/52331/docs-front/packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });
(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, patient_name, status, date, start_time, end_time, service_name
      FROM public.bookings
      WHERE doctor_id = 'cmni1bov90000mk0lyeztr3ad'
      ORDER BY created_at DESC LIMIT 20
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) { console.log('ERROR:', e.message); }
  finally { await prisma.$disconnect(); }
})();
```

> Doctor de prueba (mismo que flujo): **`dr-prueba`**, doctor_id = `cmni1bov90000mk0lyeztr3ad`.

---

## Tablas del dominio agenda (schema `public` — a diferencia del ledger, que vive en `practice_management`)

| Tabla | Modelo Prisma | Qué verificar ahí |
|---|---|---|
| `public.bookings` | `Booking` | La cita: `status`, `slot_id` (null = freeform/rangos), `date`/`start_time`/`end_time`/`duration` (freeform), datos de paciente, `confirmation_code`, `confirmed_at`/`cancelled_at`, `patient_id` (link a expediente), `google_event_id`, `meet_link`, `is_rescheduled`, `reminder_email_sent_at`, `telegram_reminder_sent_at` |
| `public.availability_ranges` | `AvailabilityRange` | Ventanas: `date`, `start_time`/`end_time`, `interval_minutes`, `location_id`, `google_event_id` |
| `public.blocked_times` | `BlockedTime` | Bloqueos overlay: `date`, `start_time`/`end_time`, `reason` (desbloquear = fila borrada) |
| `public.appointment_slots` | `AppointmentSlot` | **Legacy** (modelo v1): `is_open`, `max_bookings`, `duration` |
| `public.clinic_locations` | `ClinicLocation` | Consultorios: `is_default`, dirección |
| `public.doctors` | `Doctor` | Config: `appointment_buffer_minutes`, requisitos de campos, telegram |
| `practice_management.ledger_entries` | `LedgerEntry` | El puente: al **completar** una cita debe existir un entry con ese `booking_id` (`@unique`) |

## Queries de verificación típicas

```sql
-- 1. Últimas citas del doctor (¿la acción de la UI creó/actualizó la fila?)
SELECT id, patient_name, status, slot_id,
       to_char(date, 'YYYY-MM-DD') AS fecha, start_time, end_time,
       service_name, confirmation_code, created_at
FROM public.bookings
WHERE doctor_id = '<DOCTOR_ID>'
ORDER BY created_at DESC LIMIT 20;

-- 2. Agenda de un día: rangos + bloqueos + citas (lo que ve el availability-calculator)
SELECT 'range' AS tipo, start_time, end_time, interval_minutes::text AS extra
FROM public.availability_ranges
WHERE doctor_id = '<DOCTOR_ID>' AND date = '<YYYY-MM-DD>'
UNION ALL
SELECT 'blocked', start_time, end_time, coalesce(reason,'')
FROM public.blocked_times
WHERE doctor_id = '<DOCTOR_ID>' AND date = '<YYYY-MM-DD>'
UNION ALL
SELECT 'booking', start_time, end_time, patient_name || ' · ' || status
FROM public.bookings
WHERE doctor_id = '<DOCTOR_ID>' AND date = '<YYYY-MM-DD>' AND slot_id IS NULL
ORDER BY start_time;

-- 3. Citas vencidas (PENDING/CONFIRMED cuya hora ya pasó) — el indicador que el chat v1 vigilaba
SELECT id, patient_name, status, to_char(date,'YYYY-MM-DD') AS fecha, end_time
FROM public.bookings
WHERE doctor_id = '<DOCTOR_ID>' AND status IN ('PENDING','CONFIRMED')
  AND (date + end_time::time) < (now() AT TIME ZONE 'America/Mexico_City');

-- 4. Puente a Flujo de Dinero: la cita completada ¿creó su LedgerEntry?
SELECT b.id AS booking, b.status, le.id AS ledger_entry, le.payment_status, le.amount
FROM public.bookings b
LEFT JOIN practice_management.ledger_entries le ON le.booking_id = b.id
WHERE b.doctor_id = '<DOCTOR_ID>' AND b.status = 'COMPLETED'
ORDER BY b.updated_at DESC LIMIT 10;

-- 5. ¿Quedan slots legacy vivos? (para decidir la limpieza v1)
SELECT count(*)::int AS slots, min(date) AS desde, max(date) AS hasta
FROM public.appointment_slots WHERE doctor_id = '<DOCTOR_ID>';
```

## Gotchas específicos de agenda

- **Zona horaria:** `date` se normaliza a medianoche **UTC**; las horas son strings `"HH:MM"` en
  hora de México. Comparar "ya pasó" requiere `America/Mexico_City` (como hace `isVencida` en el
  chat v1) — no comparar contra `now()` del server a secas.
- **Freeform vs slot:** en el modelo actual (rangos) los bookings tienen `slot_id IS NULL` y llevan
  su propia fecha/hora. Si una query por `slot_id` no encuentra la cita, no está perdida — es
  freeform.
- **Efectos externos no visibles en la BD:** SMS/Telegram/email no dejan tabla propia (solo
  `confirmation_email_sent_at`, `reminder_email_sent_at`, `telegram_reminder_sent_at` en el
  booking, y `google_event_id` para Calendar). Verificar notificaciones = revisar esos timestamps.
- **Unicidad:** `@@unique([doctorId, date, startTime])` en rangos y slots; `confirmation_code` y
  `review_token` únicos en bookings.

---

*Estado:* referencia creada 2026-07-03 (método heredado del TOOLING de flujo, verificado en junio).
Queries por validar en la primera sesión de pruebas del agente de agenda.
