-- Add is_booking_active flag to services
-- Controls whether a service appears in the patient-facing booking widget
-- Does NOT affect the public Servicios section or the doctor-internal booking modal
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_booking_active BOOLEAN NOT NULL DEFAULT true;
