-- Migration: VISITAS fase 1 — tabla `visitas` + `visita_id` en sus cinco hijos
-- Purpose: la visita agrupa lo que pasó en una visita (plantillas, fotos, notas,
--   recetas, informes) y se liga a su cita. Diseño y plan:
--   docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md
--   docs/DESDE JUNIO/VISITAS/02-PLAN-fase-1.md (§2)
-- Requires: PostgreSQL 15+ (ON DELETE SET NULL con lista de columnas). Prod = pg17.
-- Date: 2026-09-25
--
-- SÓLO AGREGA: una tabla nueva y columnas nullable. El código desplegado ignora lo que
-- no conoce, así que correr esto no cambia nada de lo que ya funciona.
-- Idempotente: se puede correr dos veces (IF NOT EXISTS + bloques DO $$).
--
-- ⚠️⚠️ `prisma db push` REVIERTE PARTE DE ESTA MIGRACIÓN ⚠️⚠️
-- Prisma no puede modelar:
--   · la FK COMPUESTA visitas(patient_id, doctor_id) → patients(id, doctor_id)
--   · la FK COMPUESTA visitas(booking_id, doctor_id) → bookings(id, doctor_id)
--     con `ON DELETE SET NULL (booking_id)`, y su índice destino bookings_id_doctor_id_key
--   · las FKs COMPUESTAS de los hijos (visita_id, patient_id) → visitas(id, patient_id)
--     con `ON DELETE SET NULL (visita_id)`, y su índice destino visitas_id_patient_id_key
-- `schema.prisma` declara las versiones de una sola columna; `db push` las pondría en su
-- lugar sin avisar, y RE-CORRER ESTE ARCHIVO NO LAS ARREGLA (los IF NOT EXISTS ven el nombre
-- y se saltan). Qué hacer si pasa: docs/NEW.MD-GUIDES/database-architecture.md, lista
-- "DB-only constraints".
--
-- Idempotencia: las comprobaciones van por NOMBRE + TABLA (conrelid), no sólo por nombre.
-- Después de correrlo DE VERDAD hay que verificar la DEFINICIÓN de cada constraint
-- (pg_get_constraintdef), no sólo que exista: un IF NOT EXISTS acepta en silencio una
-- versión con otra forma.
--
-- Pre-flight (read-only, ANTES de aplicar — deben dar 0 filas cada una):
--   SELECT m.id FROM medical_records.patient_media m
--     JOIN medical_records.clinical_encounters e ON e.id = m.encounter_id
--    WHERE e.patient_id <> m.patient_id;
--   (ídem prescriptions y medical_reports) — 2026-09-25: 0 / 0 / 0.

-- 0. No hacer cola detrás de nadie ---------------------------------------------------
-- ADD COLUMN toma ACCESS EXCLUSIVE sobre cinco tablas del expediente, y los ADD FOREIGN KEY
-- toman SHARE ROW EXCLUSIVE sobre bookings, patients y doctors. Sin límite, una transacción
-- larga abierta en cualquiera de ellas deja al ALTER esperando y a TODO prod en cola detrás.
-- Con esto, si no consigue el lock en 5 s, falla y se re-corre en otro momento.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- 1. La tabla ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medical_records.visitas (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL,
  doctor_id   TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  -- Día de la visita. RESPALDO: si la visita tiene cita, manda la fecha de la cita
  -- (DISEÑO §3). Existe porque borrar un slot borra sus citas (Booking.slot CASCADE) y la
  -- visita tiene que conservar su día. DATE, no timestamp: se formatea en UTC.
  fecha       DATE NOT NULL,
  comentario  TEXT,
  booking_id  TEXT,
  -- 'manual' (Nueva Visita) · 'cita' (al concluir) · 'backfill' (consultas previas).
  -- Deshacer el backfill = borrar origen='backfill' y nada más.
  origen      VARCHAR(20) NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT visitas_origen_check CHECK (origen IN ('manual', 'cita', 'backfill'))
);

-- Una cita tiene a lo sumo UNA visita: esto hace idempotente la visita automática.
-- ÚNICO COMPLETO, no parcial: Postgres no compara NULLs, así que muchas visitas sin cita
-- conviven igual. Y un índice PARCIAL rompería `prisma.visita.upsert({ where: { bookingId } })`:
-- Prisma lo corre como INSERT … ON CONFLICT (booking_id), que no empata con un índice parcial
-- (42P10). Así Prisma (`@unique`) y la BD dicen lo mismo.
CREATE UNIQUE INDEX IF NOT EXISTS visitas_booking_id_key
  ON medical_records.visitas(booking_id);

CREATE INDEX IF NOT EXISTS visitas_patient_id_fecha_idx
  ON medical_records.visitas(patient_id, fecha);
CREATE INDEX IF NOT EXISTS visitas_doctor_id_fecha_idx
  ON medical_records.visitas(doctor_id, fecha);

-- Destino de las FKs compuestas "mismo paciente" de los hijos. (id ya es PK, así que
-- (id, patient_id) es trivialmente único — el índice sólo existe para las FKs.)
CREATE UNIQUE INDEX IF NOT EXISTS visitas_id_patient_id_key
  ON medical_records.visitas(id, patient_id);

-- Destino de la FK compuesta visita→cita (§2). (id ya es PK de bookings, así que
-- (id, doctor_id) es trivialmente único — el índice sólo existe para la FK.)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_id_doctor_id_key
  ON public.bookings(id, doctor_id);

-- 2. FKs de la visita ------------------------------------------------------------------

DO $$
BEGIN
  -- Tenencia: una visita no puede colgar del paciente de OTRO doctor. Mismo patrón que
  -- bookings y medical_reports (reutiliza patients_id_doctor_id_key, que ya existe).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitas_patient_id_doctor_id_fkey'
                   AND conrelid = 'medical_records.visitas'::regclass) THEN
    ALTER TABLE medical_records.visitas
      ADD CONSTRAINT visitas_patient_id_doctor_id_fkey
      FOREIGN KEY (patient_id, doctor_id)
      REFERENCES medical_records.patients(id, doctor_id)
      ON DELETE CASCADE;
  END IF;

  -- La cita tiene que ser del MISMO doctor que la visita. Por doctor y no por paciente a
  -- propósito: el paciente de una cita se re-liga (ligar expediente), y una FK por paciente
  -- bloquearía ese UPDATE en bookings. Que la cita sea del mismo PACIENTE lo revisa el servidor.
  -- ON DELETE SET NULL (booking_id): borrar la cita (p. ej. por borrar su slot) deja viva la
  -- visita con su fecha; doctor_id intacto.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitas_booking_id_doctor_id_fkey'
                   AND conrelid = 'medical_records.visitas'::regclass) THEN
    ALTER TABLE medical_records.visitas
      ADD CONSTRAINT visitas_booking_id_doctor_id_fkey
      FOREIGN KEY (booking_id, doctor_id)
      REFERENCES public.bookings(id, doctor_id)
      ON DELETE SET NULL (booking_id);
  END IF;
END$$;

-- 3. visita_id en los cinco hijos --------------------------------------------------------
--
-- FK COMPUESTA (visita_id, patient_id) → visitas(id, patient_id): la BD impide ligar un
-- elemento a la visita de OTRO paciente, por cualquier camino presente o futuro (hueco #13).
-- MATCH SIMPLE: visita_id NULL → la fila pasa (lo suelto queda «Sin visita»).
-- ON DELETE SET NULL (visita_id): borrar una visita suelta a sus hijos; patient_id intacto.

ALTER TABLE medical_records.clinical_encounters ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.patient_media       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.prescriptions       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.patient_notes       ADD COLUMN IF NOT EXISTS visita_id TEXT;
ALTER TABLE medical_records.medical_reports     ADD COLUMN IF NOT EXISTS visita_id TEXT;

CREATE INDEX IF NOT EXISTS clinical_encounters_visita_id_idx ON medical_records.clinical_encounters(visita_id);
CREATE INDEX IF NOT EXISTS patient_media_visita_id_idx       ON medical_records.patient_media(visita_id);
CREATE INDEX IF NOT EXISTS prescriptions_visita_id_idx       ON medical_records.prescriptions(visita_id);
CREATE INDEX IF NOT EXISTS patient_notes_visita_id_idx       ON medical_records.patient_notes(visita_id);
CREATE INDEX IF NOT EXISTS medical_reports_visita_id_idx     ON medical_records.medical_reports(visita_id);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_encounters', 'patient_media', 'prescriptions', 'patient_notes', 'medical_reports']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_visita_id_patient_id_fkey'
                     AND conrelid = format('medical_records.%I', t)::regclass) THEN
      EXECUTE format(
        'ALTER TABLE medical_records.%I
           ADD CONSTRAINT %I
           FOREIGN KEY (visita_id, patient_id)
           REFERENCES medical_records.visitas(id, patient_id)
           ON DELETE SET NULL (visita_id)',
        t, t || '_visita_id_patient_id_fkey');
    END IF;
  END LOOP;
END$$;
