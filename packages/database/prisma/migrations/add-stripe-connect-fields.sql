-- Migration: Add Stripe Connect fields to doctors table
-- Purpose: Enable Stripe Connect onboarding for doctors (Phase 1)
-- Date: 2026-05-05

ALTER TABLE "public"."doctors"
  ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Unique index on stripe_account_id (safe to re-run)
CREATE UNIQUE INDEX IF NOT EXISTS "doctors_stripe_account_id_key"
  ON "public"."doctors"("stripe_account_id");
