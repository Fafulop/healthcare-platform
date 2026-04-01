-- Migration: Add session_version to users table
-- Purpose: Enables server-side session invalidation ("kill all sessions" feature)
-- Date: 2026-04-01

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
