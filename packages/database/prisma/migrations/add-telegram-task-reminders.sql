-- Migration: Add Telegram task reminder fields
-- Purpose: Per-doctor scheduled reminders for pending tasks via Telegram
-- Date: 2026-04-09

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_task_reminder          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_task_reminder_offset_minutes  INTEGER NOT NULL DEFAULT 60;

ALTER TABLE medical_records.tasks
  ADD COLUMN IF NOT EXISTS telegram_reminder_sent_at TIMESTAMP(3);
