-- Migration: Add sat_cfdi_details + sat_cfdi_conceptos tables
-- Purpose: Phase 2 — Store parsed XML data (tax breakdown, payment info, line items)
-- Date: 2026-05-16

CREATE TABLE IF NOT EXISTS practice_management.sat_cfdi_details (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  uuid VARCHAR(36) NOT NULL,

  -- Financial breakdown
  subtotal DECIMAL(14,2),
  descuento DECIMAL(14,2),
  total DECIMAL(14,2),

  -- Taxes
  iva_trasladado DECIMAL(14,2),
  isr_retenido DECIMAL(14,2),
  iva_retenido DECIMAL(14,2),
  ieps DECIMAL(14,2),

  -- Payment info
  metodo_pago VARCHAR(10),
  forma_pago VARCHAR(10),
  uso_cfdi VARCHAR(10),
  moneda VARCHAR(5),
  tipo_cambio DECIMAL(10,4),

  -- Series
  serie VARCHAR(25),
  folio VARCHAR(40),
  lugar_expedicion VARCHAR(5),

  -- Sync tracking
  sync_job_id INT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_cfdi_details_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
  CONSTRAINT sat_cfdi_details_sync_job_id_fkey
    FOREIGN KEY (sync_job_id) REFERENCES practice_management.sat_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT sat_cfdi_details_doctor_uuid_unique UNIQUE (doctor_id, uuid)
);

-- Note: UNIQUE constraint sat_cfdi_details_doctor_uuid_unique already provides index coverage

-- Line items / conceptos
CREATE TABLE IF NOT EXISTS practice_management.sat_cfdi_conceptos (
  id SERIAL PRIMARY KEY,
  detail_id INT NOT NULL,

  clave_prod_serv VARCHAR(10),
  descripcion VARCHAR(1000),
  cantidad DECIMAL(14,6),
  clave_unidad VARCHAR(10),
  unidad VARCHAR(50),
  valor_unitario DECIMAL(14,6),
  importe DECIMAL(14,2),
  descuento DECIMAL(14,2),

  -- Per-concept taxes
  iva_trasladado DECIMAL(14,2),
  isr_retenido DECIMAL(14,2),

  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_cfdi_conceptos_detail_id_fkey
    FOREIGN KEY (detail_id) REFERENCES practice_management.sat_cfdi_details(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sat_cfdi_conceptos_detail
  ON practice_management.sat_cfdi_conceptos(detail_id);
