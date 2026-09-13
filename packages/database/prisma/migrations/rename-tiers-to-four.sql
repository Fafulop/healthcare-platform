-- TIERS — Q1 del plan de cuatro tiers (docs/DESDE JUNIO/TIERS/02-PLAN-cuatro-tiers.md §3.3).
-- El vocabulario pasa de FULL/CORE a FREE/BASICO/PRO/LAB.
--
-- ORDEN: correr DESPUÉS de desplegar el código que conoce los cuatro nombres, y
-- DESPUÉS de verificar el commitHash de api · doctor · admin (un servicio
-- rezagado con el código viejo sigue escribiendo 'FULL' en las altas — el
-- cliente Prisma lleva el @default dentro — y ese valor cae al fail-open PRO,
-- no a FREE). Es seguro en cualquier orden porque tierAllows hace fail-open en
-- ambos sentidos (código viejo + 'PRO' ⇒ se comporta como FULL; código nuevo +
-- 'FULL' ⇒ se comporta como PRO), pero en la ventana el admin pinta los chips
-- en rojo ("valor no reconocido"). Código primero acorta esa ventana a minutos.
--
-- Pre-flight medido 2026-09-12: 12 filas, todas 'FULL'; ninguna 'CORE'; sin
-- CHECK constraints sobre doctors. Idempotente: re-correrlo no cambia nada.

-- 1. Toda cuenta existente conserva lo que tenía: FULL ⇒ PRO (PRO no excluye nada).
UPDATE public.doctors SET tier = 'PRO' WHERE tier = 'FULL';

-- 2. Un CORE (v1: sin factura/SAT/conciliación) ⇒ FREE, la forma equivalente.
--    Hoy no hay ninguno; está para que un downgrade hecho en la ventana no
--    quede como valor desconocido — que el nuevo tierAllows resolvería a PRO,
--    es decir, ASCENDERÍA en silencio a una cuenta bajada a propósito.
UPDATE public.doctors SET tier = 'FREE' WHERE tier = 'CORE';

-- 3. Default de columna = FREE, igual que el @default del schema. Para las
--    altas vía Prisma NO es lo que decide (el cliente manda el valor explícito,
--    ver DEFAULT_TIER en permissions.ts); cubre inserts crudos y coherencia.
ALTER TABLE public.doctors ALTER COLUMN tier SET DEFAULT 'FREE';

-- VERIFICACIÓN (solo lectura) — la segunda es una ASERCIÓN: debe dar 0.
-- Repetirla después de confirmar el commitHash de CADA servicio.
--   SELECT tier, count(*) FROM public.doctors GROUP BY 1;                    -- PRO 12
--   SELECT count(*) FROM public.doctors
--    WHERE tier NOT IN ('FREE','BASICO','PRO','LAB');                        -- 0
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='doctors' AND column_name='tier';  -- 'FREE'::text
