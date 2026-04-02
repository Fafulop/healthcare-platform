-- Migration: Add NextAuth database session tables
-- Purpose: Switch from JWT strategy to database sessions for multi-device session management
-- Date: 2026-04-02

CREATE TABLE IF NOT EXISTS public.accounts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id),
  CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id            TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id       TEXT NOT NULL,
  expires       TIMESTAMP(3) NOT NULL,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires    TIMESTAMP(3) NOT NULL,
  CONSTRAINT verification_tokens_identifier_token_key UNIQUE (identifier, token)
);
