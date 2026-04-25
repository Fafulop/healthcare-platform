-- Migration: Add blocked_times table to public schema
-- Purpose: Reversible time blocking for appointments v2 (overlay on availability ranges)
-- Date: 2026-04-25

CREATE TABLE IF NOT EXISTS public.blocked_times (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    date TIMESTAMP(3) NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT blocked_times_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS blocked_times_doctor_id_date_idx
    ON public.blocked_times(doctor_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS blocked_times_doctor_id_date_start_time_end_time_key
    ON public.blocked_times(doctor_id, date, start_time, end_time);
