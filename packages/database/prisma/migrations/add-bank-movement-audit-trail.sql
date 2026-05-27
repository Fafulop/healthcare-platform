-- Add audit trail fields to bank_movements for tracking match actions
ALTER TABLE practice_management.bank_movements
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matched_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS match_history JSONB;
