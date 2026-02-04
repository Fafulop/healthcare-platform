-- Migration: Add system_settings table to public schema
-- Purpose: Key-value store for system-wide admin settings (e.g., SMS toggle)
-- Date: 2026-02-04

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the SMS toggle (disabled by default)
INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('sms_enabled', 'false', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
