-- Migration: Add bank reconciliation tables
-- Purpose: BankStatement, BankMovement, BankCategorizationRule for bank statement reconciliation
-- Date: 2026-05-26

-- 1. Bank Statements
CREATE TABLE IF NOT EXISTS "practice_management"."bank_statements" (
    "id" SERIAL PRIMARY KEY,
    "doctor_id" TEXT NOT NULL,

    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,

    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,

    "total_deposits" DECIMAL(12, 2),
    "total_withdrawals" DECIMAL(12, 2),
    "ending_balance" DECIMAL(12, 2),

    "status" VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    "movement_count" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "new_count" INTEGER NOT NULL DEFAULT 0,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_doctor_id_fkey"
        FOREIGN KEY ("doctor_id")
        REFERENCES "public"."doctors"("id")
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "bank_statements_doctor_id_idx"
    ON "practice_management"."bank_statements"("doctor_id");

-- Unique constraint: one statement per bank+account+month+year per doctor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_statements_doctor_id_bank_name_account_number_period__key'
  ) THEN
    ALTER TABLE "practice_management"."bank_statements"
      ADD CONSTRAINT "bank_statements_doctor_id_bank_name_account_number_period__key"
      UNIQUE ("doctor_id", "bank_name", "account_number", "period_month", "period_year");
  END IF;
END$$;

-- 2. Bank Movements
CREATE TABLE IF NOT EXISTS "practice_management"."bank_movements" (
    "id" SERIAL PRIMARY KEY,
    "bank_statement_id" INTEGER NOT NULL,

    "transaction_date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "reference" VARCHAR(255),
    "amount" DECIMAL(12, 2) NOT NULL,
    "movement_type" VARCHAR(10) NOT NULL,
    "balance" DECIMAL(12, 2),

    "suggested_area" VARCHAR(255),
    "suggested_subarea" VARCHAR(255),
    "suggested_concept" VARCHAR(500),

    "match_status" VARCHAR(20) NOT NULL DEFAULT 'unmatched',
    "match_confidence" DECIMAL(3, 2),

    "ledger_entry_id" INTEGER,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_movements_bank_statement_id_fkey"
        FOREIGN KEY ("bank_statement_id")
        REFERENCES "practice_management"."bank_statements"("id")
        ON DELETE CASCADE,

    CONSTRAINT "bank_movements_ledger_entry_id_fkey"
        FOREIGN KEY ("ledger_entry_id")
        REFERENCES "practice_management"."ledger_entries"("id")
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "bank_movements_bank_statement_id_idx"
    ON "practice_management"."bank_movements"("bank_statement_id");

CREATE INDEX IF NOT EXISTS "bank_movements_match_status_idx"
    ON "practice_management"."bank_movements"("match_status");

CREATE UNIQUE INDEX IF NOT EXISTS "bank_movements_ledger_entry_id_key"
    ON "practice_management"."bank_movements"("ledger_entry_id");

-- 3. Bank Categorization Rules
CREATE TABLE IF NOT EXISTS "practice_management"."bank_categorization_rules" (
    "id" SERIAL PRIMARY KEY,
    "doctor_id" TEXT NOT NULL,

    "pattern" VARCHAR(255) NOT NULL,
    "pattern_type" VARCHAR(20) NOT NULL DEFAULT 'contains',
    "movement_type" VARCHAR(10) NOT NULL,

    "entry_type" VARCHAR(20) NOT NULL,
    "area" VARCHAR(255) NOT NULL,
    "subarea" VARCHAR(255),
    "concept" VARCHAR(500),

    "times_used" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_categorization_rules_doctor_id_fkey"
        FOREIGN KEY ("doctor_id")
        REFERENCES "public"."doctors"("id")
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "bank_categorization_rules_doctor_id_idx"
    ON "practice_management"."bank_categorization_rules"("doctor_id");
