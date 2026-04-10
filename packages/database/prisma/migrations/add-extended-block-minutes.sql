-- Migration: Add extended_block_minutes to bookings
-- Purpose: Allows doctors to specify how many minutes after an appointment starts
--          subsequent slots should be blocked on the public portal and Horarios disponibles.
-- Date: 2026-04-10

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extended_block_minutes INTEGER;
