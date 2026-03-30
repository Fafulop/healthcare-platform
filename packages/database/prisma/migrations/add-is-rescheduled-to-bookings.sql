-- Migration: Add is_rescheduled column to public.bookings
-- Purpose: Track whether a booking was created via the Reagendar flow,
--          so the confirmation email can say "Reagendación" instead of "Confirmación"
-- Date: 2026-03-30

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN NOT NULL DEFAULT false;
