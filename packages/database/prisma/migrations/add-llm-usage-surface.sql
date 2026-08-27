-- add-llm-usage-surface.sql
--
-- Agrega `surface` a `public.llm_token_usage`: DE QUÉ PANTALLA salió la llamada.
--
-- Por qué: `voice-transcribe` lo llaman ONCE pantallas distintas (notas, notas del
-- paciente, plantillas, consulta, receta, alta de paciente, pendientes, ventas/compras,
-- agenda v1, y los dos flujos de voz) y todas escribían el MISMO `endpoint`. La pregunta
-- "¿este doctor usa la voz en NOTAS o en PLANTILLAS?" no se podía contestar: 46 filas de
-- gerardo dicen `voice-transcribe` y nada más.
--
-- Aditiva y NULLABLE a propósito: las filas viejas quedan con NULL y se reportan como
-- "origen desconocido", que es la verdad. NO se puede deducir la pantalla hacia atrás.
--
-- ⚠️ `prisma db push` REVIERTE el composite FK de `bookings` y los índices parciales de
-- `doctor_members`. Esta migración se aplica con `prisma db execute`, nunca con db push.
-- Idempotente: se puede correr dos veces sin romper nada.

ALTER TABLE public.llm_token_usage
  ADD COLUMN IF NOT EXISTS surface VARCHAR(50);

COMMENT ON COLUMN public.llm_token_usage.surface IS
  'Pantalla que originó la llamada (para endpoints compartidos como voice-transcribe). NULL = anterior a 2026-08-27, origen irrecuperable.';

-- Para el groupBy del admin (doctor x endpoint x surface) sin escanear la tabla entera.
CREATE INDEX IF NOT EXISTS llm_token_usage_endpoint_surface_idx
  ON public.llm_token_usage (endpoint, surface);
