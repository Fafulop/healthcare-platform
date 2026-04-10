-- Migration: Add Telegram daily summary fields
-- Purpose: Daily agenda briefing sent to doctors via Telegram at a configurable time
-- Date: 2026-04-09

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_enabled  BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_time     VARCHAR(5)   NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_sent_at  TIMESTAMP(3);
