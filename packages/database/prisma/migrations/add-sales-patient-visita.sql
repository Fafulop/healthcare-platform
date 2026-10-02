-- Migration: VENTAS PACIENTE paso 3 — `sales.patient_id` + `sales.visita_id`, `client_id` opcional
-- Purpose: el comprador de una venta es SIEMPRE un paciente (decisión del usuario 2026-10-02): la
--   venta guarda el paciente y, si nació en una, la visita. Antes Nueva Venta creaba por detrás una
--   COPIA del paciente en `clients`, empatada por nombre, y la venta no sabía de qué paciente era.
--   Diseño: docs/DESDE JUNIO/VENTAS PACIENTE/01-DISENO.md (decisión 5).
-- Date: 2026-10-02
--
-- Columnas SIMPLES, sin FK, a propósito: `sales` vive en `practice_management`; `patients` y
-- `visitas`, en `medical_records`. Es la convención de `ledger_entries.patient_id` /
-- `tratamiento_id` («plain link, no cross-schema FK on purpose»). La API comprueba que el paciente
-- y la visita sean del doctor antes de guardarlos.
--
-- `client_id` pasa a NULL permitido: las ventas nuevas van a un paciente y no tienen cliente. Las
-- viejas (cuentas de prueba, según el usuario) se quedan con su cliente: SIN backfill. La FK a
-- `clients` (ON DELETE RESTRICT) se queda tal cual: un NULL no la toca.
--
-- CHECK: toda venta tiene paciente O cliente. NOT VALID + VALIDATE separado = el ALTER no recorre
-- la tabla bajo el candado; las filas existentes cumplen (todas tienen client_id NOT NULL hoy).
--
-- ADD COLUMN nullable sin default = sólo metadatos (instantáneo); DROP NOT NULL también. Candado
-- ACCESS EXCLUSIVE breve: `lock_timeout` para no hacer cola detrás de una escritura larga.
-- Tabla: ~7 filas (medido 2026-10-02) ⇒ índices al instante, sin CONCURRENTLY.
-- Idempotente (IF NOT EXISTS / DO-block). El código desplegado no conoce las columnas y siempre manda
-- client_id: correr esto ANTES del push no cambia nada de lo que hoy funciona.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "practice_management"."sales"
  ADD COLUMN IF NOT EXISTS "patient_id" TEXT,
  ADD COLUMN IF NOT EXISTS "visita_id"  TEXT;

ALTER TABLE "practice_management"."sales"
  ALTER COLUMN "client_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_paciente_o_cliente') THEN
    ALTER TABLE "practice_management"."sales"
      ADD CONSTRAINT "sales_paciente_o_cliente"
      CHECK ("patient_id" IS NOT NULL OR "client_id" IS NOT NULL) NOT VALID;
  END IF;
END$$;
ALTER TABLE "practice_management"."sales" VALIDATE CONSTRAINT "sales_paciente_o_cliente";

-- Las ventas de UN paciente de UN doctor; las de UNA visita.
CREATE INDEX IF NOT EXISTS "sales_doctor_id_patient_id_idx"
  ON "practice_management"."sales"("doctor_id", "patient_id");
CREATE INDEX IF NOT EXISTS "sales_visita_id_idx"
  ON "practice_management"."sales"("visita_id");
