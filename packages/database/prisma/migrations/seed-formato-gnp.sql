-- INFORME MÉDICO — alta del formato GNP en `insurance_forms`.
--
-- GENERADO por scripts/alta-formato.ts desde el diccionario del repo. No se
-- teclea: son 20 entradas y una errata silenciosa deja campos sin
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
  'GNP',
  'Informe Médico GMM',
  '402087SCinfmed_0217',
  'https://www.gnp.com.mx/content/dam/pp/mx/es/footer/blue-navigation/asistencia-y-contacto/servicios-en-linea/que-hacer-en-caso-de-siniestro/gastos-medicos-mayores/Informe-Medico-GMM-GNP.pdf',
  NOW(),
  'repo:public/formatos/gnp-informe-medico-gmm-0217.pdf',
  '{"paciente.apellidoPaterno":"Apellido paterno","paciente.apellidoMaterno":"Apellido materno","paciente.nombres":"Nombre","paciente.fechaNacimiento":"Fecha Nacimiento","paciente.edad":"Edad","paciente.numeroPoliza":"No de Póliza","antecedentes.patologicos":"Antecedentes Patológicos","clinico.padecimientoActual":"Padecimiento actual","clinico.diagnostico":"Diagnóstico Definitivo","clinico.exploracionFisica":"Resultado del estudio","medico.apellidoPaterno":"Apellido paterno del médico","medico.apellidoMaterno":"Apellido materno del médico","medico.nombres":"Nombres del médico tratante","medico.especialidad":"Especialidad","medico.cedulaProfesional":"Cédula profesional","medico.cedulaEspecialidad":"Cédula Especialidad","medico.telefono":"Teléfono Médico","medico.email":"Correo del Médico","medico.nombre":"Nombre y firma del médico tratante","informe.lugarYFecha":"Lugar y fecha"}'::jsonb,
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
--  WHERE insurer = 'GNP' AND name = 'Informe Médico GMM' AND version = '402087SCinfmed_0217';
