-- Migration: Add Mercado Pago fields to doctors table
-- Purpose: Store MP OAuth credentials for marketplace integration
-- Date: 2026-05-18

ALTER TABLE "public"."doctors"
  ADD COLUMN IF NOT EXISTS "mp_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mp_public_key" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_connected" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "doctors_mp_user_id_key"
  ON "public"."doctors"("mp_user_id");
