-- TIERS (planes del producto) — PR T1.
-- Agrega Doctor.tier: techo de funciones por CUENTA (owner Y member).
-- docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md §3.1
--
-- SEGURO: columna aditiva con DEFAULT constante ⇒ en PostgreSQL 11+ NO reescribe
-- la tabla ni toma lock largo (default se materializa lazy). Cero impacto en la
-- conducta: nada lee `tier` hasta el enforcement (PR T2). Todo doctor existente
-- queda 'FULL'. Idempotente (IF NOT EXISTS) para poder re-correr sin error.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'FULL';
