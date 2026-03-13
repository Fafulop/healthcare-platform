-- Migration: Add appointment integrity constraints
-- Purpose:
--   1. Cancel any existing duplicate active bookings for the same slot (keep oldest, cancel the rest)
--   2. Add partial unique index on bookings(slot_id) WHERE status is active — prevents double-booking at DB level
--   3. Add unique constraint on appointment_slots(doctor_id, date, start_time) — already in schema.prisma, apply to DB
-- Date: 2026-03-13

-- ── Step 1: Resolve any existing duplicate active bookings ──────────────────
-- If two PENDING/CONFIRMED bookings exist for the same slot (the bug we fixed),
-- keep the oldest (lowest created_at) and cancel the rest.
WITH duplicate_bookings AS (
  SELECT
    id,
    slot_id,
    status,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at ASC) AS rn
  FROM public.bookings
  WHERE status IN ('PENDING', 'CONFIRMED')
)
UPDATE public.bookings
SET
  status = 'CANCELLED',
  cancelled_at = NOW()
WHERE id IN (
  SELECT id FROM duplicate_bookings WHERE rn > 1
);

-- ── Step 2: Partial unique index on bookings ────────────────────────────────
-- Only one ACTIVE booking (PENDING or CONFIRMED) is allowed per slot.
-- CANCELLED, COMPLETED, NO_SHOW do not count — slot can be re-used after those.
-- This makes double-booking structurally impossible at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS booking_slot_active_unique
  ON public.bookings (slot_id)
  WHERE status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW');

-- ── Step 3: Unique constraint on appointment_slots ──────────────────────────
-- Already exists in the DB — this step is a no-op kept for documentation.
-- Confirmed present: appointment_slots_doctor_id_date_start_time_key
