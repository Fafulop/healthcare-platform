-- Migration: Add Telegram appointment reminder fields
-- Purpose: Per-doctor scheduled reminders for CONFIRMED and PENDING bookings via Telegram
-- Date: 2026-04-09

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_reminder_confirmed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_notify_reminder_pending   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_reminder_offset_minutes   INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS telegram_reminder_sent_at TIMESTAMP(3);
