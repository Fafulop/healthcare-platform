-- Migration: Link bookings to patients via optional patient_id FK
-- Purpose: Allow doctors to associate appointment bookings with patient records
-- Date: 2026-04-11

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS patient_id TEXT;

-- Cross-schema FK: public.bookings → medical_records.patients
-- Wrapped in DO block so it is safe to re-run (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_patient_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_patient_id_fkey
      FOREIGN KEY (patient_id)
      REFERENCES medical_records.patients(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS bookings_patient_id_idx
  ON public.bookings(patient_id);
