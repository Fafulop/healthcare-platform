-- Migration: Add prescription imaging and lab study tables
-- Purpose: Support ordering imaging (X-ray, CT, MRI) and lab studies from a prescription
-- Date: 2026-03-16

CREATE TABLE IF NOT EXISTS medical_records.prescription_imaging_studies (
    id              SERIAL PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    study_name      VARCHAR(255) NOT NULL,
    region          VARCHAR(100),
    indication      TEXT,
    urgency         VARCHAR(100),
    notes           TEXT,
    "order"         INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT prescription_imaging_studies_prescription_id_fkey
        FOREIGN KEY (prescription_id)
        REFERENCES medical_records.prescriptions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS prescription_imaging_studies_prescription_id_order_idx
    ON medical_records.prescription_imaging_studies(prescription_id, "order");

CREATE TABLE IF NOT EXISTS medical_records.prescription_lab_studies (
    id              SERIAL PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    study_name      VARCHAR(255) NOT NULL,
    indication      TEXT,
    urgency         VARCHAR(100),
    fasting         VARCHAR(255),
    notes           TEXT,
    "order"         INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT prescription_lab_studies_prescription_id_fkey
        FOREIGN KEY (prescription_id)
        REFERENCES medical_records.prescriptions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS prescription_lab_studies_prescription_id_order_idx
    ON medical_records.prescription_lab_studies(prescription_id, "order");
