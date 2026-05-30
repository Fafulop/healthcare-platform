-- Migration: Add patient_summaries table
-- Purpose: Store AI-generated patient clinical summaries
-- Date: 2026-05-29

CREATE TABLE IF NOT EXISTS medical_records.patient_summaries (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    content TEXT NOT NULL,
    data_points JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT patient_summaries_patient_id_fkey
        FOREIGN KEY (patient_id)
        REFERENCES medical_records.patients(id)
        ON DELETE CASCADE,

    CONSTRAINT patient_summaries_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS patient_summaries_patient_id_idx
    ON medical_records.patient_summaries(patient_id);
