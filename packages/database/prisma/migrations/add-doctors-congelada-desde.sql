-- TIERS 04 §12.6 #6.2 — congelar la cuenta de quien dejó de pagar y no cabe en GRATIS.
-- docs/DESDE JUNIO/TIERS/04-PLAN-cambio-de-plan.md §11
--
-- `congelada_desde` NULL = cuenta normal. Con fecha = congelada: sólo entra a
-- «Mi Cuenta» y al cobro; lo demás responde ACCOUNT_FROZEN. La pone el cron
-- `cobro-vencido`; la quitan un pago (webhook) o un cambio de plan del admin.
--
-- SEGURO: una columna NUEVA, nullable, sin relleno (hoy nadie está congelado).
-- Idempotente. Correr ANTES de desplegar el código (database-architecture.md,
-- «Production Deployment Checklist»).

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS congelada_desde TIMESTAMP(3);
