-- Migration: Add google_ads_id to doctors table
-- Purpose: Per-doctor Google Ads account ID for individual campaign tracking
-- Date: 2026-02-16

ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS google_ads_id TEXT;
