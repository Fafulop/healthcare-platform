-- Migration: Add review_links table for standalone on-demand review links
-- Purpose: Doctors can generate a review link for any patient without needing a booking
-- Date: 2026-03-14

CREATE TABLE IF NOT EXISTS public.review_links (
  id           TEXT NOT NULL,
  token        TEXT NOT NULL,
  doctor_id    TEXT NOT NULL,
  patient_name TEXT,
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT review_links_pkey PRIMARY KEY (id),
  CONSTRAINT review_links_token_key UNIQUE (token)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_links_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.review_links
      ADD CONSTRAINT review_links_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
      ON DELETE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS review_links_doctor_id_idx ON public.review_links(doctor_id);
CREATE INDEX IF NOT EXISTS review_links_token_idx ON public.review_links(token);
