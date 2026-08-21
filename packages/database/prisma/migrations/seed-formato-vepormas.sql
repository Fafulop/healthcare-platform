-- INFORME MÉDICO — alta del formato Ve por Más en `insurance_forms`.
--
-- GENERADO por scripts/alta-formato.ts desde el diccionario del repo. No se
-- teclea: son 22 entradas y una errata silenciosa deja campos sin
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
  'Ve por Más',
  'GMM Informe Médico',
  'SM008',
  'https://www.vepormas.com/fwpf/storage/02_informe_medico_GMM_SM008.pdf',
  NOW(),
  'repo:public/formatos/vepormas-gmm-informe-medico-sm008.pdf',
  '{"paciente.nombres":"Nombre","paciente.apellidoPaterno":"ApellidoPaterno","paciente.apellidoMaterno":"ApellidoMaterno","paciente.edad":"Edad","paciente.numeroPoliza":"No de Póliza","antecedentes.patologicos":"Antecedentes personales patológicos con fecha de inicio 1","clinico.padecimientoActual":"Antecedentes perinatales 4","clinico.diagnostico":"Descripción del diagnóstico","vitales.talla":"Resultado de la exploración física y de los estudios anexar interpretaciones que confirmen diagnóstico","vitales.peso":"Peso","vitales.tensionArterial":"TA","vitales.frecuenciaCardiaca":"FC","vitales.temperatura":"T","medico.nombres":"NombreDOC","medico.apellidoPaterno":"ApellidoPaternoDOC","medico.apellidoMaterno":"ApellidoMaternoDOC","medico.especialidad":"Especialidad","medico.cedulaProfesional":"Cédula Profesional","medico.cedulaEspecialidad":"Cédula","medico.telefono":"Teléfono","medico.email":"Email","medico.nombre":"NombreYFirma01"}'::jsonb,
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
--  WHERE insurer = 'Ve por Más' AND name = 'GMM Informe Médico' AND version = 'SM008';
