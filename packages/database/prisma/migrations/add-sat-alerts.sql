-- Migration: Add sat_alerts table
-- Date: 2026-05-16

CREATE TABLE IF NOT EXISTS practice_management.sat_alerts (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'new_cfdi' | 'cancelled' | 'new_month_available'
  uuid VARCHAR(36),
  direction VARCHAR(10),
  issuer_name VARCHAR(300),
  monto DECIMAL(14,2),
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_alerts_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sat_alerts_doctor_unread_idx
  ON practice_management.sat_alerts(doctor_id, read) WHERE read = FALSE;
