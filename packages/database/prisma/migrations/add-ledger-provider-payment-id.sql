-- Migration: H-010 / H-054 (PRUEBAS Y GUIAS) — `ledger_entries.provider_payment_id`
-- Purpose: the idempotency key of a payment-webhook income — the PROVIDER's id of that payment
--   (`mp:<payment id>` · `stripe:<checkout session id>`). Before, the key was the cita
--   (`booking_id`), so a payment on a cita that already had its income (completed in cash, then
--   the patient paid the old link) was DROPPED from Flujo; and keying on the link's state
--   (the first attempt at the fix) can drop or duplicate payments under MP's re-deliveries.
--   One row per provider payment, whatever the link's state.
--   docs/DESDE JUNIO/PRUEBAS Y GUIAS/03-HALLAZGOS.md (H-010)
-- Date: 2026-10-04
--
-- ADD COLUMN nullable sin default = sólo metadatos en PG (instantáneo), pero toma un candado
-- ACCESS EXCLUSIVE breve: `lock_timeout` para no hacer cola detrás de una escritura larga.
-- Tabla ~1k filas ⇒ el índice único se construye al instante; sin CONCURRENTLY. Todas las filas
-- existentes quedan NULL (un índice único admite muchos NULL).
-- Idempotente (IF NOT EXISTS). El código desplegado no conoce la columna: correr esto no cambia nada.
-- Nombre del índice = el que Prisma genera para `@unique` (`<tabla>_<columna>_key`).

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "provider_payment_id" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_provider_payment_id_key"
  ON "practice_management"."ledger_entries"("provider_payment_id");
