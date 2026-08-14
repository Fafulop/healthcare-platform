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
