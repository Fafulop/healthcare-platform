-- Migration: Add email_verified column to users table
-- Purpose: Required by @auth/prisma-adapter v2 for NextAuth database strategy
-- Date: 2026-04-02

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP(3);
