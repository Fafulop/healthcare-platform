-- Migration: Add reminder_email_offset_minutes to doctors
-- Purpose: Allow per-doctor configurable email reminder lead time (default 120 = 2 hours)
-- Date: 2026-04-11

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS reminder_email_offset_minutes INTEGER NOT NULL DEFAULT 120;
