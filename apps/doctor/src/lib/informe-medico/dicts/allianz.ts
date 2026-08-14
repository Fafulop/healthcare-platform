/**
 * Diccionario del formato **Allianz México — GMM Informe Médico** (FEBRERO 2023).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔴 **Los campos NO son de Allianz: se los pusimos nosotros.** El PDF oficial
 * viene PLANO (0 campos AcroForm) y `agregarCamposAFormatoPlano()` le puso 56
 * sobre las rayas dibujadas, deduciendo el nombre del texto vecino. Por eso el
 * formato va con `camposPropios: true` y la fila con `fields_added_by_us = TRUE`
 * (03-FORMATOS §5). El prefijo `p1_`/`p2_` es NUESTRO, no de la aseguradora.
 *
 * Derivado con `scripts/alta-formato.ts` sobre el PDF bajado el 2026-08-14 del
 * portal de documentos de Allianz: **57 reglas → 52 campos de texto**, 41 por la
 * izquierda y 11 por arriba, 5 sin etiqueta, 0 que no se pudieran crear —
 * **más 14 grupos de casillas con sus 33 recuadros** (abajo).
 *
 * ⚠️ La corrida del 2026-08-08 daba 61 → 56. La diferencia son 4 pares de rayas
 * ENCIMADAS que la deduplicación vieja no veía porque comparaba esquinas en vez
 * de traslape; se creaban dos campos sobre el mismo blanco y el de arriba tapaba
 * al de abajo. Lo cazó el usuario mirando el mapa de campos, con todos los
 * números en verde.
 *
 * ⚠️ **Lo que este diccionario NO mapea, y por qué.** Sólo entran los campos
 * cuyo concepto es inequívoco leyendo el nombre. Lo demás se queda como campo
 * CRUDO (`campo:<nombre>`): el doctor puede escribir en él igual, y el chat
 * puede proponerlo. Lo que NO se hace es afirmar una equivalencia que nadie ha
 * verificado contra la hoja impresa — en un documento que firma un médico eso se
 * ve exactamente igual de bien que una correcta.
 */
import type { FieldDict } from '../types';

export const DICT_ALLIANZ: FieldDict = {
  // ── Identidad del paciente (p1, el encabezado) ─────────────────────────────
  'paciente.apellidoPaterno': 'p1_Apellido_Paterno',
  'paciente.apellidoMaterno': 'p1_Apellido_Materno',
  'paciente.nombres': 'p1_Nombres',
  'paciente.edad': 'p1_Edad',

  // ── Signos vitales (p2) ───────────────────────────────────────────────────
  'vitales.talla': 'p2_Talla',
  'vitales.peso': 'p2_Peso',
  'vitales.tensionArterial': 'p2_TA',

  // ── El médico (el bloque del pie de la p2) ────────────────────────────────
  'medico.nombre': 'p2_Nombre_del_Medico',
  'medico.especialidad': 'p2_Especialidad',
  'medico.cedulaProfesional': 'p2_Cedula_Profesional',
  'medico.telefono': 'p2_Telefono',
  'medico.email': 'p2_E-mail',
};

/**
 * 🔴 LO QUE FALTA DECIDIR MIRANDO LA HOJA IMPRESA. No se adivinó ninguno.
 *
 * | Canónico | Candidatos en la hoja | Por qué no se mapeó |
 * |---|---|---|
 * | `clinico.diagnostico` | `p1_padecimiento` · `p1_CAUSA` | Ninguno dice "diagnóstico". `p1_y_cantidad` demuestra que el extractor a veces agarra el FINAL de una pregunta partida en dos, así que el nombre no basta |
 * | `clinico.tratamiento` | `p2_Descripcion_del_tratamiento` · `p2_Favor_de_especificar_el_tipo_de_tratamiento` | Hace falta saber si Allianz pregunta por el tratamiento YA DADO o el PROPUESTO. `plan` es el propuesto, y en AXA mapearlo al "recibido" habría dicho algo falso (paso 4, decisión 2) |
 * | `clinico.exploracionFisica` | `p2_Senale_los_datos_relevantes_de_la_exploracio` (+`_2`) | 🔴 **No CABE.** Medido con `capacidadDeCaja`: la raya que sigue a la etiqueta es 331×12 pt ⇒ **110 caracteres** a 6 pt, y la de continuación 562 pt ⇒ 187. Un `objective` real pasa de los dos, así que el campo saldría en letra ilegible **en casi todos los informes**. Un mapeo que siempre se marca `no-cabe` no es un mapeo, es un aviso permanente |
 * | `paciente.rfc` | `p2_RFC` | 🔴 **Está en el bloque del MÉDICO**, pegado a `p2_Cedula_Profesional`. Escribir ahí el RFC del paciente sería declarar el de otra persona. El canónico no tiene `medico.rfc` |
 * | `informe.fecha` | `p3_Fecha_exacta_de_la_cirugia_ddmmaa` | Es la fecha de la CIRUGÍA, no la del documento. "La fecha de un documento no es la fecha de lo que cuenta" (06-AGENTE §11) |
 * | hospital / ciudad | `p2_Nombre_del_Hospital` · `p2_Ciudad` | No hay camino desde el informe al hospital, y hospital ≠ consultorio (04-MAPEO §3) |
 *
 * Los seis se quedan como campos CRUDOS: se pueden teclear y el chat los ve.
 * Lo único que no pasa es que el pre-llenado escriba ahí solo.
 *
 * ## Las casillas
 *
 * La hoja trae **14 grupos de opciones con 33 recuadros**, deducidos de los
 * glifos `□` impresos (`casillasDibujadas`). No están en este diccionario a
 * propósito: son campos CRUDOS que el doctor marca y el asistente puede
 * proponer, igual que en AXA. El canónico no tiene conceptos para "tipo de
 * padecimiento" o "tipo de estancia" — son propios de la hoja (04-MAPEO §1).
 *
 * 🔴 **Dos quedan FUERA del alcance del asistente** (`casillasParaElAgente`):
 * `p3_Tiene_convenio_con_la_aseguradora` y
 * `p3_complementario_por_este_padecimiento_a_la_Co`. No son hechos clínicos,
 * son declaraciones administrativas frente a la aseguradora. Las marca el
 * médico.
 *
 * ⚠️ `p2_Hubo_complicaciones` existe DOS veces y no es un error: la raya de
 * texto se llama así y el grupo de casillas de la misma pregunta es
 * `p2_Hubo_complicaciones_2`. Igual con `p2_Continuara_recibiendo_...`.
 */

/**
 * 🔴 CÓMO SE LE NOMBRA CADA CAMPO AL ASISTENTE (y al doctor en la lista).
 *
 * En AXA los nombres los puso la aseguradora y se explican solos
 * (`Apellido paterno`, `Tensión arterial`). **Aquí los inventamos nosotros** a
 * partir del texto vecino, así que el nombre interno (`p1_AAAA`,
 * `p1_y_cantidad`) no sirve como etiqueta. Medido antes de esto: de los 73
 * campos de texto, **61 llegaban al modelo con el nombre crudo como única
 * pista** — el asistente no podía elegirlos, que es exactamente por lo que las
 * fechas de AXA no aterrizaban hasta que se les dio contexto.
 *
 * El texto de aquí es el que está IMPRESO en la hoja, no una interpretación: es
 * el mismo del que salió el nombre, sin pasar por el slug (conserva acentos) y
 * con la pregunta del renglón antepuesta cuando la etiqueta sola no dice nada
 * (`¿Cuál?` → `Referido por otro médico o unidad: — ¿Cuál?`).
 *
 * Generado por `scripts/alta-formato.ts campos`. Se puede CORREGIR a mano —es
 * la pantalla de revisión que 02-PLAN §3 siempre pidió— y las correcciones
 * sobreviven a regenerar el PDF mientras el nombre no cambie.
 *
 * ⚠️ Quedan tres que la hoja no explica ni con su renglón: `p1_CAUSA`,
 * `p1_padecimiento` y `p2_Cual`. Necesitan que alguien MIRE la hoja impresa.
 */
export const ETIQUETAS_ALLIANZ: Record<string, string> = {
  "p1_Apellido_Paterno": "Apellido Paterno",
  "p1_Apellido_Materno": "Apellido Materno",
  "p1_Nombres": "Nombre(s)",
  "p1_Edad": "Edad",
  "p1_Estado_Civil": "Estado Civil",
  "p1_Cual": "Referido por otro médico o unidad: — ¿Cuál?",
  "p1_Antecedentes_Heredo-Familiares": "Antecedentes Heredo-Familiares:",
  "p1_Antecedentes_Heredo-Familiares_2": "Antecedentes Heredo-Familiares:",
  "p1_Especifique": "Neurológicas — Especifique",
  "p1_AAAA": "Diabetes Mellitus — AAAA",
  "p1_Mencione_cirugias_realizadas": "Mencione cirugías realizadas",
  "p1_Indique_motivo_de_hospitalizacion_no_quirurg": "Indique motivo de hospitalización (no quirúrgica)",
  "p1_y_cantidad": "¿Consume o ha consumido bebidas alcohólicas? especificar tipo — y cantidad)",
  "p1_y_cantidad_2": "¿Consume o ha consumido algún tipo de drogas? — y cantidad)",
  "p1_FUM": "FUM",
  "p1_No_de_Embarazos": "No. de Embarazo(s):",
  "p1_Partos": "Parto(s):",
  "p1_Cesareas": "Cesárea(s):",
  "p1_Abortos": "Aborto(s):",
  "p1_Antecedentes_Perinatales": "Antecedentes Perinatales:",
  "p1_Otro_s": "Antecedentes Perinatales: — Otro (s):",
  "p1_padecimiento": "padecimiento:",
  "p1_AAAA_2": "Fecha de diagnóstico de este padecimiento — AAAA",
  "p1_CAUSA": "CAUSA",
  "p2_Cual": "¿Cuál?",
  "p2_Cual_2": "¿El origen del padecimiento es primario? — ¿Cuál?",
  "p2_Favor_de_especificar_el_tipo_de_tratamiento": "Favor de especificar el tipo de tratamiento",
  "p2_Continuara_recibiendo_tratamiento_en_el_futu": "¿Continuará recibiendo tratamiento en el futuro?",
  "p2_Talla": "Talla:",
  "p2_Peso": "Peso:",
  "p2_TA": "T/A:",
  "p2_Senale_los_datos_relevantes_de_la_exploracio": "Señale los datos relevantes de la exploración física:",
  "p2_Senale_los_datos_relevantes_de_la_exploracio_2": "Señale los datos relevantes de la exploración física:",
  "p2_Senale_los_resultados_de_examenes_de_laborat": "Señale los resultados de exámenes de laboratorio, gabinete, imagenología u otros, que sustenten el diagnóstico",
  "p2_Senale_los_resultados_de_examenes_de_laborat_2": "Señale los resultados de exámenes de laboratorio, gabinete, imagenología u otros, que sustenten el diagnóstico",
  "p2_Descripcion_del_tratamiento": "Descripción del tratamiento:",
  "p2_Descripcion_del_tratamiento_2": "Descripción del tratamiento:",
  "p2_car_procedimiento": "car procedimiento",
  "p2_Descripcion_de_las_complicaciones": "Descripción de las complicaciones",
  "p2_Hubo_complicaciones": "¿Hubo complicaciones?",
  "p2_Nombre_del_Hospital": "Nombre del Hospital:",
  "p2_Ciudad": "Ciudad:",
  "p2_Nombre_del_Medico": "Nombre del Médico",
  "p2_Especialidad": "Especialidad:",
  "p2_Telefono": "Teléfono",
  "p2_Telefono_Celular": "Teléfono Celular",
  "p2_Radio_Localizador": "Radio Localizador",
  "p2_Cedula_Profesional": "Cédula Profesional",
  "p2_RFC": "R.F.C.",
  "p2_E-mail": "E-mail",
  "p3_Fecha_exacta_de_la_cirugia_ddmmaa": "Fecha exacta de la cirugía (dd/mm/aa)",
  "p3_Hospital_donde_se_practicara_la_cirugia": "Hospital dónde se practicará la cirugía",
  "p1_Fecha_Cancer": "Fecha — Cáncer",
  "p1_Fecha_Cardiacos": "Fecha — Cardíacos",
  "p1_Fecha_Otro": "Fecha — Otro",
  "p1_Fecha_Obesidad": "Fecha — Obesidad",
  "p1_Fecha_VIHSIDA": "Fecha — VIH/SIDA",
  "p1_Fecha_Neurologicas": "Fecha — Neurológicas",
  "p1_Fecha_Hepaticos": "Fecha — Hepáticos",
  "p1_Fecha_Diabetes_Mellitus": "Fecha — Diabetes Mellitus",
  "p1_Fecha_Hipertensivos": "Fecha — Hipertensivos",
  "p1_Fecha_de_primeros_sintomas_del_padecimiento": "Fecha de primeros síntomas del padecimiento",
  "p1_Fecha_de_primera_consulta_por_este_padecimie": "Fecha de primera consulta por este padecimiento",
  "p1_Fecha_de_diagnostico_de_este_padecimiento": "Fecha de diagnóstico de este padecimiento",
  "p2_Fecha_Desde": "Fecha — Desde",
  "p2_Fecha_Hasta": "Fecha — Hasta",
  "p2_Fecha_de_ingreso": "Fecha de ingreso",
  "p2_Fecha_de_egreso": "Fecha de egreso",
  "p2_Fecha_favor_de_indicar_fecha_de_inicio": "Fecha — favor de indicar fecha de inicio",
  "p2_Fecha_car_procedimiento": "Fecha — car procedimiento",
  "p3_Importe_Cirujano": "Importe — Cirujano",
  "p3_Importe_Ayudante": "Importe — Ayudante",
  "p3_Importe_Anestesista": "Importe — Anestesista",
};
