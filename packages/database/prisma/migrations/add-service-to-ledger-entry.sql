-- Migration: Add service_id and service_name to ledger_entries
-- Purpose: Link income ledger entries directly to doctor services (source of truth for ingresos)
-- Date: 2026-05-28

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "service_id" TEXT,
  ADD COLUMN IF NOT EXISTS "service_name" VARCHAR(255);

-- Foreign key to services table (public schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_service_id_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Index for querying ledger entries by service
CREATE INDEX IF NOT EXISTS "ledger_entries_service_id_idx"
  ON "practice_management"."ledger_entries"("service_id");

-- Backfill: populate service_id and service_name for existing cita-origin entries
-- that have a booking with a service linked
UPDATE "practice_management"."ledger_entries" le
SET
  service_id = b.service_id,
  service_name = b.service_name
FROM "public"."bookings" b
WHERE le.booking_id = b.id
  AND b.service_id IS NOT NULL
  AND le.service_id IS NULL;
