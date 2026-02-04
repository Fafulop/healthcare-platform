-- Migration: Add activity_logs table to public schema
-- Purpose: Track user activities for the "Actividad Reciente" dashboard table
-- Date: 2026-02-02

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,

    -- Action metadata
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id TEXT,

    -- Display information
    display_message VARCHAR(500) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20),

    -- Context data (JSON for flexibility)
    metadata JSONB,

    -- User who performed the action
    user_id TEXT,

    -- Timestamp
    timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    CONSTRAINT activity_logs_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS activity_logs_doctor_id_timestamp_idx
    ON public.activity_logs(doctor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS activity_logs_action_type_idx
    ON public.activity_logs(action_type);

CREATE INDEX IF NOT EXISTS activity_logs_entity_type_idx
    ON public.activity_logs(entity_type);

-- Comment on table
COMMENT ON TABLE public.activity_logs IS 'Tracks user activities across the system for the Recent Activity dashboard widget';
