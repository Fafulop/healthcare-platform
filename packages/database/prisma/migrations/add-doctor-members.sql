-- Migration: doctor_members + member_invites + member_audit_log (NUEVOS USUARIOS PR A)
-- Purpose: secondary users per doctor portal with per-block permissions.
--          doctor_members is the new source of truth for user→doctor resolution;
--          users.doctor_id stays as legacy fallback for owners.
-- Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §1
-- Date: 2026-07-20
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- 1. Memberships ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.doctor_members (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    doctor_id    TEXT NOT NULL,
    role         VARCHAR(10) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
    invited_by   TEXT,
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMP(3),

    CONSTRAINT doctor_members_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT doctor_members_doctor_id_fkey FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT doctor_members_role_chk CHECK (role IN ('OWNER','MEMBER')),
    CONSTRAINT doctor_members_status_chk CHECK (status IN ('ACTIVE','REVOKED'))
);

-- v1 one-portal rule: one ACTIVE membership per user. REVOKED rows free the slot.
-- Dropping this index is step 1 of multi-portal (v2). NOT expressible in Prisma
-- (partial index) — lives only here.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_active_per_user
    ON public.doctor_members(user_id) WHERE status = 'ACTIVE';

-- Exactly one ACTIVE OWNER per doctor.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_owner_per_doctor
    ON public.doctor_members(doctor_id) WHERE role = 'OWNER' AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS doctor_members_doctor_idx
    ON public.doctor_members(doctor_id);

-- Backfill: every existing linked doctor user becomes the OWNER of their portal.
-- Deterministic id ('dm_' || user id) keeps re-runs idempotent even without the
-- unique indexes.
INSERT INTO public.doctor_members (id, user_id, doctor_id, role, status, permissions)
SELECT 'dm_' || u.id, u.id, u.doctor_id, 'OWNER', 'ACTIVE', '{}'::jsonb
FROM public.users u
WHERE u.doctor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Invites -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_invites (
    id           TEXT PRIMARY KEY,
    doctor_id    TEXT NOT NULL,
    email        TEXT NOT NULL,
    permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
    status       VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    invited_by   TEXT NOT NULL,
    expires_at   TIMESTAMP(3) NOT NULL,
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP(3),

    CONSTRAINT member_invites_doctor_id_fkey FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT member_invites_status_chk
        CHECK (status IN ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS member_invites_one_pending
    ON public.member_invites(doctor_id, email) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS member_invites_email_idx
    ON public.member_invites(email);

-- 3. Member audit log (cheap, G6 option b) --------------------------------------

CREATE TABLE IF NOT EXISTS public.member_audit_log (
    id         BIGSERIAL PRIMARY KEY,
    doctor_id  TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    method     VARCHAR(8) NOT NULL,
    path       VARCHAR(300) NOT NULL,
    toggle_key VARCHAR(40),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS member_audit_doctor_idx
    ON public.member_audit_log(doctor_id, created_at);
