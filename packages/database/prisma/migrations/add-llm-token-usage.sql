-- Migration: Add llm_token_usage table to public schema
-- Purpose: Track LLM token consumption per doctor per endpoint for cost attribution
-- Date: 2026-02-20

CREATE TABLE IF NOT EXISTS public.llm_token_usage (
    id                 TEXT             NOT NULL,
    doctor_id          TEXT             NOT NULL,
    endpoint           VARCHAR(100)     NOT NULL,
    model              VARCHAR(100)     NOT NULL,
    provider           VARCHAR(50)      NOT NULL,
    prompt_tokens      INTEGER          NOT NULL,
    completion_tokens  INTEGER          NOT NULL,
    total_tokens       INTEGER          NOT NULL,
    duration_seconds   DOUBLE PRECISION,
    created_at         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT llm_token_usage_pkey
        PRIMARY KEY (id),

    CONSTRAINT llm_token_usage_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS llm_token_usage_doctor_id_idx
    ON public.llm_token_usage(doctor_id);

CREATE INDEX IF NOT EXISTS llm_token_usage_doctor_id_created_at_idx
    ON public.llm_token_usage(doctor_id, created_at);

CREATE INDEX IF NOT EXISTS llm_token_usage_created_at_idx
    ON public.llm_token_usage(created_at);
