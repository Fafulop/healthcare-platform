-- Migration: Create mp_payment_preferences table
-- Purpose: Store Mercado Pago payment links (separate from Stripe payment_links)
-- Date: 2026-05-18

CREATE TABLE IF NOT EXISTS public.mp_payment_preferences (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,

    -- MP data
    mp_preference_id TEXT NOT NULL,
    mp_init_point TEXT NOT NULL,
    mp_payment_id TEXT,

    -- Link metadata
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Optional links
    booking_id TEXT,
    service_id TEXT,

    -- Tracking
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT,
    paid_at TIMESTAMP(3),

    external_reference TEXT,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT mp_payment_preferences_doctor_id_fkey
        FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT mp_payment_preferences_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL,
    CONSTRAINT mp_payment_preferences_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mp_payment_preferences_mp_preference_id_key
    ON public.mp_payment_preferences(mp_preference_id);

CREATE UNIQUE INDEX IF NOT EXISTS mp_payment_preferences_booking_id_key
    ON public.mp_payment_preferences(booking_id);

CREATE INDEX IF NOT EXISTS mp_payment_preferences_doctor_id_idx
    ON public.mp_payment_preferences(doctor_id);

CREATE INDEX IF NOT EXISTS mp_payment_preferences_doctor_id_status_idx
    ON public.mp_payment_preferences(doctor_id, status);
