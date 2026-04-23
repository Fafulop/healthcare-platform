-- Migration: Add availability_ranges table and range-scheduling fields to doctors
-- Purpose: Support range-based scheduling where doctors define time windows instead of individual slots
-- Date: 2026-04-21

-- 1. Create availability_ranges table
CREATE TABLE IF NOT EXISTS public.availability_ranges (
  id               TEXT NOT NULL,
  doctor_id        TEXT NOT NULL,
  date             TIMESTAMP(3) NOT NULL,
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL,
  location_id      TEXT,
  google_event_id  TEXT,
  created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT availability_ranges_pkey PRIMARY KEY (id)
);

-- 2. Foreign key: availability_ranges.doctor_id → doctors.id (cascade delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_ranges_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.availability_ranges
      ADD CONSTRAINT availability_ranges_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 3. Foreign key: availability_ranges.location_id → clinic_locations.id (set null on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_ranges_location_id_fkey'
  ) THEN
    ALTER TABLE public.availability_ranges
      ADD CONSTRAINT availability_ranges_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.clinic_locations(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 4. Index: doctor_id + date (primary lookup pattern)
CREATE INDEX IF NOT EXISTS availability_ranges_doctor_id_date_idx
  ON public.availability_ranges(doctor_id, date);

-- 5. Unique constraint: prevent duplicate ranges at same start time for a doctor on a date
CREATE UNIQUE INDEX IF NOT EXISTS availability_ranges_doctor_id_date_start_time_key
  ON public.availability_ranges(doctor_id, date, start_time);

-- 6. Add range-scheduling columns to doctors table
-- appointment_buffer_minutes: buffer AFTER appointments (minutes). Default 0.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS appointment_buffer_minutes INTEGER NOT NULL DEFAULT 0;

-- default_interval_minutes: default interval for new ranges (15/30/45/60). Default 30.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS default_interval_minutes INTEGER NOT NULL DEFAULT 30;
