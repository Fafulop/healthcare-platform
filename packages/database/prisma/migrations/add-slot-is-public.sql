-- Migration: Add is_public column to appointment_slots
-- Purpose: Distinguish public (patient-bookable) vs private (doctor-internal) slots
-- "Nuevo horario" creates isPublic=false private slots instead of freeform bookings
-- Date: 2026-03-14

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
