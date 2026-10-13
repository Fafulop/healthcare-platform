-- Migration: VISITAS 11-PLAN — `practice_management.cfdi_ingresos`
-- Purpose: UNA factura puede cubrir VARIOS ingresos (la cita de una visita + sus ventas). Hasta hoy una
--   factura (`cfdis_emitted`) se liga a UN ingreso (`ledger_entry_id`), y eso es lo que marca algo como
--   facturado: una factura «cita + ventas» dejaba las ventas como «Sin factura» y facturables dos veces.
--   · `cfdis_emitted.ledger_entry_id` SIGUE siendo el ingreso PRINCIPAL (la cita): nada de lo que hoy lo
--     lee cambia (veredicto de la cita, uuid del SAT —único, sólo el principal lo lleva—).
--   · Esta tabla guarda la lista COMPLETA de ingresos que cubre la factura (principal incluido). Los
--     adicionales llevan además `has_factura = true` (lo pone la ruta de timbrado; lo quita la de cancelar).
--   docs/DESDE JUNIO/VISITAS/11-PLAN-factura-de-la-visita.md
-- Date: 2026-10-12
--
-- Tabla NUEVA y vacía: no toca filas existentes ni toma candados largos sobre `cfdis_emitted` /
-- `ledger_entries` (las FKs nuevas sólo piden SHARE ROW EXCLUSIVE un instante: `lock_timeout`).
-- FKs de UNA columna, como `cfdis_emitted.ledger_entry_id` (la tenencia —mismo doctor, mismo paciente—
-- la revisa la ruta antes de timbrar). Borrar la FACTURA borra sus enlaces (CASCADE); borrar un INGRESO
-- cubierto NO se puede (ver la FK de abajo). Idempotente (IF NOT EXISTS). El código desplegado no la conoce: correr esto no cambia
-- nada de lo que hoy funciona.
-- Nombres = los que Prisma genera (`<tabla>_pkey`, `<tabla>_<col>_fkey`, `<tabla>_<col>_idx`), para que
-- el schema y la BD coincidan.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS "practice_management"."cfdi_ingresos" (
  "cfdi_emitted_id" INTEGER NOT NULL,
  "ledger_entry_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cfdi_ingresos_pkey" PRIMARY KEY ("cfdi_emitted_id", "ledger_entry_id"),
  CONSTRAINT "cfdi_ingresos_cfdi_emitted_id_fkey" FOREIGN KEY ("cfdi_emitted_id")
    REFERENCES "practice_management"."cfdis_emitted"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- 🔴 NO ACTION DEFERRABLE (no CASCADE): un ingreso que una factura cubre NO se puede borrar —cancelar o
  -- borrar una venta borra su ingreso, y en cascada la factura habría perdido en silencio ese renglón—.
  -- La app lo impide antes (409 «cancela primero la factura»); esto es el respaldo en la BD. DEFERRABLE
  -- INITIALLY DEFERRED (la lección de `medical_reports`): en un borrado que arrastra las DOS cosas (la cuenta
  -- de un doctor: sus facturas y sus ingresos) la comprobación espera al final y no truena por el orden.
  -- Prisma no modela DEFERRABLE: va en la lista de «sólo en la BD» de database-architecture.md.
  CONSTRAINT "cfdi_ingresos_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id")
    REFERENCES "practice_management"."ledger_entries"("id") ON DELETE NO ACTION ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

-- «¿Qué factura cubre este ingreso?» (la venta, la cancelación).
CREATE INDEX IF NOT EXISTS "cfdi_ingresos_ledger_entry_id_idx"
  ON "practice_management"."cfdi_ingresos"("ledger_entry_id");
