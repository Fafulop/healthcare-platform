-- TIERS 04 §12.6 #7 (versión corta) — «Quiero bajarme de plan».
-- docs/DESDE JUNIO/TIERS/04-PLAN-cambio-de-plan.md §12.6
--
-- Bajar de plan de verdad (prorrateo, baja agendada a fin de periodo, webhook,
-- «cancelar el cambio») es #7 COMPLETO y sigue sin construirse. Mientras tanto,
-- el doctor pide el cambio desde «Mi Cuenta», queda esta FILA, y un humano lo
-- hace a mano en el admin. Con 12 doctores, una bandeja es suficiente.
--
-- Por qué una fila y no sólo un mensaje de Telegram: `avisarAdmin()` no manda
-- nada mientras falte TELEGRAM_ADMIN_CHAT_ID, un mensaje se puede perder, y el
-- doctor necesita VER que su solicitud existe. Una fila no se pierde.
--
-- SEGURO: tabla NUEVA, nadie la lee todavía. Idempotente. Correr ANTES de
-- desplegar el código (database-architecture.md, «Production Deployment
-- Checklist»): el código la consulta en cuanto sube.

CREATE TABLE IF NOT EXISTS public.solicitudes_cambio_plan (
  id                TEXT PRIMARY KEY,
  doctor_id         TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,

  -- El plan que tenía al pedirlo: si el admin se lo cambia mientras tanto, la
  -- solicitud sigue diciendo de dónde venía.
  tier_actual       VARCHAR(20) NOT NULL,
  tier_solicitado   VARCHAR(20) NOT NULL,

  -- Resultado de `cabeEnPlan()` AL MOMENTO DE PEDIRLO (R4: sólo se baja si lo
  -- que usas cabe). Se guarda en vez de recalcularse para que el admin vea lo
  -- mismo que vio el doctor; puede haber archivado expedientes desde entonces.
  cabe              BOOLEAN NOT NULL,
  motivo_no_cabe    VARCHAR(400),

  -- PENDIENTE · HECHA · CANCELADA (la cancela el doctor) · RECHAZADA.
  estado            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

  solicitado_por    VARCHAR(200) NOT NULL,
  creado_en         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resuelta_en       TIMESTAMP(3),
  resuelta_por      VARCHAR(200),
  nota_admin        VARCHAR(400)
);

-- UNA sola solicitud PENDIENTE por doctor: si le da cinco veces al botón, no
-- salen cinco filas ni cinco avisos.
--
-- Es un índice PARCIAL y Prisma no sabe expresarlo, así que vive SÓLO aquí.
--
-- ¿Lo tira un `prisma db push`? NO, y conviene saber por qué en vez de copiar el
-- miedo: db push sólo pisa lo que Prisma SÍ modela. `tier_prices` está en la
-- lista negra de database-architecture.md §6 porque su modelo declara
-- `@@unique(tier)` y al sincronizar lo reescribe SIN el `WHERE activo`. Aquí no
-- se declara ningún unique sobre `doctor_id`, así que Prisma lo ignora y
-- sobrevive.
--
-- ⚠️ Lo que SÍ lo rompería: que alguien agregue `@@unique([doctorId])` al modelo
-- creyendo que documenta esta regla. Ese día el índice se reescribe sin el
-- `WHERE estado = 'PENDIENTE'`, y un doctor ya no podría pedir un segundo
-- cambio NUNCA, ni después de que el primero se atendiera.
--
-- Comprobarlo:
--   SELECT indexdef FROM pg_indexes WHERE indexname = 'solicitudes_cambio_plan_una_pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_cambio_plan_una_pendiente
  ON public.solicitudes_cambio_plan (doctor_id)
  WHERE estado = 'PENDIENTE';

-- La bandeja del admin ordena por fecha; el doctor lee la suya por doctor.
CREATE INDEX IF NOT EXISTS solicitudes_cambio_plan_estado_creado
  ON public.solicitudes_cambio_plan (estado, creado_en DESC);
