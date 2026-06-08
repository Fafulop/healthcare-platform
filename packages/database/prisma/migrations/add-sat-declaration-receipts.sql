-- Migration: Add sat_declaration_receipts table
-- Purpose: Store actual ISR/IVA paid per month + PDF acuse de recibo
-- Date: 2026-06-08

CREATE TABLE IF NOT EXISTS practice_management.sat_declaration_receipts (
    id SERIAL PRIMARY KEY,
    doctor_id TEXT NOT NULL,

    year INTEGER NOT NULL,
    month INTEGER NOT NULL,  -- 1-12 = monthly, 13 = annual

    isr_pagado DECIMAL(14, 2),
    iva_pagado DECIMAL(14, 2),

    pdf_url TEXT,
    pdf_file_name VARCHAR(255),

    notes TEXT,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT sat_declaration_receipts_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS sat_declaration_receipts_doctor_year_month_key
    ON practice_management.sat_declaration_receipts(doctor_id, year, month);
