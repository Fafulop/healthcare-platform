-- Migration: Add Google Calendar integration fields
-- Purpose: Store OAuth tokens on User, calendar ID and enabled flag on Doctor
-- Date: 2026-03-03

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMP(3);

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS google_calendar_id           TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_enabled      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_channel_id            TEXT,
  ADD COLUMN IF NOT EXISTS google_channel_resource_id   TEXT,
  ADD COLUMN IF NOT EXISTS google_channel_expiry        TIMESTAMP(3);

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE medical_records.tasks
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
