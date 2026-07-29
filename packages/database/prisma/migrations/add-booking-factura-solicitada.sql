-- ¿Esta cita necesita factura? Casilla por CITA en la tabla "Todas las Citas".
--
-- Por qué una columna nueva y no reusar Patient.requiereFactura:
--   · requiereFactura es del PACIENTE y lo ESCRIBE el formulario fiscal al recibirse
--     (apps/api/src/app/api/fiscal-form/route.ts) — significa "ya entregó sus datos".
--   · Esto es la INTENCIÓN por cita: el mismo paciente puede necesitar factura en una
--     consulta y no en la siguiente. Son dos hechos distintos; reusar el campo mezclaría
--     "pidió factura esta vez" con "tiene datos fiscales en el expediente".
--
-- NULLABLE a propósito: la migración es puramente aditiva y no reescribe la tabla.
-- Las 359 citas existentes quedan en NULL, que la UI trata como DESMARCADA — o sea que
-- ninguna fila cambia de comportamiento al aplicar esto.
--
-- Aplicar con:
--   pnpm --filter @healthcare/database exec prisma db execute \
--     --file prisma/migrations/add-booking-factura-solicitada.sql --schema prisma/schema.prisma
-- NUNCA con `prisma db push` — revierte el FK compuesto de bookings y los índices
-- parciales de doctor_members que viven en prod (database-architecture.md §6).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS factura_solicitada BOOLEAN;

COMMENT ON COLUMN public.bookings.factura_solicitada IS
  'Intención POR CITA: el doctor marcó que esta consulta necesita factura. NULL/false = no. Distinto de patients.requiere_factura, que indica que el paciente ya entregó sus datos fiscales.';
