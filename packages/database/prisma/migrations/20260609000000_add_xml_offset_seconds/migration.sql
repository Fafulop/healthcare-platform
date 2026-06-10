-- Add xml_offset_seconds to doctor_fiscal_profiles
-- Used to offset FechaInicial in SAT XML requests to avoid error 5002
-- (2-request lifetime limit per exact date range).
-- Default 2 for existing rows (offsets 0 and 1 already burned).
ALTER TABLE practice_management.doctor_fiscal_profiles
  ADD COLUMN xml_offset_seconds INTEGER NOT NULL DEFAULT 0;

-- Set existing profiles to 2 (current hardcoded offset)
UPDATE practice_management.doctor_fiscal_profiles
  SET xml_offset_seconds = 2;
