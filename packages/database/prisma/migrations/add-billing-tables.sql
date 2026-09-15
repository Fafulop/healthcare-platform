-- TIERS C2 — las tres tablas del cobro de la suscripción.
-- docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.2
--
-- 🔴 DIRECCIÓN DEL DINERO: esto es lo que el DOCTOR NOS PAGA A NOSOTROS. Todo
-- lo demás que dice "stripe"/"mp" en este schema (doctors.stripe_account_id,
-- payment_links, mp_payment_preferences) es la dirección contraria — el doctor
-- cobrándole a sus pacientes. No se mezclan.
--
-- SEGURO: tres tablas NUEVAS, nadie las lee todavía. Idempotente (IF NOT
-- EXISTS), se puede re-correr.
--
-- ⚠️ `prisma db push` BORRA estas tablas y, muy en particular, revierte el
-- índice único PARCIAL de tier_prices (Prisma no modela el WHERE). Ver
-- database-architecture.md §6.

-- ── 1. El mapa tier ↔ precio de Stripe ──────────────────────────────────────
-- Sin monto a propósito: el Price de Stripe es la fuente de verdad del dinero,
-- así que cambiar un precio no necesita deploy.
CREATE TABLE IF NOT EXISTS public.tier_prices (
    id               TEXT PRIMARY KEY,
    tier             VARCHAR(20)  NOT NULL,
    stripe_price_id  VARCHAR(120) NOT NULL,
    activo           BOOLEAN      NOT NULL DEFAULT true,
    nota_interna     VARCHAR(300),
    created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS tier_prices_stripe_price_id_key
    ON public.tier_prices(stripe_price_id);

CREATE INDEX IF NOT EXISTS tier_prices_tier_idx
    ON public.tier_prices(tier);

-- 🔴 UNA sola fila ACTIVA por tier. Sin esto, dos precios activos para PRO
-- hacen que "cuánto cuesta PRO" deje de tener una respuesta cierta, y el
-- checkout de C3 elegiría uno de los dos sin criterio. Es PARCIAL (`WHERE
-- activo`) para poder conservar el historial de precios viejos desactivados.
CREATE UNIQUE INDEX IF NOT EXISTS tier_prices_un_activo_por_tier
    ON public.tier_prices(tier) WHERE activo;

-- ── 2. El estado de cobro por cuenta ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                      TEXT PRIMARY KEY,
    doctor_id               TEXT NOT NULL,
    -- A quién le cobramos. NO es doctors.stripe_account_id (esa es la cuenta
    -- Connect a la que le PAGAMOS por lo que cobró a sus pacientes).
    stripe_customer_id      VARCHAR(120),
    stripe_subscription_id  VARCHAR(120),
    stripe_price_id         VARCHAR(120),
    -- El status tal cual lo manda Stripe. 'none' es NUESTRO: nunca hubo
    -- suscripción. No se traduce al español: el webhook de C3 lo copia.
    status                  VARCHAR(30)  NOT NULL DEFAULT 'none',
    current_period_end      TIMESTAMP(3),
    cancel_at_period_end    BOOLEAN      NOT NULL DEFAULT false,
    last_payment_at         TIMESTAMP(3),
    created_at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT subscriptions_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

-- Una suscripción por doctor.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_doctor_id_key
    ON public.subscriptions(doctor_id);

-- Los tres ids de Stripe son únicos: un customer/subscription no puede
-- pertenecer a dos cuentas nuestras, y el webhook de C3 busca por ellos.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_key
    ON public.subscriptions(stripe_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
    ON public.subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
    ON public.subscriptions(status);

-- ── 3. El rastro de cada cambio de tier ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tier_change_log (
    id               TEXT PRIMARY KEY,
    doctor_id        TEXT NOT NULL,
    from_tier        VARCHAR(20)  NOT NULL,
    to_tier          VARCHAR(20)  NOT NULL,
    origen           VARCHAR(20)  NOT NULL,
    actor            VARCHAR(200) NOT NULL,
    stripe_event_id  VARCHAR(120),
    motivo           VARCHAR(300),
    created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tier_change_log_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

-- 🔴 La llave de IDEMPOTENCIA del webhook de C3: Stripe REINTENTA sus eventos,
-- así que el mismo evt_ puede llegar dos veces y no debe mover el tier dos
-- veces ni dejar dos filas. Los NULL de Postgres no chocan entre sí, así que
-- los cambios manuales (sin evento) conviven sin problema.
CREATE UNIQUE INDEX IF NOT EXISTS tier_change_log_stripe_event_id_key
    ON public.tier_change_log(stripe_event_id);

CREATE INDEX IF NOT EXISTS tier_change_log_doctor_id_idx
    ON public.tier_change_log(doctor_id);

-- Verificación (solo lectura):
--   SELECT count(*) FROM public.tier_prices;       -- 0
--   SELECT count(*) FROM public.subscriptions;     -- 0
--   SELECT count(*) FROM public.tier_change_log;   -- 0
--   SELECT indexname FROM pg_indexes
--    WHERE tablename IN ('tier_prices','subscriptions','tier_change_log')
--    ORDER BY tablename, indexname;
--   -- tier_prices debe traer tier_prices_un_activo_por_tier (el PARCIAL)
