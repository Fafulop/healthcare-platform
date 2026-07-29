-- Nombre y apellidos POR SEPARADO en la cita.
--
-- El problema que resuelve:
--   `bookings.patient_name` es UN solo campo, así que al crear el expediente desde una cita
--   (CreatePatientFromBookingModal) había que ADIVINAR dónde termina el nombre y empiezan los
--   apellidos. El código partía en el PRIMER espacio: "Juan Carlos García López" quedaba como
--   firstName "Juan" / lastName "Carlos García López".
--   Medido contra las citas ya vinculadas cuyo nombre coincide con el del expediente, ese split
--   acierta 23 de 26 (2026-07-29). No es catastrófico, pero es una adivinanza evitable: el
--   doctor YA sabe cuál es cuál al agendar — solo no teníamos dónde guardarlo.
--
-- Por qué DOS columnas nuevas y no partir `patient_name`:
--   · `patient_name` lo consume TODO (correos, agente, widget público, fila de la tabla, link de
--     pago). Se sigue escribiendo igual —la concatenación— para que nada de eso cambie.
--   · Estas dos son el dato FINO, solo para nacer el expediente sin adivinar.
--
-- NULLABLE a propósito — migración puramente aditiva, no reescribe la tabla:
--   · Las 366 citas existentes quedan en NULL y el modal cae al split de siempre ⇒ CERO cambio
--     de comportamiento para lo que ya está vivo.
--   · Las citas del widget público y las que crea el AGENTE mandan solo `patient_name`: también
--     quedan en NULL y también caen al split. No requieren cambio.
--   · Solo las citas nuevas creadas desde el modal del doctor traen el split exacto.
--
-- TEXT y no VARCHAR(n): las demás columnas patient_* de esta tabla son `text`.
--
-- ⚠️ La BD va ANTES que el código: el GET de citas usa `include`, así que Prisma seleccionaría
-- una columna inexistente y tumbaría la página de citas.
--
-- Aplicar contra PROD con la URL PÚBLICA (LLM_DATABASE_URL de packages/database/.env):
--   pnpm --filter @healthcare/database exec prisma db execute \
--     --file prisma/migrations/add-booking-patient-name-split.sql --url "<LLM_DATABASE_URL>"
--   (`--schema prisma/schema.prisma` apunta a DATABASE_URL, que en esta máquina es LOCALHOST.)
-- NUNCA con `prisma db push` — revierte el FK compuesto de bookings y los índices parciales de
-- doctor_members que viven en prod (database-architecture.md §6).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS patient_first_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_last_name  TEXT;

COMMENT ON COLUMN public.bookings.patient_first_name IS
  'Nombre(s) tal como los capturó el doctor al agendar. NULL en citas viejas, del widget público y del agente — ahí se cae al split de patient_name. patient_name sigue siendo la fuente para mostrar y enviar.';

COMMENT ON COLUMN public.bookings.patient_last_name IS
  'Apellidos tal como los capturó el doctor al agendar. NULL = mismo fallback que patient_first_name. Existe para crear el expediente sin adivinar dónde parte el nombre completo.';
