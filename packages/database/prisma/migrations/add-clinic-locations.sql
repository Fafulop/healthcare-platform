-- Migration: Add clinic_locations table and location_id to appointment_slots
-- Purpose: Allow doctors to have up to 2 clinic addresses; slots reference a specific location
-- Date: 2026-03-14

-- Create clinic_locations table
-- NOTE: id has no DEFAULT — Prisma generates cuid() values on insert.
-- The seed INSERT below uses gen_random_uuid()::text to create IDs for migrated rows.
CREATE TABLE IF NOT EXISTS public.clinic_locations (
  id            TEXT NOT NULL,
  doctor_id     TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Consultorio Principal',
  address       TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  whatsapp      TEXT,
  hours         JSONB NOT NULL DEFAULT '{}',
  geo_lat       DOUBLE PRECISION,
  geo_lng       DOUBLE PRECISION,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT clinic_locations_pkey PRIMARY KEY (id)
);

-- Foreign key from clinic_locations to doctors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_locations_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.clinic_locations
      ADD CONSTRAINT clinic_locations_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- Index on doctor_id for lookup performance
CREATE INDEX IF NOT EXISTS clinic_locations_doctor_id_idx
  ON public.clinic_locations(doctor_id);

-- Add location_id FK column to appointment_slots
ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- Foreign key from appointment_slots.location_id to clinic_locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_slots_location_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_slots
      ADD CONSTRAINT appointment_slots_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.clinic_locations(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Seed: migrate each doctor's existing clinic data → one default ClinicLocation per doctor
-- Uses gen_random_uuid()::text to generate IDs for these migration-created rows.
-- WHERE NOT EXISTS makes this idempotent — safe to run multiple times.
INSERT INTO public.clinic_locations (id, doctor_id, name, address, phone, whatsapp, hours, geo_lat, geo_lng, is_default, display_order)
SELECT
  gen_random_uuid()::text,
  id,
  'Consultorio Principal',
  COALESCE(clinic_address, ''),
  clinic_phone,
  clinic_whatsapp,
  COALESCE(clinic_hours, '{}'),
  clinic_geo_lat,
  clinic_geo_lng,
  TRUE,
  0
FROM public.doctors
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinic_locations cl WHERE cl.doctor_id = doctors.id
);
