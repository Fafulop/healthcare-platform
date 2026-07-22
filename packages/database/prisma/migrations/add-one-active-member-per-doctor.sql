-- Migration: one-helper-per-doctor limit (NUEVOS USUARIOS extension)
-- Purpose: a doctor may have at most ONE active MEMBER (helper), and at most
--          ONE pending invite outstanding at a time ("1 slot" rule).
-- Design: docs/DESDE JUNIO/NUEVOS USUARIOS/03-PLAN-limite-1-helper.md §2 (+ G3)
-- Date: 2026-07-22
-- Safe to re-run (IF NOT EXISTS).
--
-- Data gate (verified read-only in prod 2026-07-22 before applying): every doctor
-- has <= 1 ACTIVE member (only dr-prueba, 1) and <= 1 PENDING invite (none) — no
-- existing row violates either index. Re-verify immediately before applying.
--
-- Both are partial indexes → NOT expressible in Prisma; they live only here (like
-- one_active_per_user / one_owner_per_doctor). `prisma db push` would drop them —
-- see database-architecture.md §6. Rollback to multi-helper = DROP both indexes
-- (zero data migration).

-- 1. At most one ACTIVE MEMBER (helper) per doctor. OWNER excluded (role='MEMBER');
--    REVOKED doesn't count (status='ACTIVE') → revoke→re-invite keeps working.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_active_member_per_doctor
    ON public.doctor_members(doctor_id)
    WHERE role = 'MEMBER' AND status = 'ACTIVE';

-- 2. (G3) At most one PENDING invite per doctor — hard backstop for the "1 slot"
--    rule against the TOCTOU race of two invite POSTs to different emails.
CREATE UNIQUE INDEX IF NOT EXISTS member_invites_one_pending_per_doctor
    ON public.member_invites(doctor_id)
    WHERE status = 'PENDING';
