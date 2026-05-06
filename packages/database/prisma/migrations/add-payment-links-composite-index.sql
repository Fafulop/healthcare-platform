-- Migration: Add composite index on payment_links (doctor_id, status)
-- Purpose: Optimize queries filtering by doctor and status
-- Date: 2026-05-05

CREATE INDEX IF NOT EXISTS "payment_links_doctor_id_status_idx"
    ON "public"."payment_links"("doctor_id", "status");
