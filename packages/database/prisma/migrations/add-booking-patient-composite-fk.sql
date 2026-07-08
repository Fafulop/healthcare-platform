-- Migration: enforce booking→patient tenancy at the DB level (composite FK)
-- Purpose: today "a booking may only link to a patient of the SAME doctor" is
--   enforced only by app code (validatePatientLink). This makes Postgres
--   enforce it on EVERY write path, present and future (PR 3 hardening item a).
-- Requires: PostgreSQL 15+ (ON DELETE SET NULL with a column list).
-- Date: 2026-07-07
--
-- ⚠️⚠️ `prisma db push` REVERTS THIS MIGRATION ⚠️⚠️
-- This FK cannot be expressed in schema.prisma (doctorId already belongs to
-- the doctor relation, and Prisma cannot emit column-list SET NULL), so the
-- schema still declares the old single-column relation. `prisma db push`
-- makes the DB match the schema: it will DROP the composite FK and the
-- (id, doctor_id) unique index and recreate the single-column FK, silently
-- removing the tenancy enforcement. After ANY `prisma db push` against a
-- database, RE-RUN this migration. (See docs/NEW.MD-GUIDES/database-architecture.md.)
--
-- Pre-flight (run read-only BEFORE applying — must return 0 rows):
--   SELECT b.id, b.patient_id, b.doctor_id, p.doctor_id AS patient_doctor_id
--   FROM public.bookings b
--   LEFT JOIN medical_records.patients p ON p.id = b.patient_id
--   WHERE b.patient_id IS NOT NULL
--     AND (p.id IS NULL OR p.doctor_id <> b.doctor_id);

-- 1. FK target must have a matching unique constraint. (id alone is the PK, so
--    (id, doctor_id) is trivially unique — this index only exists for the FK.)
CREATE UNIQUE INDEX IF NOT EXISTS patients_id_doctor_id_key
  ON medical_records.patients(id, doctor_id);

-- 2. Replace the single-column FK with the composite one (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_patient_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      DROP CONSTRAINT bookings_patient_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_patient_id_doctor_id_fkey'
  ) THEN
    -- MATCH SIMPLE (default): patient_id NULL → row passes, so unlinked
    -- bookings are unaffected. On patient delete only patient_id is nulled;
    -- doctor_id (NOT NULL) is untouched.
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_patient_id_doctor_id_fkey
      FOREIGN KEY (patient_id, doctor_id)
      REFERENCES medical_records.patients(id, doctor_id)
      ON DELETE SET NULL (patient_id);
  END IF;
END$$;
