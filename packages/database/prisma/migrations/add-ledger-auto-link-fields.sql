-- Migration: Add auto-link and review fields to ledger_entries
-- Purpose: Support SAT auto-registration and bank reconciliation matching (Phase 1)
-- Date: 2026-06-12

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "auto_linked_confidence" DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "merged_from_id" INTEGER;

-- Index for filtering entries that need review (partial index, only where true)
CREATE INDEX IF NOT EXISTS ledger_entries_needs_review_idx
  ON "practice_management"."ledger_entries"("doctor_id", "needs_review")
  WHERE "needs_review" = true;

-- Index for merge tracking lookups
CREATE INDEX IF NOT EXISTS ledger_entries_merged_from_idx
  ON "practice_management"."ledger_entries"("merged_from_id")
  WHERE "merged_from_id" IS NOT NULL;

-- FK for merge tracking (self-referential, ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_merged_from_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_merged_from_fkey"
      FOREIGN KEY ("merged_from_id")
      REFERENCES "practice_management"."ledger_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
