-- Migration: Add location_id to bookings (which consultorio the appointment is at)
-- Purpose: Today NO appointment records its consultorio. `availability_ranges` and
--          `appointment_slots` both have location_id; `bookings` does not — so for the 3 of 11
--          doctors with 2+ consultorios there is no way to tell where a patient should show up.
--          `range-bookings/route.ts` even reads the matching range's locationId and drops it.
-- Date: 2026-08-06
--
-- ⚠️ NULL means "NOT RECORDED", not "the doctor's default location".
--
-- appointment_slots.location_id and availability_ranges.location_id document NULL as "default
-- location", and this file said the same until a measurement proved it wrong for the one doctor
-- the feature exists for: `dra-adriana-michelle` works out of TWO real hospitals, so resolving
-- NULL to whichever is default would make half her appointments assert the wrong address — a
-- missing value rendered as a confident false statement, not as a blank.
--
-- So: whatever displays this column must show nothing (not a guess) when it is NULL and the
-- doctor has 2+ locations. A doctor with ONE location can still be shown that one, since there
-- is only one possible answer.
--
-- This migration backfills nothing. The 6 rows that have a knowable answer are handled in a
-- separate, printed-before-and-after step — see docs/DESDE JUNIO/CONSULTORIOS/02-PLAN §5.1.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- FK to public.clinic_locations. ON DELETE SET NULL mirrors what Prisma generates for the
-- optional relation on availability_ranges: deleting a consultorio must never delete
-- appointments, it just stops saying where they were.
-- Wrapped in DO block so it is safe to re-run (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_location_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES public.clinic_locations(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Filtering appointments by consultorio is the point of the column (the assistant currently
-- declines that question because the data does not exist).
CREATE INDEX IF NOT EXISTS bookings_location_id_idx
  ON public.bookings(location_id);
