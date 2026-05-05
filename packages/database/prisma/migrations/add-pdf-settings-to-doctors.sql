-- Migration: Add pdf_settings column to doctors table
-- Purpose: Store encounter PDF print preferences (header/footer visibility, margins for pre-printed letterhead paper)
-- Date: 2026-04-30

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS "pdf_settings" JSONB;
