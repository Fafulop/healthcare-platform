-- Migration: Add freeform booking support
-- Purpose: Allow bookings to exist without a pre-planned slot ("Nuevo horario").
--   slotId becomes nullable. Freeform bookings store date/startTime/endTime/duration directly.
--   googleEventId added to Booking for GCal sync of freeform appointments.
-- Date: 2026-03-13

-- Make slotId nullable (freeform bookings have no slot)
ALTER TABLE public.bookings
  ALTER COLUMN slot_id DROP NOT NULL;

-- Add freeform time fields (null for slot-based bookings)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS "date"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS start_time   TEXT,
  ADD COLUMN IF NOT EXISTS end_time     TEXT,
  ADD COLUMN IF NOT EXISTS duration     INTEGER,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Index for dashboard calendar queries (freeform bookings by doctor + date)
CREATE INDEX IF NOT EXISTS bookings_doctor_id_date_idx
  ON public.bookings (doctor_id, "date")
  WHERE "date" IS NOT NULL;
