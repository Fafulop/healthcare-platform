-- Migration: Add facturacion CFDI tables
-- Purpose: Support CFDI emission via Facturama Multiemisor API
-- Date: 2026-05-10

-- Doctor fiscal profile (RFC, regimen, CSD status)
CREATE TABLE IF NOT EXISTS practice_management.doctor_fiscal_profiles (
    id SERIAL PRIMARY KEY,
    doctor_id TEXT NOT NULL UNIQUE,
    rfc VARCHAR(13) NOT NULL,
    razon_social VARCHAR(300) NOT NULL,
    regimen_fiscal VARCHAR(5) NOT NULL,
    regimen_fiscal_desc VARCHAR(200),
    codigo_postal VARCHAR(5) NOT NULL,

    -- CSD Status
    csd_uploaded BOOLEAN NOT NULL DEFAULT false,
    csd_uploaded_at TIMESTAMP(3),
    csd_valid_until TIMESTAMP(3),
    facturama_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT doctor_fiscal_profiles_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

-- CFDIs emitted via Facturama
CREATE TABLE IF NOT EXISTS practice_management.cfdis_emitted (
    id SERIAL PRIMARY KEY,
    fiscal_profile_id INTEGER NOT NULL,
    ledger_entry_id INTEGER,

    -- Facturama reference
    facturama_id VARCHAR(100) NOT NULL UNIQUE,

    -- CFDI data
    uuid VARCHAR(36) NOT NULL UNIQUE,
    folio VARCHAR(50),
    serie VARCHAR(10),
    cfdi_type VARCHAR(5) NOT NULL,

    -- Emisor/Receptor
    rfc_emisor VARCHAR(13) NOT NULL,
    rfc_receptor VARCHAR(13) NOT NULL,
    nombre_receptor VARCHAR(300) NOT NULL,
    uso_cfdi VARCHAR(10) NOT NULL,

    -- Montos
    subtotal DECIMAL(12, 2) NOT NULL,
    iva DECIMAL(12, 2),
    retencion_isr DECIMAL(12, 2),
    total DECIMAL(12, 2) NOT NULL,
    moneda VARCHAR(5) NOT NULL DEFAULT 'MXN',

    -- Pago
    forma_pago VARCHAR(5) NOT NULL,
    metodo_pago VARCHAR(5) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    cancelled_at TIMESTAMP(3),
    cancel_motivo VARCHAR(5),

    -- Archivos generados
    pdf_url TEXT,
    xml_url TEXT,
    xml_content TEXT,

    -- Fecha de emision
    issued_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT cfdis_emitted_fiscal_profile_id_fkey
        FOREIGN KEY (fiscal_profile_id)
        REFERENCES practice_management.doctor_fiscal_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT cfdis_emitted_ledger_entry_id_fkey
        FOREIGN KEY (ledger_entry_id)
        REFERENCES practice_management.ledger_entries(id)
        ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS cfdis_emitted_fiscal_profile_id_idx
    ON practice_management.cfdis_emitted(fiscal_profile_id);

CREATE INDEX IF NOT EXISTS cfdis_emitted_ledger_entry_id_idx
    ON practice_management.cfdis_emitted(ledger_entry_id);

CREATE INDEX IF NOT EXISTS cfdis_emitted_rfc_emisor_status_idx
    ON practice_management.cfdis_emitted(rfc_emisor, status);

CREATE INDEX IF NOT EXISTS cfdis_emitted_issued_at_idx
    ON practice_management.cfdis_emitted(issued_at);
