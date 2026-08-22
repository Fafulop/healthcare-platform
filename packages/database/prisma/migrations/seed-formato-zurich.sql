-- INFORME MÉDICO — alta del formato Zurich en `insurance_forms`.
--
-- GENERADO por scripts/alta-formato.ts desde el diccionario del repo. No se
-- teclea: son 12 entradas y una errata silenciosa deja campos sin
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
  'Zurich',
  'Informe Médico',
  'MAYO 2020',
  'https://www.zurich.com.mx/-/media/project/zwp/mexico/docs/regulaciones/formatos-y-solicitudes/vida-2020/formato-informe-medico_sinr.pdf',
  NOW(),
  'repo:public/formatos/zurich-informe-medico-2020-05.pdf',
  '{"paciente.nombreCompleto":"NOMBRE","paciente.edad":"EDAD","vitales.talla":"Text9","vitales.peso":"Text10","vitales.tensionArterial":"11","clinico.exploracionFisica":"12","medico.nombre":"22","medico.especialidad":"24","medico.cedulaProfesional":"25","medico.cedulaEspecialidad":"26","medico.email":"27","medico.telefono":"28"}'::jsonb,
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
--  WHERE insurer = 'Zurich' AND name = 'Informe Médico' AND version = 'MAYO 2020';
