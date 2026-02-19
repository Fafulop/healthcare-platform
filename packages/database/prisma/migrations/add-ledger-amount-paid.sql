-- Add amount_paid to ledger_entries if not already present
ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(12,2) DEFAULT 0;
