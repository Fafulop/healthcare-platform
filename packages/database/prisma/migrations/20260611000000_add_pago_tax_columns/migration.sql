-- Migration: Add per-payment tax breakdown columns to sat_pago
-- Purpose: Store ImpuestosDR data from Complemento de Pagos 2.0 for cash-basis declarations
-- Date: 2026-06-11

ALTER TABLE practice_management.sat_pagos
  ADD COLUMN IF NOT EXISTS base_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS iva_trasladado_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS isr_retenido_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS iva_retenido_dr DECIMAL(14,2);

-- Index for declaration queries that join on fecha_pago
CREATE INDEX IF NOT EXISTS idx_sat_pago_fecha_pago
  ON practice_management.sat_pagos (doctor_id, fecha_pago);
