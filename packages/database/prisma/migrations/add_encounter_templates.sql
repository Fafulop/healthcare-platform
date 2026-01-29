-- Migration: Add encounter_templates table to medical_records schema
-- Purpose: Support encounter template functionality for doctors
-- Date: 2026-01-28

-- Create encounter_templates table
CREATE TABLE IF NOT EXISTS medical_records.encounter_templates (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    field_visibility JSONB NOT NULL,
    default_values JSONB NOT NULL,
    use_soap_mode BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    -- Foreign key to doctors table
    CONSTRAINT encounter_templates_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Add unique constraint: each doctor can only have one template with a given name
CREATE UNIQUE INDEX IF NOT EXISTS encounter_templates_doctor_id_name_key
    ON medical_records.encounter_templates(doctor_id, name);

-- Add index for querying active templates by doctor
CREATE INDEX IF NOT EXISTS encounter_templates_doctor_id_is_active_idx
    ON medical_records.encounter_templates(doctor_id, is_active);
