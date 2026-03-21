-- Migration: Pre-appointment form links
-- Purpose: Allow doctors to send patients a custom form link before a confirmed appointment.
--          Adds isPreAppointment flag to encounter_templates and creates appointment_form_links table.
-- Date: 2026-03-21

-- Part 1: Add isPreAppointment column to encounter_templates
ALTER TABLE medical_records.encounter_templates
  ADD COLUMN IF NOT EXISTS is_pre_appointment BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS encounter_templates_doctor_id_is_pre_appointment_idx
  ON medical_records.encounter_templates(doctor_id, is_pre_appointment);

-- Part 2: Create AppointmentFormStatus enum
DO $$ BEGIN
  CREATE TYPE public."AppointmentFormStatus" AS ENUM ('PENDING', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Part 3: Create appointment_form_links table
CREATE TABLE IF NOT EXISTS public.appointment_form_links (
    id              TEXT PRIMARY KEY,
    token           TEXT NOT NULL UNIQUE,
    doctor_id       TEXT NOT NULL,
    booking_id      TEXT NOT NULL UNIQUE,
    template_id     TEXT NOT NULL,
    status          public."AppointmentFormStatus" NOT NULL DEFAULT 'PENDING',
    submission_data JSONB,
    submitted_at    TIMESTAMP(3),
    patient_name    TEXT NOT NULL,
    patient_email   TEXT NOT NULL,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT appointment_form_links_doctor_id_fkey
        FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT appointment_form_links_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS appointment_form_links_doctor_id_idx
    ON public.appointment_form_links(doctor_id);

CREATE INDEX IF NOT EXISTS appointment_form_links_doctor_id_status_idx
    ON public.appointment_form_links(doctor_id, status);
