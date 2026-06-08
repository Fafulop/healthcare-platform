-- Migration: Add manual_category to sat_cfdi_details
-- Purpose: Allow users to manually classify CFDIs into deduction categories
-- Date: 2026-06-08

ALTER TABLE practice_management.sat_cfdi_details
  ADD COLUMN IF NOT EXISTS manual_category VARCHAR(50);
