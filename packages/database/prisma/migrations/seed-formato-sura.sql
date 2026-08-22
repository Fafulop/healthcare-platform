-- INFORME MÉDICO — alta del formato SURA en `insurance_forms`.
--
-- GENERADO por scripts/alta-formato.ts desde el diccionario del repo. No se
-- teclea: son 14 entradas y una errata silenciosa deja campos sin
-- llenar en un PDF que se ve bien.
--
-- El PDF base NO va aquí: vive en `public/formatos/`. `pdf_url` lo dice con
-- el prefijo `repo:` en vez de fingir una URL.
--
-- Idempotente: si la fila ya existe se actualiza el diccionario.

INSERT INTO medical_records.insurance_forms
  (id, insurer, name, version, source_url, fetched_at, pdf_url, field_dict, fields_added_by_us, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'SURA',
  'Informe Médico',
  'ENERO 2025',
  'https://www.segurossura.com.mx/wp-content/uploads/2025/03/Informe-Medico-SURA.pdf',
  NOW(),
  'repo:public/formatos/sura-informe-medico-2025-01.pdf',
  '{"paciente.nombreCompleto":"Apellido paterno materno y nombre del paciente","paciente.edad":"Edad","paciente.numeroPoliza":"Texto2","antecedentes.patologicos":"Antecedentes personales patológicosRow1","vitales.talla":"Texto9","vitales.peso":"Texto10","clinico.diagnostico":"Descripción del diagnóstico","medico.nombre":"Apellido paterno materno y nombre del médico","medico.especialidad":"Especialidad","medico.cedulaProfesional":"Cédula profesional","medico.cedulaEspecialidad":"Texto14","medico.telefono":"Texto12","medico.email":"Texto15","informe.lugarYFecha":"Lugar y fecha"}'::jsonb,
  false,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (insurer, name, version) DO UPDATE
  SET field_dict = EXCLUDED.field_dict,
      pdf_url    = EXCLUDED.pdf_url,
      source_url = EXCLUDED.source_url,
      fields_added_by_us = EXCLUDED.fields_added_by_us,
      fetched_at = EXCLUDED.fetched_at,
      updated_at = NOW();

-- ⚠️ `UNIQUE (insurer, name) WHERE is_active` vive en prod: si ya hay otra
--    VERSIÓN activa de este mismo formato, este INSERT falla. Hay que
--    desactivar la vieja primero — a propósito, para que el dropdown no
--    ofrezca las dos y alguien mande la obsoleta (03-FORMATOS).

-- ROLLBACK (sólo mientras no haya informes: form_id es RESTRICT)
-- DELETE FROM medical_records.insurance_forms
--  WHERE insurer = 'SURA' AND name = 'Informe Médico' AND version = 'ENERO 2025';
