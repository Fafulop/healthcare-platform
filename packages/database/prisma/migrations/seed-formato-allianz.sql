-- INFORME MÉDICO — alta del formato Allianz en `insurance_forms`.
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
  'Allianz',
  'GMM Informe Médico',
  'FEBRERO 2023',
  'https://componentes.allianz.com.mx/widget/web/guest/documentos',
  NOW(),
  'repo:public/formatos/allianz-gmm-informe-medico-2023-02.pdf',
  '{"paciente.apellidoPaterno":"p1_Apellido_Paterno","paciente.apellidoMaterno":"p1_Apellido_Materno","paciente.nombres":"p1_Nombres","paciente.edad":"p1_Edad","vitales.talla":"p2_Talla","vitales.peso":"p2_Peso","vitales.tensionArterial":"p2_TA","medico.nombre":"p2_Nombre_del_Medico","medico.especialidad":"p2_Especialidad","medico.cedulaProfesional":"p2_Cedula_Profesional","medico.telefono":"p2_Telefono","medico.email":"p2_E-mail"}'::jsonb,
  TRUE,
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
--  WHERE insurer = 'Allianz' AND name = 'GMM Informe Médico' AND version = 'FEBRERO 2023';
