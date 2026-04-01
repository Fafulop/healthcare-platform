-- Migration: Add meet_link to bookings
-- Purpose: Store Google Meet link for TELEMEDICINA appointments
-- Date: 2026-03-31

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS "meet_link" TEXT;
