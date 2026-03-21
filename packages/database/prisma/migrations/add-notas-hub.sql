-- Migration: Add Notas Hub tables
-- Purpose: note_temas, note_subtemas, doctor_notes in medical_records schema
-- Date: 2026-03-21

CREATE TABLE IF NOT EXISTS medical_records.note_temas (
    id          TEXT PRIMARY KEY,
    doctor_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT note_temas_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT note_temas_doctor_name_unique
        UNIQUE (doctor_id, name)
);

CREATE INDEX IF NOT EXISTS note_temas_doctor_id_idx
    ON medical_records.note_temas(doctor_id);


CREATE TABLE IF NOT EXISTS medical_records.note_subtemas (
    id          TEXT PRIMARY KEY,
    tema_id     TEXT NOT NULL,
    doctor_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT note_subtemas_tema_id_fkey
        FOREIGN KEY (tema_id)
        REFERENCES medical_records.note_temas(id)
        ON DELETE CASCADE,

    CONSTRAINT note_subtemas_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT note_subtemas_tema_name_unique
        UNIQUE (tema_id, name)
);

CREATE INDEX IF NOT EXISTS note_subtemas_tema_id_idx
    ON medical_records.note_subtemas(tema_id);

CREATE INDEX IF NOT EXISTS note_subtemas_doctor_id_idx
    ON medical_records.note_subtemas(doctor_id);


CREATE TABLE IF NOT EXISTS medical_records.doctor_notes (
    id          TEXT PRIMARY KEY,
    doctor_id   TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    tema_id     TEXT,
    subtema_id  TEXT,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP(3) NOT NULL,

    CONSTRAINT doctor_notes_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT doctor_notes_tema_id_fkey
        FOREIGN KEY (tema_id)
        REFERENCES medical_records.note_temas(id)
        ON DELETE SET NULL,

    CONSTRAINT doctor_notes_subtema_id_fkey
        FOREIGN KEY (subtema_id)
        REFERENCES medical_records.note_subtemas(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS doctor_notes_doctor_id_idx
    ON medical_records.doctor_notes(doctor_id);

CREATE INDEX IF NOT EXISTS doctor_notes_tema_id_idx
    ON medical_records.doctor_notes(tema_id);
