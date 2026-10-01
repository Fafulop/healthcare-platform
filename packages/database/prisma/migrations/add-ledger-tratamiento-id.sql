-- Migration: VISITAS fase 2 (T6a) — `ledger_entries.tratamiento_id`
-- Purpose: el DINERO de un tratamiento con precio de paquete. Dos clases de movimiento lo llevan:
--   · los PAGOS DEL PAQUETE (adelanto, abonos): ingresos ligados al tratamiento, sin cita;
--   · el cobro de cada SESIÓN concluida de un tratamiento con paquete: $0 «cubierta por el paquete»
--     (o el cargo extra), ligado a la cita (booking_id, como hoy) Y al tratamiento.
--   Saldo = precio del paquete − pagos del paquete: se CALCULA, nunca se guarda (DISEÑO §5).
--   Diseño y plan:
--   docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md (§5)
--   docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md (§6, T6)
-- Date: 2026-10-01
--
-- Columna SIMPLE, sin FK, a propósito: `ledger_entries` vive en `practice_management` y
-- `tratamientos` en `medical_records`; `patient_id` ya se liga igual («plain link, no cross-schema
-- FK on purpose», schema.prisma). Borrar un tratamiento NO borra dinero: el movimiento se queda
-- con su `tratamiento_id` colgando, y la UI lo trata como «tratamiento borrado».
--
-- ADD COLUMN nullable sin default = sólo metadatos en PG (instantáneo), pero toma un candado
-- ACCESS EXCLUSIVE breve: `lock_timeout` para no hacer cola detrás de una escritura larga.
-- Tabla: 957 filas / 984 kB (medido 2026-10-01) ⇒ el índice se construye al instante; sin CONCURRENTLY.
-- Idempotente (IF NOT EXISTS). El código desplegado no conoce la columna: correr esto no cambia nada.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "tratamiento_id" TEXT;

-- Los movimientos de UN tratamiento de UN doctor (pagos del paquete + sesiones cubiertas).
CREATE INDEX IF NOT EXISTS "ledger_entries_doctor_id_tratamiento_id_idx"
  ON "practice_management"."ledger_entries"("doctor_id", "tratamiento_id");
