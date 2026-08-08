-- INFORME MÉDICO — el doctor llena el formato de una aseguradora desde el expediente
-- y lo entrega en PDF (descarga o link al paciente).
--
-- Diseño: docs/DESDE JUNIO/INFORME MEDICO/  (02-PLAN §4 tablas · 03-FORMATOS procedencia
-- · 04-MAPEO qué llena qué). Tablas ADITIVAS: no tocan nada existente salvo dos
-- columnas NULLABLE en patients (ADD COLUMN nullable es instantáneo en PG, no reescribe).
--
-- Patrón del repo: SQL manual + `prisma db execute`, NUNCA `prisma db push` (revierte el
-- composite FK de bookings y los índices parciales de doctor_members que viven en prod).
--
-- Pre-vuelo read-only contra prod (2026-08-08): ninguna de las dos tablas existía, las dos
-- columnas de póliza no existían, y las PK de patients/clinical_encounters/doctors son TEXT
-- (por eso las FK son TEXT).

-- ---------------------------------------------------------------------------
-- 1. Catálogo de formatos, a nivel PLATAFORMA (no por doctor).
--    Los formatos oficiales son iguales para todos: si se copiaran por doctor,
--    arreglar un mapeo habría que arreglarlo N veces (03-FORMATOS §5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_records.insurance_forms (
  id                 TEXT PRIMARY KEY,
  insurer            VARCHAR(100) NOT NULL,          -- 'AXA' · 'GNP' · 'Allianz'
  name               VARCHAR(200) NOT NULL,          -- 'Informe Médico GMM'
  -- VERSIÓN: un informe ya emitido debe poder re-generarse con el mapeo viejo
  -- cuando la aseguradora cambie su hoja. AXA la imprime: 'AI-346 FEBRERO 2022'.
  version            VARCHAR(80) NOT NULL,

  -- Procedencia: el PDF base se baja del dominio de la ASEGURADORA, nunca de un
  -- intermediario. Sin esto, en un año nadie sabe si el que está guardado es el vigente.
  source_url         TEXT,
  fetched_at         TIMESTAMP(3),

  pdf_url            TEXT NOT NULL,                  -- el PDF base almacenado

  -- Diccionario campoCanónico -> nombre del campo AcroForm en ESE PDF.
  -- Agregar una aseguradora = escribir este JSON, no tocar código (04-MAPEO §1).
  field_dict         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- TRUE cuando los campos rellenables los pusimos NOSOTROS sobre un PDF plano
  -- (caso Allianz). Ese archivo ya no es el oficial byte a byte y hay que saberlo.
  fields_added_by_us BOOLEAN NOT NULL DEFAULT FALSE,

  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT insurance_forms_insurer_name_version_key UNIQUE (insurer, name, version)
);

CREATE INDEX IF NOT EXISTS insurance_forms_insurer_is_active_idx
  ON medical_records.insurance_forms(insurer, is_active);

-- Sólo UNA versión VIGENTE por (aseguradora, formato). Sin esto el dropdown puede
-- ofrecer la hoja vigente y la superseded al mismo tiempo, y elegir la vieja es
-- exactamente el rechazo que 03-FORMATOS existe para evitar.
-- (Índice parcial: Prisma no lo sabe expresar ⇒ `db push` lo revierte.)
CREATE UNIQUE INDEX IF NOT EXISTS insurance_forms_insurer_name_active_key
  ON medical_records.insurance_forms(insurer, name)
  WHERE is_active;

-- ---------------------------------------------------------------------------
-- 2. El informe de UN paciente contra UN formato.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_records.medical_reports (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,

  -- ⚠️ patient_id NO lleva FK propia: abajo va la COMPUESTA (patient_id, doctor_id)
  -- para que la BD impida que un informe apunte al paciente de OTRO doctor.
  patient_id    TEXT NOT NULL,

  -- De cuál consulta salió. La FK se declara ABAJO porque necesita ser DEFERRABLE.
  encounter_id  TEXT,

  -- RESTRICT a propósito: un formato con informes emitidos no se borra.
  form_id       TEXT NOT NULL REFERENCES medical_records.insurance_forms(id) ON DELETE RESTRICT,

  -- Las respuestas CON SU PROCEDENCIA, no valores sueltos:
  --   { "paciente.edad": { "value": "47", "source": "patient.dateOfBirth",
  --                        "origin": "deterministic" } }
  -- origin ∈ deterministic | llm | voice | manual | empty.
  -- 'empty' es un estado EXPLÍCITO: un hueco por falta de dato y uno que el doctor
  -- borró a propósito no son lo mismo (01-FUENTES §4).
  answers       JSONB NOT NULL DEFAULT '{}'::jsonb,

  status        VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | issued

  -- Mandar datos clínicos a una aseguradora es transferencia a un TERCERO bajo la
  -- LFPDPPP: el informe registra la autorización del paciente (01-FUENTES §7).
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at    TIMESTAMP(3),

  issued_at     TIMESTAMP(3),
  created_by    TEXT NOT NULL,                          -- userId que lo creó
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TENANCY a nivel BD: el paciente del informe TIENE que ser de ese doctor.
-- Mismo patrón que `bookings_patient_id_doctor_id_fkey`; se apoya en el índice único
-- `patients_id_doctor_id_key` que ya vive en prod.
-- ⚠️ Prisma no modela FKs compuestas ⇒ `prisma db push` la REVIERTE (igual que la de bookings).
ALTER TABLE medical_records.medical_reports
  DROP CONSTRAINT IF EXISTS medical_reports_patient_id_doctor_id_fkey;
ALTER TABLE medical_records.medical_reports
  ADD CONSTRAINT medical_reports_patient_id_doctor_id_fkey
  FOREIGN KEY (patient_id, doctor_id)
  REFERENCES medical_records.patients(id, doctor_id)
  ON DELETE CASCADE;

-- PROVENIENCIA: no se puede borrar una CONSULTA que tenga informes.
-- Las consultas se borran de verdad (`clinicalEncounter.delete` en
-- encounters/[encounterId]/route.ts) y un informe EMITIDO que pierde de cuál
-- consulta salió ya no se puede reconstruir (01-FUENTES §6).
--
-- 🔴 DEFERRABLE INITIALLY DEFERRED, y NO es un detalle: PROBADO contra prod en una
-- transacción con rollback (2026-08-08).
--   · Con RESTRICT   → borrar un PACIENTE TRUENA. Sus dos cascades (a
--     clinical_encounters y a medical_reports) corren en un orden que no
--     controlamos, y RESTRICT se comprueba de inmediato.
--   · Con NO ACTION a secas → TAMBIÉN truena: sin DEFERRABLE la comprobación
--     sigue cayendo al final de la sentencia interna del cascade.
--   · Con DEFERRABLE INITIALLY DEFERRED → se comprueba hasta el COMMIT, cuando
--     el informe ya se fue con su propio cascade. Borrar paciente FUNCIONA y
--     borrar una consulta con informes sigue BLOQUEADO (SQLSTATE 23503).
--
-- ⚠️ Prisma no sabe expresar DEFERRABLE ⇒ `prisma db push` lo revierte.
ALTER TABLE medical_records.medical_reports
  DROP CONSTRAINT IF EXISTS medical_reports_encounter_id_fkey;
ALTER TABLE medical_records.medical_reports
  ADD CONSTRAINT medical_reports_encounter_id_fkey
  FOREIGN KEY (encounter_id)
  REFERENCES medical_records.clinical_encounters(id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS medical_reports_patient_id_created_at_idx
  ON medical_records.medical_reports(patient_id, created_at);
CREATE INDEX IF NOT EXISTS medical_reports_doctor_id_status_idx
  ON medical_records.medical_reports(doctor_id, status);
CREATE INDEX IF NOT EXISTS medical_reports_form_id_idx
  ON medical_records.medical_reports(form_id);
CREATE INDEX IF NOT EXISTS medical_reports_encounter_id_idx
  ON medical_records.medical_reports(encounter_id);

-- ---------------------------------------------------------------------------
-- 3. Número de póliza en el paciente.
--    GNP EXIGE 'No de Póliza' y no existía en ninguna tabla (04-MAPEO §3). No es
--    dato del doctor: lo trae el paciente. En el expediente se captura UNA vez y
--    sirve para todos sus informes futuros — que es como opera un consultorio real.
--    NULL = no registrado.
-- ---------------------------------------------------------------------------
ALTER TABLE medical_records.patients
  ADD COLUMN IF NOT EXISTS numero_poliza      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS poliza_aseguradora VARCHAR(100);

-- ---------------------------------------------------------------------------
-- ROLLBACK (nada lo lee todavía):
--   DROP TABLE medical_records.medical_reports;
--   DROP TABLE medical_records.insurance_forms;
--   ALTER TABLE medical_records.patients
--     DROP COLUMN numero_poliza, DROP COLUMN poliza_aseguradora;
-- ---------------------------------------------------------------------------
