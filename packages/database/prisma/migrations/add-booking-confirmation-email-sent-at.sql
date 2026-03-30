-- Migration: Add confirmation_email_sent_at to bookings
-- Purpose: Track when a confirmation email was last sent to the patient
-- Date: 2026-03-30

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP(3);
