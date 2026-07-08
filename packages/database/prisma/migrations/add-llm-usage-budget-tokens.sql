-- Migration: Add budget_tokens to llm_token_usage
-- Purpose: cost-weighted token count for the agenda-agent daily cap.
--   Prompt caching (2026-07-07) broke the volume≈cost equivalence the cap was
--   sized with (a cached read bills at ~0.1×), so the cap now aggregates this
--   dedicated column (uncached ×1 · cache read ×0.1 · cache write ×1.25 ·
--   output ×5 — each class's price ratio to base input). total_tokens stays
--   raw volume: three analytics endpoints aggregate it across ALL endpoints
--   and must keep uniform units (llm-usage, llm-usage/my, feature-usage).
-- Nullable on purpose: rows from other endpoints (and history) don't have a
--   cache split, so they simply don't participate in the budget aggregate.
-- Date: 2026-07-08

ALTER TABLE public.llm_token_usage
  ADD COLUMN IF NOT EXISTS budget_tokens INTEGER;
