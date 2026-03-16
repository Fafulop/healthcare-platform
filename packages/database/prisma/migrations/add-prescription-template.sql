-- Migration: Add prescription PDF template fields to doctors
-- Purpose: Allow doctors to customize their prescription PDF (logo, signature, color scheme)
-- Date: 2026-03-16

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS prescription_logo_url      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS prescription_signature_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS prescription_color_scheme  VARCHAR(50) DEFAULT 'blue';
