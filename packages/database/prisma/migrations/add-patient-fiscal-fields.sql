-- Migration: Add fiscal/facturacion fields to patients table
-- Purpose: Store patient fiscal data (RFC, razon social, regimen fiscal, etc.) for CFDI emission
-- Date: 2026-05-19

ALTER TABLE "medical_records"."patients"
  ADD COLUMN IF NOT EXISTS "requiere_factura" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rfc" VARCHAR(13),
  ADD COLUMN IF NOT EXISTS "razon_social" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "regimen_fiscal" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "uso_cfdi" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "codigo_postal_fiscal" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "constancia_fiscal_url" TEXT,
  ADD COLUMN IF NOT EXISTS "constancia_fiscal_name" VARCHAR(255);
