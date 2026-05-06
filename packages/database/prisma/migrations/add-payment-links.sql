-- Migration: Add payment_links table and PaymentLinkStatus enum
-- Purpose: Phase 2 — Stripe payment links for doctors
-- Date: 2026-05-05

-- Create enum type (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentLinkStatus') THEN
    CREATE TYPE "public"."PaymentLinkStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
  END IF;
END$$;

-- Create payment_links table
CREATE TABLE IF NOT EXISTS "public"."payment_links" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "stripe_payment_link_id" TEXT NOT NULL,
    "stripe_payment_link_url" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10, 2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "booking_id" TEXT,
    "service_id" TEXT,
    "status" "public"."PaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "payment_links_stripe_payment_link_id_key"
    ON "public"."payment_links"("stripe_payment_link_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_links_booking_id_key"
    ON "public"."payment_links"("booking_id");

-- Performance index
CREATE INDEX IF NOT EXISTS "payment_links_doctor_id_idx"
    ON "public"."payment_links"("doctor_id");

-- Foreign keys (wrapped in DO block so safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_doctor_id_fkey'
  ) THEN
    ALTER TABLE "public"."payment_links"
      ADD CONSTRAINT "payment_links_doctor_id_fkey"
      FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_booking_id_fkey'
  ) THEN
    ALTER TABLE "public"."payment_links"
      ADD CONSTRAINT "payment_links_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_service_id_fkey'
  ) THEN
    ALTER TABLE "public"."payment_links"
      ADD CONSTRAINT "payment_links_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
