-- TIERS 04 §12.6 #6.1 — hasta cuándo está PAGADA de verdad una suscripción.
-- docs/DESDE JUNIO/TIERS/04-PLAN-cambio-de-plan.md §11 y §12.2 (B2a)
--
-- Por qué una columna nueva y no `current_period_end`: cuando una renovación
-- FALLA, Stripe igual avanza el periodo un mes, así que `current_period_end`
-- diría "cubierto hasta el mes que entra" sin que nadie haya pagado. Ésta la
-- escribe SÓLO el webhook con `invoice.paid`; si no hay pago, no se mueve. De
-- aquí sale el margen de 15 días antes de pasar a GRATIS o congelar.
--
-- SEGURO: una columna NUEVA, nullable, que nadie lee todavía. Idempotente
-- (IF NOT EXISTS + el UPDATE sólo toca filas con la columna en NULL), se puede
-- re-correr. Correr ANTES de desplegar el código (database-architecture.md,
-- «Production Deployment Checklist»).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pagado_hasta TIMESTAMP(3);

-- Relleno de las suscripciones que YA existen: una `active` con un pago
-- registrado está pagada hasta el fin de su periodo actual (no hay renovación
-- fallida en curso: estaría en `past_due`). El 2026-09-18 son dos, ambas de
-- modo prueba: dr-prueba (17/10) y dr-quebradita (18/10).
UPDATE public.subscriptions
   SET pagado_hasta = current_period_end
 WHERE pagado_hasta IS NULL
   AND status = 'active'
   AND last_payment_at IS NOT NULL
   AND current_period_end IS NOT NULL;
