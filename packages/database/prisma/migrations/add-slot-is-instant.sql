-- Migration: Add is_instant to appointment_slots
-- Purpose: Track slots created on-the-fly via instant booking ("Nuevo horario").
--          When an instant slot's booking is cancelled, the slot closes permanently
--          instead of becoming available for re-booking.
-- Date: 2026-03-12

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS is_instant BOOLEAN NOT NULL DEFAULT false;
