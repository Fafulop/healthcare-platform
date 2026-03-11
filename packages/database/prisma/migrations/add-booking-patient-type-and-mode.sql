-- Migration: Add is_first_time and appointment_mode to bookings
-- Purpose: Track whether patient is visiting for the first time and whether appointment is in-person or telemedicine
-- Date: 2026-03-10

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_first_time BOOLEAN,
  ADD COLUMN IF NOT EXISTS appointment_mode TEXT;
