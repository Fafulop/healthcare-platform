-- Migration: Add booking field requirement settings to doctors table
-- Purpose: Allow per-doctor, per-flow configuration of which patient contact fields are required
-- Date: 2026-04-10

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS "booking_public_email_required"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_public_phone_required"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_public_whatsapp_required"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_horarios_email_required"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_horarios_phone_required"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_horarios_whatsapp_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_instant_email_required"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_instant_phone_required"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_instant_whatsapp_required"  BOOLEAN NOT NULL DEFAULT true;
