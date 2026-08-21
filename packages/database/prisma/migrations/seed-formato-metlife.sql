-- INFORME MÉDICO — alta del formato MetLife en `insurance_forms`.
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
  'MetLife',
  'Informe Médico',
  'CC-1-020 VER5',
  'https://www.metlife.com.mx/content/dam/metlifecom/mx/pdfs/common-files/CC-1-020-VER5.pdf',
  NOW(),
  'repo:public/formatos/metlife-informe-medico-cc-1-020-ver5.pdf',
  '{"informe.lugarYFecha":"Lugar y fecha","paciente.nombreCompleto":"1 Datos del paciente","paciente.edad":"EDAD","vitales.peso":"Peso","vitales.talla":"Talla","antecedentes.patologicos":"Antecedentes personales patológicos 1","clinico.padecimientoActual":"a Principales signos síntomas y detalle de la evolución 2","clinico.exploracionFisica":"Detallar resultados de exploración física estudios de laboratorio yo gabinete que demuestren el diagnóstico referido 2","clinico.diagnostico":"d Diagnóstico etiológico definitivo","medico.nombre":"Nombre completo_4","medico.especialidad":"Especialidad_3","medico.cedulaProfesional":"Cédula profesional especialidad_5","medico.telefono":"Teléfono del consultorio","medico.domicilio":"Domiclio consultorio"}'::jsonb,
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
--  WHERE insurer = 'MetLife' AND name = 'Informe Médico' AND version = 'CC-1-020 VER5';
