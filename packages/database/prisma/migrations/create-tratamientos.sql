-- Migration: VISITAS fase 2 (T1) — tablas `tratamientos` y `tratamiento_sesiones`
-- Purpose: un tratamiento es un plan de varias visitas para un paciente; cada sesión apunta a su
--   cita (la agenda es dueña de fecha y cobro) y, sin cita, a su visita. El ESTADO de una sesión
--   NO se guarda: se deriva de su cita/visita (decisión P1); sólo `cancelada` es del doctor.
--   Diseño y plan:
--   docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md
--   docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md (§2)
-- Requires: PostgreSQL 15+ (ON DELETE SET NULL con lista de columnas). Prod = pg17.
-- Date: 2026-09-29
--
-- SÓLO CREA dos tablas nuevas: no altera ninguna tabla existente (ningún ADD COLUMN ni lock
-- ACCESS EXCLUSIVE sobre tablas vivas). El código desplegado no las conoce, así que correr esto
-- no cambia nada de lo que ya funciona.
-- Idempotente: se puede correr dos veces (IF NOT EXISTS + bloques DO $$ que miran NOMBRE y TABLA).
--
-- ⚠️⚠️ `prisma db push` REVIERTE PARTE DE ESTA MIGRACIÓN ⚠️⚠️
-- Prisma no puede modelar:
--   · tratamientos(patient_id, doctor_id) → patients(id, doctor_id)
--   · tratamiento_sesiones(tratamiento_id, patient_id) → tratamientos(id, patient_id)
--   · tratamiento_sesiones(booking_id, doctor_id) → bookings(id, doctor_id) ON DELETE SET NULL (booking_id)
--   · tratamiento_sesiones(visita_id, patient_id) → visitas(id, patient_id) ON DELETE SET NULL (visita_id)
-- `schema.prisma` declara las versiones de una sola columna; `db push` las pondría en su lugar sin
-- avisar, y re-correr este archivo NO las arregla. Qué hacer: docs/NEW.MD-GUIDES/
-- database-architecture.md, lista "DB-only constraints".
--
-- Después de correrlo DE VERDAD: verificar la DEFINICIÓN de cada constraint
-- (pg_get_constraintdef), no sólo que exista.

-- 0. No hacer cola detrás de nadie --------------------------------------------------------
-- Los ADD FOREIGN KEY toman SHARE ROW EXCLUSIVE sobre patients, bookings, visitas,
-- encounter_templates y doctors. Si no consigue el lock en 5 s, falla y se re-corre después.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Todos los locks que van a hacer falta, AL PRINCIPIO y en orden fijo (code review de T1): tomarlos
-- de uno en uno, a medio script, dejaba el script con unos ya tomados esperando otros — y podía
-- trabarse (deadlock) con una petición de la app que concluye una cita (escribe visitas y luego
-- bookings). SHARE ROW EXCLUSIVE es justo lo que pide ADD FOREIGN KEY: bloquea ESCRITURAS a esas
-- tablas mientras dura la transacción (lecturas no). Requiere correr dentro de una transacción.
LOCK TABLE public.doctors, medical_records.patients, medical_records.encounter_templates,
           public.bookings, medical_records.visitas IN SHARE ROW EXCLUSIVE MODE;

-- 1. tratamientos ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medical_records.tratamientos (
  id                     TEXT PRIMARY KEY,
  patient_id             TEXT NOT NULL,
  doctor_id              TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  nombre                 TEXT NOT NULL,
  -- NULL = abierto (sin número fijo de sesiones). Editarlo NO crea ni borra sesiones (G7).
  sesiones_planeadas     INTEGER,
  -- Sugerencia para agendar las sesiones (T5). No obliga a nada.
  intervalo_dias         INTEGER,
  -- Lo ACORDADO por el tratamiento completo (DISEÑO §5). Sin usar hasta T6 (P4); la API no lo
  -- devuelve hasta entonces, y después sólo con el permiso `flujo` (G5).
  precio_paquete         NUMERIC(12,2),
  estado                 VARCHAR(20) NOT NULL DEFAULT 'activo',
  plantilla_sugerida_id  TEXT,
  notas                  TEXT,
  created_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tratamientos_estado_check CHECK (estado IN ('activo', 'terminado', 'cancelado')),
  CONSTRAINT tratamientos_sesiones_planeadas_check CHECK (sesiones_planeadas IS NULL OR sesiones_planeadas > 0),
  CONSTRAINT tratamientos_intervalo_dias_check CHECK (intervalo_dias IS NULL OR intervalo_dias > 0),
  CONSTRAINT tratamientos_precio_paquete_check CHECK (precio_paquete IS NULL OR precio_paquete >= 0)
);

CREATE INDEX IF NOT EXISTS tratamientos_patient_id_estado_idx
  ON medical_records.tratamientos(patient_id, estado);
CREATE INDEX IF NOT EXISTS tratamientos_doctor_id_estado_idx
  ON medical_records.tratamientos(doctor_id, estado);

-- Destino de la FK compuesta "mismo paciente" de las sesiones. (id ya es PK, así que
-- (id, patient_id) es trivialmente único — el índice sólo existe para la FK.)
CREATE UNIQUE INDEX IF NOT EXISTS tratamientos_id_patient_id_key
  ON medical_records.tratamientos(id, patient_id);

-- Destino de la FK de tenencia que T6 pondrá en ledger_entries(tratamiento_id, doctor_id)
-- (code review de T1): crearlo ahora, con la tabla vacía, evita un CREATE INDEX sobre una tabla
-- viva en el paso más riesgoso (el dinero). `LedgerEntry.patientId` es opcional, así que
-- (id, patient_id) no sirve para esa FK.
CREATE UNIQUE INDEX IF NOT EXISTS tratamientos_id_doctor_id_key
  ON medical_records.tratamientos(id, doctor_id);

-- La FK a encounter_templates es ON DELETE SET NULL: sin índice, cada vez que un doctor borra una
-- plantilla Postgres recorre TODOS los tratamientos buscando cuáles anular (code review de T1).
CREATE INDEX IF NOT EXISTS tratamientos_plantilla_sugerida_id_idx
  ON medical_records.tratamientos(plantilla_sugerida_id);

-- 2. tratamiento_sesiones -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medical_records.tratamiento_sesiones (
  id              TEXT PRIMARY KEY,
  tratamiento_id  TEXT NOT NULL,
  -- patient_id y doctor_id son REDUNDANTES a propósito: son lo que permite que la BD exija que
  -- el tratamiento, la cita y la visita de una sesión sean del mismo paciente/doctor (FKs abajo).
  patient_id      TEXT NOT NULL,
  doctor_id       TEXT NOT NULL,
  numero          INTEGER NOT NULL,
  -- P1: lo ÚNICO de estado que se guarda (decisión del doctor). Por agendar / agendada / hecha se
  -- DERIVAN de la cita y la visita al leer (`estadoDeSesion()`), así nunca quedan viejos.
  cancelada       BOOLEAN NOT NULL DEFAULT false,
  booking_id      TEXT,
  -- P2 (revisado en el code review de T1): la sesión guarda su visita SIEMPRE que la conoce —
  -- también si tiene cita (syncVisitaForBooking la escribe al nacer la visita de la cita). Así, si
  -- la cita se borra o pasa a otro paciente, la sesión no pierde la visita que sí ocurrió.
  visita_id       TEXT,
  notas           TEXT,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tratamiento_sesiones_numero_check CHECK (numero > 0)
);

-- P3: número fijo por tratamiento (agregar = siguiente; borrar deja el hueco).
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_tratamiento_id_numero_key
  ON medical_records.tratamiento_sesiones(tratamiento_id, numero);

-- Una cita / una visita pertenece a lo sumo a UNA sesión. ÚNICOS COMPLETOS, no parciales: un
-- índice parcial rompe el upsert de Prisma (ON CONFLICT → 42P10; lección de visitas). Postgres no
-- compara NULLs, así que muchas sesiones sin cita / sin visita conviven.
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_booking_id_key
  ON medical_records.tratamiento_sesiones(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS tratamiento_sesiones_visita_id_key
  ON medical_records.tratamiento_sesiones(visita_id);

CREATE INDEX IF NOT EXISTS tratamiento_sesiones_patient_id_idx
  ON medical_records.tratamiento_sesiones(patient_id);

-- 3. FKs -------------------------------------------------------------------------------------

DO $$
BEGIN
  -- Tenencia: un tratamiento no puede colgar del paciente de OTRO doctor (reutiliza
  -- patients_id_doctor_id_key, que ya existe; mismo patrón que visitas y bookings).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamientos_patient_id_doctor_id_fkey'
                   AND conrelid = 'medical_records.tratamientos'::regclass) THEN
    ALTER TABLE medical_records.tratamientos
      ADD CONSTRAINT tratamientos_patient_id_doctor_id_fkey
      FOREIGN KEY (patient_id, doctor_id)
      REFERENCES medical_records.patients(id, doctor_id)
      ON DELETE CASCADE;
  END IF;

  -- Borrar una plantilla no borra el tratamiento. (Que sea del mismo doctor lo revisa el servidor.)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamientos_plantilla_sugerida_id_fkey'
                   AND conrelid = 'medical_records.tratamientos'::regclass) THEN
    ALTER TABLE medical_records.tratamientos
      ADD CONSTRAINT tratamientos_plantilla_sugerida_id_fkey
      FOREIGN KEY (plantilla_sugerida_id)
      REFERENCES medical_records.encounter_templates(id)
      ON DELETE SET NULL;
  END IF;

  -- Tenencia de la sesión: su (patient_id, doctor_id) es un paciente real de ESE doctor. Sin esto,
  -- el doctor_id redundante podría no coincidir con el del paciente y la FK de la cita (abajo)
  -- aceptaría citas de otro doctor.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamiento_sesiones_patient_id_doctor_id_fkey'
                   AND conrelid = 'medical_records.tratamiento_sesiones'::regclass) THEN
    ALTER TABLE medical_records.tratamiento_sesiones
      ADD CONSTRAINT tratamiento_sesiones_patient_id_doctor_id_fkey
      FOREIGN KEY (patient_id, doctor_id)
      REFERENCES medical_records.patients(id, doctor_id)
      ON DELETE CASCADE;
  END IF;

  -- Una sesión no puede colgar del tratamiento de OTRO paciente. Borrar el tratamiento borra sus
  -- sesiones (no sus citas ni sus visitas: esas FKs van desde la sesión).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamiento_sesiones_tratamiento_id_patient_id_fkey'
                   AND conrelid = 'medical_records.tratamiento_sesiones'::regclass) THEN
    ALTER TABLE medical_records.tratamiento_sesiones
      ADD CONSTRAINT tratamiento_sesiones_tratamiento_id_patient_id_fkey
      FOREIGN KEY (tratamiento_id, patient_id)
      REFERENCES medical_records.tratamientos(id, patient_id)
      ON DELETE CASCADE;
  END IF;

  -- La cita es del MISMO doctor. Por doctor y no por paciente a propósito: el paciente de una
  -- cita se re-liga, y una FK por paciente bloquearía ese UPDATE (misma razón que en visitas).
  -- Que sea del mismo PACIENTE lo revisa el servidor (y G1 suelta la cita al re-ligarla).
  -- Borrar la cita (p. ej. borrar su slot) deja la sesión «por agendar».
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamiento_sesiones_booking_id_doctor_id_fkey'
                   AND conrelid = 'medical_records.tratamiento_sesiones'::regclass) THEN
    ALTER TABLE medical_records.tratamiento_sesiones
      ADD CONSTRAINT tratamiento_sesiones_booking_id_doctor_id_fkey
      FOREIGN KEY (booking_id, doctor_id)
      REFERENCES public.bookings(id, doctor_id)
      ON DELETE SET NULL (booking_id);
  END IF;

  -- La visita es del MISMO paciente (destino visitas_id_patient_id_key, ya existe).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tratamiento_sesiones_visita_id_patient_id_fkey'
                   AND conrelid = 'medical_records.tratamiento_sesiones'::regclass) THEN
    ALTER TABLE medical_records.tratamiento_sesiones
      ADD CONSTRAINT tratamiento_sesiones_visita_id_patient_id_fkey
      FOREIGN KEY (visita_id, patient_id)
      REFERENCES medical_records.visitas(id, patient_id)
      ON DELETE SET NULL (visita_id);
  END IF;
END$$;
