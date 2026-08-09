-- INFORME MÉDICO — alta del formato AXA en `insurance_forms` (paso 5).
--
-- GENERADO desde apps/doctor/src/lib/informe-medico/dicts/axa.ts — no se teclea
-- a mano: el diccionario tiene 60 entradas y una errata silenciosa
-- deja campos sin llenar en un PDF que se ve bien.
--
-- El PDF base NO va aquí: vive en el repo (`public/formatos/`) porque los
-- formatos oficiales son de plataforma y todavía no existe el alta por admin.
-- `pdf_url` lo dice con el prefijo `repo:` en vez de fingir una URL.
--
-- Idempotente: si la fila ya existe se actualiza el diccionario.

INSERT INTO medical_records.insurance_forms
  (id, insurer, name, version, source_url, fetched_at, pdf_url, field_dict, fields_added_by_us, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'AXA',
  'GMM Informe Médico',
  'AI-346 FEBRERO 2022',
  'https://axa.mx/',
  NOW(),
  'repo:public/formatos/axa-gmm-informe-medico-2022-02.pdf',
  '{"paciente.apellidoPaterno":"Apellido paterno","paciente.apellidoMaterno":"Apellido materno","paciente.nombres":"Nombres","paciente.edad":"Edad","vitales.talla":"Talla","vitales.peso":"Peso","vitales.tensionArterial":"Tensión arterial","clinico.padecimientoActual":"Padecimiento actual principales signos síntomas y detalles de evolución","clinico.exploracionFisica":"Señale los datos relevantes de exploración física","clinico.diagnostico":"DiagnósticoRow1","clinico.tratamiento":"Tratamiento propuesto quirúrgico no quirúrgico","medico.nombre":"Nombre","medico.especialidad":"Especialidad","medico.cedulaProfesional":"Cédula profesional","medico.cedulaEspecialidad":"Cédula de especialidad","medico.telefono":"Teléfono","medico.domicilio":"Domicilio","informe.lugar":"Lugar","informe.fecha":"Información general","informe.lugarYFecha":"Lugar y fechaRow1","medicamentos.1.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg1","medicamentos.1.cantidad":"Cantidad Ej 1 tableta1","medicamentos.1.frecuencia":"Cada cuánto Ej Cada 24 hrs1","medicamentos.1.duracion":"Durante cuánto tiempo Ej Por un mes1","medicamentos.2.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg2","medicamentos.2.cantidad":"Cantidad Ej 1 tableta2","medicamentos.2.frecuencia":"Cada cuánto Ej Cada 24 hrs2","medicamentos.2.duracion":"Durante cuánto tiempo Ej Por un mes2","medicamentos.3.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg3","medicamentos.3.cantidad":"Cantidad Ej 1 tableta3","medicamentos.3.frecuencia":"Cada cuánto Ej Cada 24 hrs3","medicamentos.3.duracion":"Durante cuánto tiempo Ej Por un mes3","medicamentos.4.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg4","medicamentos.4.cantidad":"Cantidad Ej 1 tableta4","medicamentos.4.frecuencia":"Cada cuánto Ej Cada 24 hrs4","medicamentos.4.duracion":"Durante cuánto tiempo Ej Por un mes4","medicamentos.5.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg5","medicamentos.5.cantidad":"Cantidad Ej 1 tableta5","medicamentos.5.frecuencia":"Cada cuánto Ej Cada 24 hrs5","medicamentos.5.duracion":"Durante cuánto tiempo Ej Por un mes5","medicamentos.6.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg6","medicamentos.6.cantidad":"Cantidad Ej 1 tableta6","medicamentos.6.frecuencia":"Cada cuánto Ej Cada 24 hrs6","medicamentos.6.duracion":"Durante cuánto tiempo Ej Por un mes6","medicamentos.7.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg7","medicamentos.7.cantidad":"Cantidad Ej 1 tableta7","medicamentos.7.frecuencia":"Cada cuánto Ej Cada 24 hrs7","medicamentos.7.duracion":"Durante cuánto tiempo Ej Por un mes7","medicamentos.8.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg8","medicamentos.8.cantidad":"Cantidad Ej 1 tableta8","medicamentos.8.frecuencia":"Cada cuánto Ej Cada 24 hrs8","medicamentos.8.duracion":"Durante cuánto tiempo Ej Por un mes8","medicamentos.9.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg9","medicamentos.9.cantidad":"Cantidad Ej 1 tableta9","medicamentos.9.frecuencia":"Cada cuánto Ej Cada 24 hrs9","medicamentos.9.duracion":"Durante cuánto tiempo Ej Por un mes9","medicamentos.10.nombre":"Nombre y presentación del medicamento Ej Paracetamol 100 mg10","medicamentos.10.cantidad":"Cantidad Ej 1 tableta10","medicamentos.10.frecuencia":"Cada cuánto Ej Cada 24 hrs10","medicamentos.10.duracion":"Durante cuánto tiempo Ej Por un mes10"}'::jsonb,
  false,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (insurer, name, version) DO UPDATE
  SET field_dict = EXCLUDED.field_dict,
      pdf_url    = EXCLUDED.pdf_url,
      source_url = EXCLUDED.source_url,
      updated_at = NOW();

-- ROLLBACK (sólo mientras no haya informes: form_id es RESTRICT)
-- DELETE FROM medical_records.insurance_forms
--  WHERE insurer = 'AXA' AND name = 'GMM Informe Médico' AND version = 'AI-346 FEBRERO 2022';
