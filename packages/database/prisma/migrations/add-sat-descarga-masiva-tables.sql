-- Migration: Add SAT Descarga Masiva tables
-- Purpose: e.Firma fields on fiscal profile + sat_sync_jobs + sat_cfdi_metadata
-- Date: 2026-05-15

-- 1. Add e.Firma (FIEL) columns to doctor_fiscal_profiles
ALTER TABLE practice_management.doctor_fiscal_profiles
  ADD COLUMN IF NOT EXISTS fiel_uploaded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiel_uploaded_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS fiel_valid_until TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS fiel_cer_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS fiel_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS fiel_password_encrypted TEXT;

-- 2. SAT sync jobs table
CREATE TABLE IF NOT EXISTS practice_management.sat_sync_jobs (
  id              SERIAL PRIMARY KEY,
  doctor_id       TEXT NOT NULL,
  fiscal_profile_id INTEGER NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  request_id      VARCHAR(100),
  request_type    VARCHAR(10) NOT NULL,
  direction       VARCHAR(10) NOT NULL,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  rfc_filter      VARCHAR(13),
  package_ids     TEXT[] DEFAULT '{}',
  cfdi_count      INTEGER,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 10,
  last_error      TEXT,
  started_at      TIMESTAMP(3),
  completed_at    TIMESTAMP(3),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_sync_jobs_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
  CONSTRAINT sat_sync_jobs_fiscal_profile_id_fkey
    FOREIGN KEY (fiscal_profile_id) REFERENCES practice_management.doctor_fiscal_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sat_sync_jobs_doctor_status_idx
  ON practice_management.sat_sync_jobs(doctor_id, status);
CREATE INDEX IF NOT EXISTS sat_sync_jobs_status_created_idx
  ON practice_management.sat_sync_jobs(status, created_at);

-- 3. SAT CFDI metadata table
CREATE TABLE IF NOT EXISTS practice_management.sat_cfdi_metadata (
  id              SERIAL PRIMARY KEY,
  doctor_id       TEXT NOT NULL,
  sync_job_id     INTEGER,
  uuid            VARCHAR(36) NOT NULL,
  direction       VARCHAR(10) NOT NULL,
  issuer_rfc      VARCHAR(13) NOT NULL,
  issuer_name     VARCHAR(300),
  receiver_rfc    VARCHAR(13) NOT NULL,
  receiver_name   VARCHAR(300),
  pac_rfc         VARCHAR(13),
  monto           DECIMAL(14, 2) NOT NULL DEFAULT 0,
  efecto          VARCHAR(5),
  sat_status      VARCHAR(20) NOT NULL DEFAULT 'Vigente',
  cancelation_date TIMESTAMP(3),
  issued_at       TIMESTAMP(3) NOT NULL,
  certified_at    TIMESTAMP(3),
  synced_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_cfdi_metadata_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
  CONSTRAINT sat_cfdi_metadata_sync_job_id_fkey
    FOREIGN KEY (sync_job_id) REFERENCES practice_management.sat_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT sat_cfdi_metadata_doctor_uuid_unique UNIQUE (doctor_id, uuid)
);

CREATE INDEX IF NOT EXISTS sat_cfdi_metadata_doctor_direction_idx
  ON practice_management.sat_cfdi_metadata(doctor_id, direction);
CREATE INDEX IF NOT EXISTS sat_cfdi_metadata_issued_at_idx
  ON practice_management.sat_cfdi_metadata(issued_at);
CREATE INDEX IF NOT EXISTS sat_cfdi_metadata_issuer_rfc_idx
  ON practice_management.sat_cfdi_metadata(issuer_rfc);
CREATE INDEX IF NOT EXISTS sat_cfdi_metadata_receiver_rfc_idx
  ON practice_management.sat_cfdi_metadata(receiver_rfc);
