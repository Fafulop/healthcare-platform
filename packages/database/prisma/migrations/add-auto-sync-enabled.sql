-- Migration: Add auto_sync_enabled to doctor_fiscal_profiles
-- Date: 2026-05-16

ALTER TABLE practice_management.doctor_fiscal_profiles
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE;
