-- Migration: Add patient_id to appointment_form_links + make booking_id nullable
-- Purpose: Decouple formulario lifecycle from booking — formularios survive booking detachment
--          and persist in the patient expediente independently.
-- Date: 2026-04-11

-- Make booking_id nullable (detaching a formulario from a booking no longer deletes it)
ALTER TABLE public.appointment_form_links
  ALTER COLUMN booking_id DROP NOT NULL;

-- Add direct patient_id FK (cross-schema: public → medical_records)
ALTER TABLE public.appointment_form_links
  ADD COLUMN IF NOT EXISTS patient_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_form_links_patient_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_form_links
      ADD CONSTRAINT appointment_form_links_patient_id_fkey
      FOREIGN KEY (patient_id)
      REFERENCES medical_records.patients(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS appointment_form_links_patient_id_idx
  ON public.appointment_form_links(patient_id);
