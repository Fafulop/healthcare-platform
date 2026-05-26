-- Migration: Add booking_id to ledger_entries
-- Purpose: Link LedgerEntry to Booking for expediente financial display
-- Date: 2026-05-25

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "booking_id" TEXT;

-- Unique constraint (one ledger entry per booking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_booking_id_key'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_booking_id_key" UNIQUE ("booking_id");
  END IF;
END$$;

-- Foreign key to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_booking_id_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "ledger_entries_booking_id_idx"
  ON "practice_management"."ledger_entries"("booking_id");
