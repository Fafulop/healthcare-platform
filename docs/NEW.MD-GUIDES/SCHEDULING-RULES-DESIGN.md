# Scheduling Rules System — Design & Implementation Plan

---

## 1. Current Flow (how it works today)

### Creating slots (doctor side)
1. Doctor clicks **"Crear Horarios"** → `CreateSlotsModal` opens
2. Fills in: mode (single/recurring), date(s), start/end time, duration (30/60 min), days of week, optional break, optional location
3. Submits → `POST /api/appointments/slots`
4. API creates `AppointmentSlot` records (`isOpen: true`, `isPublic: true`)
5. Conflict detection: if slots exist at same doctor+date+startTime → returns 409 unless `replaceConflicts: true` is sent
6. Doctor must repeat this manually every week/month — **no automation exists**

### Blocking slots (doctor side)
1. Doctor clicks **"Bloquear Periodo"** → `BlockRangeModal` opens
2. Picks date range and optional time range
3. Preview → Apply → `POST /api/appointments/slots/block-range`
4. API finds existing slots in that date range and sets `isOpen = false`
5. **Critical limitation:** if no slots exist yet for that date range, nothing is blocked — the modal shows "0 slots to block"

### Public availability
1. `GET /api/doctors/[slug]/availability` — queried by public booking widget
2. Returns slots where `isOpen: true, isPublic: true` and `currentBookings < maxBookings`
3. Default window: today → today+30 days

### Doctor appointment view
1. `useSlots` hook fetches all slots for the **current calendar month** via `GET /api/appointments/slots`
2. Returns ALL slots (open + closed) with their active bookings embedded
3. Doctor can: toggle open/closed per slot, delete slot (cancels bookings first), bulk select/delete/open/close

---

## 2. Problems Being Solved

| Problem | Impact |
|---------|--------|
| Doctor must manually create slots every week | High friction, slots expire, public page goes empty |
| BlockRangeModal only works on existing slots | Can't block vacations or holidays planned >31 days out |
| No concept of "schedule exception" | Doctor has no way to pre-block future dates that have no slots yet |

---

## 3. Proposed Solution

### Two new concepts

**SlotRule** — a recurring schedule pattern:
> "Every Mon–Fri, 9am–2pm, 60-min slots, at Consultorio Norte"

A daily cron reads all active rules and generates slots for `today+31`. `skipDuplicates: true` makes it idempotent.

**ScheduleException** — a blocked date range, stored independently of slots:
> "Block Dec 25 – Jan 5" (even if those dates are 45 days away)

When an exception is created:
- Stored in DB immediately
- Any already-existing open slots in that range are closed (that don't have active bookings)

When the cron runs and the target date falls inside an exception → skip, don't generate slots.

When an exception is deleted:
- Slots that were closed by the exception are reopened (non-booked ones)
- Future dates in that range will be picked up by the next cron run

---

## 4. Gaps Found in Original Plan

### Gap 1 — `isPublic` field not mentioned
`AppointmentSlot` has an `isPublic` field. The `/availability` route filters `isPublic: true`. The plan never mentions it.

**Decision needed:** Rule-generated slots must be created with `isPublic: true`. Manual slots already default to `isPublic: true` (Prisma default). The cron backfill must also set `isPublic: true` explicitly.

### Gap 2 — `maxBookings` not mentioned for rules
Slots have a `maxBookings` field (default 1). The plan doesn't say what value rule-generated slots should use.

**Decision:** Always 1. If a doctor needs a slot with maxBookings > 1, they use manual creation. Rules always create maxBookings = 1.

### Gap 3 — Public availability window vs rolling window mismatch
`/availability` route defaults to today → today+30. Rule window generates today+1 → today+31. One-day gap.

**Fix:** Change availability default to today → today+31, or query explicitly. Not a blocker but should be noted.

### Gap 4 — `replaceConflicts` flag in manual mode must be preserved
The current manual slot creation supports `replaceConflicts: true` which lets the doctor overwrite existing slots. The plan doesn't mention keeping this. The manual tab in the new modal must still send this flag.

### Gap 5 — Partial-day exceptions in cron time filtering
If an exception covers "Dec 25, 9am–5pm" (not a full day), the cron must check both date AND time range when skipping slots. A slot at 07:00 on Dec 25 should NOT be skipped.

The backfill logic must compare each generated slot's `startTime` against the exception's `startTime`/`endTime` if they're set.

### Gap 6 — What happens to slots that were manually closed when an exception is deleted?
Example: Doctor manually closed 10am slot on Dec 25 before creating any exception. Then creates an exception for Dec 25. Then deletes the exception.

If we blindly reopen all non-booked slots in that range → the manually-closed 10am slot gets reopened. That's wrong.

**Solution:** Track `closedByExceptionId` on `AppointmentSlot` — a nullable FK to `ScheduleException`. Only reopen slots where `closedByExceptionId = [exception being deleted]`. Slots closed manually have `closedByExceptionId = null` → untouched on exception delete.

This adds one nullable column to `appointment_slots`:
```sql
ALTER TABLE appointment_slots ADD COLUMN closed_by_exception_id TEXT REFERENCES schedule_exceptions(id) ON DELETE SET NULL;
```

### Gap 7 — Exception deletion cascade: what if exception is deleted but slots stay closed?
If `closedByExceptionId` FK uses `ON DELETE SET NULL`, when the exception is deleted:
- The FK on the slot becomes null
- But the slot is still `isOpen = false`
- The "reopen on exception delete" logic must run BEFORE deleting the exception record (or use a soft delete / two-step)

**Fix:** In the DELETE handler for exceptions:
1. First update all slots where `closedByExceptionId = exceptionId` AND no active bookings → set `isOpen = true, closedByExceptionId = null`
2. Then delete the exception record

### Gap 8 — Cron runs at what time?
The plan says "run daily at 12pm" but doesn't clarify timezone. The cron runs on Railway (UTC). Mexico City is UTC-6 (UTC-5 during DST).

`0 12 * * *` UTC = 6am Mexico City. That's reasonable (early morning, before clinic opens).

But the `getMexicoCityDateString()` function determines what "today" is in Mexico City time. At 6am UTC (midnight/1am Mexico City), the cron is generating slots for "today+31 in Mexico City". This is correct.

**Risk:** During DST transitions (Mexico City switches twice a year), the time offset changes. `Intl.DateTimeFormat` with `timeZone: 'America/Mexico_City'` handles DST automatically — no manual offset math needed.

### Gap 9 — Railway cron and custom headers
Railway's native cron scheduler **does not support custom request headers**. The plan uses `x-cron-secret` header for auth.

**Fix:** Use a query parameter instead:
```
POST /api/cron/generate-slots?secret=CRON_SECRET_VALUE
```
Or use Vercel Cron / an external cron service (cron-job.org) that supports custom headers.

**Recommended:** Change to query param — simpler and still secure since HTTPS encrypts the URL.

### Gap 10 — `daysOfWeek` convention must be consistent everywhere
Current code uses: Mon=0, Tue=1, ..., Sun=6 (adjusted from JS's Sun=0 via `dayOfWeek === 0 ? 6 : dayOfWeek - 1`).

This convention is already in `slots/route.ts` line 463 and must be identical in:
- `backfillSlotsForRule()`
- cron `generate-slots` handler
- `SlotRulesTab` UI (idx 0-6 = Lun–Dom)

All four places must use the same mapping. A mismatch here would silently generate slots on the wrong days.

### Gap 11 — Cron resilience: 3-day window
The original plan said cron generates only `today+31`. Changed to `today+29 → today+31` (3-day window) for resilience to missed days.

But if the cron has been down for a week, slots for days today+24 to today+28 are also missed. The window size is arbitrary.

**Better approach:** Cron generates `today+1 → today+31` every time (full rolling window). `skipDuplicates: true` means already-created slots are untouched. Slightly more DB work per run (~31 days × rules) but fully resilient to any downtime. For a typical doctor with 1-2 rules, this is ~60–120 slot checks per cron run — negligible.

### Gap 12 — Price fields still in existing code
`slots/route.ts` still creates slots with `basePrice`, `discount`, `discountType`, `finalPrice` fields. The `availability/route.ts` still selects those fields. `useSlots.ts` interface still has them.

These must all be cleaned up as part of Phase 4. Not new information but confirming the scope.

### Gap 13 — `BookPatientModal` fetches 90 days of slots
`BookPatientModal/index.tsx` line 100: queries slots from today to today+90 when the doctor is booking for a patient. With a 31-day rolling window, days 32–90 will simply have no slots. The UI shows an empty calendar for those days — acceptable behavior, no crash.

---

## 5. Potential Risks

### Risk 1 — Cron generates slots for inactive doctors
The cron would iterate ALL doctors with active rules. If a doctor is inactive/deleted, their rules should not generate slots.

**Mitigation:** When fetching rules for cron, add `doctor: { isActive: true }` filter (assuming `isActive` field exists on Doctor). Or simply: deleting a doctor cascades to their rules → no orphan rules.

### Risk 2 — Race condition between cron and rule creation
Doctor creates a new rule at 11:59pm. Cron runs at midnight. The backfill on rule creation already covered today+1 → today+31. Cron runs and tries to generate the same slots → `skipDuplicates: true` handles it. No race condition.

### Risk 3 — Exception created for a date that already has bookings
When creating an exception, existing slots with active bookings must NOT be closed (patients would lose their visible appointment slot).

**Mitigation:** The "close existing slots" step must check for active bookings before closing, same as `block-range` route does now (line 79: `if (action === 'block' && hasActiveBookings) → skippedIds`). Return a warning count to the UI.

### Risk 4 — Large backfill on rule creation for a rule that covers many slots
A rule covering Mon–Sun, 7am–9pm, 30-min intervals = 28 slots/day × 31 days = 868 slots in one `createMany` call. This is fine for PostgreSQL. No issue.

### Risk 5 — Manual slot creation conflict with rule-generated slot
Doctor manually creates a slot for Mon 9am. Rule also generates Mon 9am slots. `skipDuplicates: true` means the rule won't overwrite the manual one. But if the doctor uses `replaceConflicts: true` in the manual tab, it CAN overwrite. This is intentional — the doctor explicitly chose to replace.

### Risk 6 — Deleting a rule doesn't delete slots (correct), but UX may confuse doctor
After deleting a rule, already-generated slots for the next 31 days remain open. New slots stop being generated after today. The doctor might expect all future slots to disappear.

**Mitigation:** Add a note to the UI: "Los horarios ya creados se mantienen. Se dejarán de generar nuevos horarios." (confirmation dialog when deleting a rule)

---

## 6. New End-to-End Flow

### Flow A: Doctor sets up recurring schedule

```
Doctor → "Configurar Horarios" → "Reglas" tab
→ Clicks "Nueva regla"
→ Selects Mon-Fri, 9am-2pm, 60min, Consultorio Norte
→ POST /api/doctors/[slug]/slot-rules
  → DB: creates SlotRule record (isActive: true)
  → Backfill: createMany slots for today+1 → today+31 (Mon-Fri only, skipping weekends)
  → skipDuplicates: true (safe to run even if some slots already exist)
→ Toast: "Regla creada. 25 horarios generados."
→ Calendar immediately shows slots for the next 31 days

Daily at 6am UTC (midnight MX):
→ POST /api/cron/generate-slots?secret=...
→ For each doctor with active rules:
    For each active rule:
      For each day from today+1 → today+31:
        If day's dayOfWeek matches rule.daysOfWeek:
          If day is NOT inside any active ScheduleException:
            createMany slots (skipDuplicates: true)
→ Result: 31-day window always filled
```

### Flow B: Doctor blocks a vacation (future date)

```
Doctor → "Configurar Horarios" → "Bloqueos" tab
(or clicks "Bloquear Periodo" button → opens same UI on Bloqueos tab)
→ Sets: Dec 25 – Jan 5, full day, reason: "Vacaciones"
→ POST /api/doctors/[slug]/schedule-exceptions
  → DB: creates ScheduleException record
  → Closes any existing open slots in Dec 25-Jan 5 range
    (that have no active bookings → closedByExceptionId = exception.id)
  → Returns: { slotsClosedNow: 0, slotsSkipped: 0 }  ← (too early, no slots yet)
→ Toast: "Periodo bloqueado. 0 horarios afectados."

When cron reaches Dec 25:
→ Checks ScheduleException for this doctor
→ Dec 25 is inside exception → SKIP
→ No slots generated for Dec 25

Public booking widget:
→ Dec 25 shows no available dates → patient cannot book
```

### Flow C: Doctor cancels vacation (deletes exception)

```
Doctor → "Configurar Horarios" → "Bloqueos" tab
→ Clicks delete on the Dec 25-Jan 5 exception
→ Confirmation: "Se reabrirán X horarios. ¿Continuar?"
→ DELETE /api/doctors/[slug]/schedule-exceptions/[id]
  → Step 1: Find all slots where closedByExceptionId = this exception
    → Update isOpen = true, closedByExceptionId = null
    → (Only if no active bookings on those slots)
  → Step 2: Delete the exception record

Next cron run:
→ Dec 25 no longer covered by any exception
→ Slots generated normally
```

### Flow D: Doctor books a one-off slot (manual)

```
Doctor → "Configurar Horarios" → "Manual" tab
(or doctor uses "Agendar Cita" → "Nuevo horario" for slot+booking together)

Manual tab:
→ Pick: single date OR date range + days of week
→ Set: start/end time, duration, break (optional), location
→ POST /api/appointments/slots
→ Conflict detection: if slots exist → ask "¿Reemplazar?"
→ Creates open slots
```

### Flow E: Public patient books an appointment

```
Patient → Doctor's public page → booking widget
→ GET /api/doctors/[slug]/availability?startDate=...
  → Returns slots where isOpen: true, isPublic: true, not fully booked
  → Grouped by date

Patient picks date → picks time slot → fills form
→ POST /api/appointments/bookings (or /bookings/instant for new slot)
→ Booking created, confirmation code sent
```

---

## 7. Database Schema

### New table: `slot_rules`

```sql
CREATE TABLE public.slot_rules (
  id               TEXT PRIMARY KEY,
  doctor_id        TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  days_of_week     INTEGER[] NOT NULL,     -- [0=Mon, 1=Tue, ..., 6=Sun]
  start_time       TEXT NOT NULL,          -- "09:00"
  end_time         TEXT NOT NULL,          -- "17:00"
  interval_minutes INTEGER NOT NULL,       -- 30 or 60
  location_id      TEXT REFERENCES public.clinic_locations(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_slot_rules_doctor_active ON public.slot_rules(doctor_id, is_active);
```

### New table: `schedule_exceptions`

```sql
CREATE TABLE public.schedule_exceptions (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  start_time  TEXT,      -- NULL = full day
  end_time    TEXT,      -- NULL = full day
  reason      TEXT,      -- optional: "Vacaciones", "Congreso", etc.
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_schedule_exceptions_doctor ON public.schedule_exceptions(doctor_id, is_active);
```

### Modified table: `appointment_slots`

```sql
-- Remove price fields
ALTER TABLE public.appointment_slots
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS discount,
  DROP COLUMN IF EXISTS discount_type,
  DROP COLUMN IF EXISTS final_price;

-- Add exception tracking
ALTER TABLE public.appointment_slots
  ADD COLUMN closed_by_exception_id TEXT
    REFERENCES public.schedule_exceptions(id) ON DELETE SET NULL;
```

---

## 8. Prisma Schema Changes

### New models

```prisma
model SlotRule {
  id              String          @id @default(cuid())
  doctorId        String          @map("doctor_id")
  daysOfWeek      Int[]           @map("days_of_week")
  startTime       String          @map("start_time")
  endTime         String          @map("end_time")
  intervalMinutes Int             @map("interval_minutes")
  locationId      String?         @map("location_id")
  isActive        Boolean         @default(true) @map("is_active")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  doctor          Doctor          @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  location        ClinicLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  @@map("slot_rules")
  @@index([doctorId, isActive])
  @@schema("public")
}

model ScheduleException {
  id          String             @id @default(cuid())
  doctorId    String             @map("doctor_id")
  startDate   DateTime           @map("start_date") @db.Date
  endDate     DateTime           @map("end_date") @db.Date
  startTime   String?            @map("start_time")
  endTime     String?            @map("end_time")
  reason      String?
  isActive    Boolean            @default(true) @map("is_active")
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")
  doctor      Doctor             @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  closedSlots AppointmentSlot[]  @relation("ClosedByException")
  @@map("schedule_exceptions")
  @@index([doctorId, isActive])
  @@schema("public")
}
```

### Modified `AppointmentSlot`

```prisma
model AppointmentSlot {
  // ... existing fields ...
  // REMOVE: basePrice, discount, discountType, finalPrice

  // ADD:
  closedByExceptionId String?           @map("closed_by_exception_id")
  closedByException   ScheduleException? @relation("ClosedByException", fields: [closedByExceptionId], references: [id], onDelete: SetNull)
}
```

---

## 9. API Routes

### Slot Rules
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/doctors/[slug]/slot-rules` | List all rules (with location name) |
| POST | `/api/doctors/[slug]/slot-rules` | Create rule + backfill today+1→today+31 |
| PUT | `/api/doctors/[slug]/slot-rules/[id]` | Toggle active / update; backfills on activation |
| DELETE | `/api/doctors/[slug]/slot-rules/[id]` | Delete rule; existing slots untouched |

### Schedule Exceptions
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/doctors/[slug]/schedule-exceptions` | List exceptions |
| POST | `/api/doctors/[slug]/schedule-exceptions` | Create + close existing open slots in range |
| DELETE | `/api/doctors/[slug]/schedule-exceptions/[id]` | Delete + reopen slots closed by this exception |

### Cron
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/cron/generate-slots?secret=CRON_SECRET` | Query param | Full window today+1→today+31 for all active rules |

### Existing (modified)
| Route | Change |
|-------|--------|
| `POST /api/appointments/slots` | Remove `basePrice`, `discount`, `discountType`, `finalPrice` from creation |
| `GET /api/appointments/slots` | Remove price fields from response |
| `GET /api/doctors/[slug]/availability` | Remove price fields from select |
| `POST /api/appointments/slots/block-range` | Also creates a `ScheduleException` record (unified) |

---

## 10. Files to Change

### Phase 1 — DB migration (run on Railway FIRST)
- [ ] `packages/database/prisma/migrations/add-slot-rules-remove-slot-prices.sql` (new)

### Phase 2 — Prisma schema + client regen
- [ ] `packages/database/prisma/schema.prisma` — add SlotRule, ScheduleException, modify AppointmentSlot
- [ ] `pnpm db:generate`

### Phase 3 — Shared utilities
- [ ] `apps/api/src/lib/appointment-utils.ts` — `generateTimeSlots`, `adjustDayOfWeek`, `getMexicoCityDateString`
- [ ] `apps/api/src/lib/slot-rule-backfill.ts` — `backfillSlotsForRule`, `getRollingWindow`, `dateMatchesException`

### Phase 4 — API routes (new)
- [ ] `apps/api/src/app/api/doctors/[slug]/slot-rules/route.ts`
- [ ] `apps/api/src/app/api/doctors/[slug]/slot-rules/[ruleId]/route.ts`
- [ ] `apps/api/src/app/api/doctors/[slug]/schedule-exceptions/route.ts`
- [ ] `apps/api/src/app/api/doctors/[slug]/schedule-exceptions/[exceptionId]/route.ts`
- [ ] `apps/api/src/app/api/cron/generate-slots/route.ts`

### Phase 5 — API routes (modified)
- [ ] `apps/api/src/app/api/appointments/slots/route.ts` — remove price fields
- [ ] `apps/api/src/app/api/doctors/[slug]/availability/route.ts` — remove price fields
- [ ] `apps/api/src/app/api/appointments/slots/block-range/route.ts` — also create ScheduleException
- [ ] `apps/api/src/lib/activity-logger.ts` — remove `basePrice` from `logSlotsCreated`

### Phase 6 — Doctor app frontend
- [ ] `apps/doctor/src/app/appointments/_hooks/useSlots.ts` — remove price fields from interface
- [ ] `apps/doctor/src/app/appointments/_components/DaySlotPanel.tsx` — remove price display
- [ ] `apps/doctor/src/app/appointments/_components/SlotListView.tsx` — remove price display
- [ ] `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` — remove price display
- [ ] `apps/doctor/src/app/appointments/_components/BookPatientModal/index.tsx` — remove price from payload
- [ ] `apps/doctor/src/app/appointments/_components/CreateSlotsModal.tsx` — 3 tabs, remove price fields, reset tab on open
- [ ] `apps/doctor/src/components/appointments/SlotRulesTab.tsx` (new)
- [ ] `apps/doctor/src/components/appointments/ScheduleExceptionsTab.tsx` (new)

### Phase 7 — Public app frontend
- [ ] `apps/public/src/components/doctor/BookingWidget.tsx` — remove price fields, remove DollarSign import

### Phase 8 — Infra
- [ ] Set `CRON_SECRET` env var on Railway API service
- [ ] Configure Railway cron: `0 6 * * *` UTC → `POST /api/cron/generate-slots?secret={{CRON_SECRET}}`

---

## 11. Open Decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Unify BlockRangeModal with ScheduleException? | Yes — BlockRangeModal creates an exception record internally. Same UI, upgraded behavior |
| 2 | Cron window: full 31 days or just last 3? | Full today+1→today+31. Idempotent, resilient to missed days |
| 3 | Exception deletion auto-reopens slots? | Yes, only slots with `closedByExceptionId = this exception` AND no active bookings |
| 4 | `maxBookings` for rule-generated slots? | Always 1. Multi-booking slots require manual creation |
| 5 | `isPublic` for rule-generated slots? | Always `true` |
| 6 | Keep "Bloquear Periodo" button on appointments page? | Yes, but wire it to open the modal on the Bloqueos tab |
| 7 | Cron auth: header vs query param? | Query param (`?secret=...`) — Railway cron doesn't support custom headers |
