-- F2c: cfdi_drafts — borradores de factura preparados por el agente (o flujos
-- manuales futuros); el doctor revisa/edita/emite en el form de Nueva Factura.
-- Aplicar a prod ANTES de desplegar el código que la usa (tabla ADITIVA, sin
-- tocar nada existente). Patrón del repo: SQL manual, nunca `prisma db push`
-- (revierte el composite FK que vive en prod).

CREATE TABLE IF NOT EXISTS practice_management.cfdi_drafts (
  id              SERIAL PRIMARY KEY,
  doctor_id       TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id      TEXT,
  ledger_entry_id INTEGER REFERENCES practice_management.ledger_entries(id) ON DELETE SET NULL,

  items           JSONB NOT NULL,
  payment_form    VARCHAR(5) NOT NULL DEFAULT '01',
  payment_method  VARCHAR(5) NOT NULL DEFAULT 'PUE',
  observations    TEXT,

  origin          VARCHAR(10) NOT NULL DEFAULT 'agent',
  status          VARCHAR(15) NOT NULL DEFAULT 'draft',
  emitted_cfdi_id INTEGER,

  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cfdi_drafts_doctor_id_status_idx ON practice_management.cfdi_drafts(doctor_id, status);
CREATE INDEX IF NOT EXISTS cfdi_drafts_doctor_id_patient_id_idx ON practice_management.cfdi_drafts(doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS cfdi_drafts_ledger_entry_id_idx ON practice_management.cfdi_drafts(ledger_entry_id);
