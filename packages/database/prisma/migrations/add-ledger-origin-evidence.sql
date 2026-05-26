-- Migration: Add origin tracking and evidence flags to ledger_entries
-- Purpose: Track where each movement came from and whether it has comprobante/factura evidence
-- Date: 2026-05-26

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "origin" VARCHAR(30) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "has_comprobante" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "has_factura" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sat_cfdi_uuid" VARCHAR(100);

-- Unique index on sat_cfdi_uuid (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_sat_cfdi_uuid_key"
  ON "practice_management"."ledger_entries"("sat_cfdi_uuid");

-- Index for filtering by origin
CREATE INDEX IF NOT EXISTS "ledger_entries_doctor_id_origin_idx"
  ON "practice_management"."ledger_entries"("doctor_id", "origin");

-- Backfill: set origin='cita' for entries linked to a booking
UPDATE "practice_management"."ledger_entries"
  SET "origin" = 'cita'
  WHERE "booking_id" IS NOT NULL AND "origin" = 'manual';

-- Backfill: set origin='venta' for entries linked to a sale
UPDATE "practice_management"."ledger_entries"
  SET "origin" = 'venta'
  WHERE "sale_id" IS NOT NULL AND "origin" = 'manual';

-- Backfill: set has_comprobante=true for entries that have attachments
UPDATE "practice_management"."ledger_entries" le
  SET "has_comprobante" = true
  WHERE EXISTS (
    SELECT 1 FROM "practice_management"."ledger_attachments" la
    WHERE la."ledger_entry_id" = le."id"
  )
  AND "has_comprobante" = false;

-- Backfill: set has_comprobante=true for entries that have a primary file
UPDATE "practice_management"."ledger_entries"
  SET "has_comprobante" = true
  WHERE "file_url" IS NOT NULL AND "has_comprobante" = false;

-- Backfill: set has_factura=true for entries with facturas PDF or XML
UPDATE "practice_management"."ledger_entries" le
  SET "has_factura" = true
  WHERE (
    EXISTS (
      SELECT 1 FROM "practice_management"."ledger_facturas" lf
      WHERE lf."ledger_entry_id" = le."id"
    )
    OR EXISTS (
      SELECT 1 FROM "practice_management"."ledger_facturas_xml" lfx
      WHERE lfx."ledger_entry_id" = le."id"
    )
    OR EXISTS (
      SELECT 1 FROM "practice_management"."cfdis_emitted" ce
      WHERE ce."ledger_entry_id" = le."id"
    )
  )
  AND "has_factura" = false;
