-- Migration: Add service_id and service_name to bookings
-- Purpose: Allow patients to select a service when creating a booking
-- Date: 2026-03-10

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_id TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_service_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.services(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
