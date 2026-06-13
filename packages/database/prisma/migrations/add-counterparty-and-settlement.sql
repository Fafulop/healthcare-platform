-- Migration: counterparty fiscal identity on ledger entries + bank settlement (many-to-one)
-- Purpose:
--   Gap 1 — give `cita` entries the patient RFC/name so SAT matching has its strongest signal.
--   Gap 2 — model one bank deposit reconciling many ledger entries (batched card/cash payouts).
--   AI-agent — denormalized counterparty + patientId let an agent reason over income directly.
-- Date: 2026-06-13

-- ── LedgerEntry: counterparty + patient link ────────────────────────────────
ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "counterparty_rfc"  VARCHAR(13),
  ADD COLUMN IF NOT EXISTS "counterparty_name" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "patient_id"        TEXT;

CREATE INDEX IF NOT EXISTS ledger_entries_doctor_patient_idx
  ON "practice_management"."ledger_entries"("doctor_id", "patient_id")
  WHERE "patient_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_doctor_counterparty_rfc_idx
  ON "practice_management"."ledger_entries"("doctor_id", "counterparty_rfc")
  WHERE "counterparty_rfc" IS NOT NULL;

-- ── BankSettlementItem: one deposit -> many entries ─────────────────────────
CREATE TABLE IF NOT EXISTS "practice_management"."bank_settlement_items" (
  "id"               SERIAL PRIMARY KEY,
  "bank_movement_id" INTEGER NOT NULL,
  "ledger_entry_id"  INTEGER NOT NULL,
  "doctor_id"        TEXT    NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An entry can belong to at most one settlement.
CREATE UNIQUE INDEX IF NOT EXISTS bank_settlement_items_ledger_entry_key
  ON "practice_management"."bank_settlement_items"("ledger_entry_id");

CREATE INDEX IF NOT EXISTS bank_settlement_items_movement_idx
  ON "practice_management"."bank_settlement_items"("bank_movement_id");

CREATE INDEX IF NOT EXISTS bank_settlement_items_doctor_idx
  ON "practice_management"."bank_settlement_items"("doctor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_settlement_items_movement_fkey'
  ) THEN
    ALTER TABLE "practice_management"."bank_settlement_items"
      ADD CONSTRAINT "bank_settlement_items_movement_fkey"
      FOREIGN KEY ("bank_movement_id")
      REFERENCES "practice_management"."bank_movements"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_settlement_items_entry_fkey'
  ) THEN
    ALTER TABLE "practice_management"."bank_settlement_items"
      ADD CONSTRAINT "bank_settlement_items_entry_fkey"
      FOREIGN KEY ("ledger_entry_id")
      REFERENCES "practice_management"."ledger_entries"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
