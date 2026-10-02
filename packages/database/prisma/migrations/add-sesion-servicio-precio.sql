-- Migration: TRATAMIENTOS v2 · V1 — servicio y precio POR SESIÓN
-- Purpose: un tratamiento deja de ser un paquete con un precio: cada sesión tiene su servicio y su
--   precio, y el total del tratamiento es la SUMA de sus sesiones (decisión del usuario 2026-10-02).
--   Plan: docs/DESDE JUNIO/VISITAS/06-PLAN-tratamientos-v2.md §4.
-- Date: 2026-10-02
--
-- Las tres columnas son opcionales y SIN backfill: una sesión vieja sin `precio` cuenta con el
-- `finalPrice` de su cita si la tiene, o «sin precio» (lo decide el servidor, no se inventa).
-- `servicio_id` es liga SIMPLE a `public.services` (otro esquema, sin FK, como `ledger_entries.
-- patient_id`): sólo dice de qué servicio salió el default; el nombre y el precio guardados mandan.
--
-- ADD COLUMN nullable sin default = sólo metadatos (instantáneo); `lock_timeout` para no hacer cola
-- detrás de una escritura larga. Idempotente (IF NOT EXISTS). El código desplegado no conoce las
-- columnas: correr esto ANTES del push no cambia nada de lo que hoy funciona.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "medical_records"."tratamiento_sesiones"
  ADD COLUMN IF NOT EXISTS "servicio_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "servicio_nombre" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "precio"          DECIMAL(12, 2);

-- Un precio no puede ser negativo (cero sí: una sesión de cortesía).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamiento_sesiones_precio_no_negativo') THEN
    ALTER TABLE "medical_records"."tratamiento_sesiones"
      ADD CONSTRAINT "tratamiento_sesiones_precio_no_negativo" CHECK ("precio" IS NULL OR "precio" >= 0);
  END IF;
END$$;
