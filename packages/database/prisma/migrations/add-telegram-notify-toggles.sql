-- Migration: Add per-type Telegram notification toggles to doctors
-- Purpose: Allow doctors to independently enable/disable booking and form-submission notifications
-- Date: 2026-04-09

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_booking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_notify_form    BOOLEAN NOT NULL DEFAULT true;
