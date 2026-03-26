-- Migration: Add patient_notes to medical_records schema
-- Purpose: Per-patient free-form notes written by the doctor
-- Date: 2026-03-25

CREATE TABLE IF NOT EXISTS medical_records.patient_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT patient_notes_patient_id_fkey
        FOREIGN KEY (patient_id)
        REFERENCES medical_records.patients(id)
        ON DELETE CASCADE,

    CONSTRAINT patient_notes_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS patient_notes_patient_id_updated_at_idx
    ON medical_records.patient_notes(patient_id, updated_at);

CREATE INDEX IF NOT EXISTS patient_notes_doctor_id_idx
    ON medical_records.patient_notes(doctor_id);
