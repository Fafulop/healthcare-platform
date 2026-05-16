-- Migration: Add sat_pagos table for payment complement tracking
-- Date: 2026-05-16

CREATE TABLE IF NOT EXISTS practice_management.sat_pagos (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  pago_uuid VARCHAR(36) NOT NULL,
  factura_uuid VARCHAR(36) NOT NULL,
  serie VARCHAR(25),
  folio VARCHAR(40),
  fecha_pago TIMESTAMP,
  forma_pago VARCHAR(10),
  monto_pagado DECIMAL(14,2),
  saldo_anterior DECIMAL(14,2),
  saldo_insoluto DECIMAL(14,2),
  num_parcialidad INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_pagos_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS sat_pagos_unique_idx
  ON practice_management.sat_pagos(doctor_id, pago_uuid, factura_uuid);

CREATE INDEX IF NOT EXISTS sat_pagos_factura_idx
  ON practice_management.sat_pagos(doctor_id, factura_uuid);
