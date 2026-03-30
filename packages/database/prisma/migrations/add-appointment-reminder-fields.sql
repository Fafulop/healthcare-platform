-- Migration: Add appointment reminder email fields
-- Purpose: Support automatic 2-hour reminder emails per doctor preference
-- Date: 2026-03-30

-- Doctor toggle: enables/disables auto reminder emails for all their bookings
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS reminder_email_enabled BOOLEAN NOT NULL DEFAULT false;

-- Booking tracking: prevents sending the reminder more than once
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_email_sent_at TIMESTAMP(3);
