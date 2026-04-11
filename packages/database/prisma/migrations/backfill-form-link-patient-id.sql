-- Migration: Backfill patient_id on appointment_form_links for existing SUBMITTED records
-- Purpose: Before adding formLink.patientId, submitted forms were only linked to patients
--          indirectly via booking.patientId. This backfills the new direct column so that
--          existing records appear in patient expediente and timeline queries.
-- Date: 2026-04-11
-- Safe to run multiple times (UPDATE only sets NULL values, won't overwrite existing ones).

UPDATE public.appointment_form_links afl
SET patient_id = b.patient_id
FROM public.bookings b
WHERE afl.booking_id = b.id
  AND afl.patient_id IS NULL
  AND b.patient_id IS NOT NULL;
