/**
 * Diccionario del formato **Zurich — Informe Médico** (2 págs, mayo 2020).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔎 Bajado de `zurich.com.mx`. Trae 86 campos: 71 de texto y **15 grupos de
 * RADIO**, todos llamados `Group10`…`Group24`.
 *
 * ## 🔴 Ninguno de sus 15 grupos conserva su pregunta, y la culpa NO es de la hoja
 *
 * Las 15 preguntas están impresas. Lo que pasa es que **Zurich rotula sus
 * opciones por la IZQUIERDA**, así que el texto inmediatamente a la izquierda
 * del primer recuadro —de donde el motor saca la pregunta— **es la etiqueta de
 * la propia opción**, se descarta (bien) y el grupo queda sin pregunta. Está
 * anotado como límite conocido en `etiquetas-de-la-hoja.ts`; ésta es la hoja
 * donde muerde.
 *
 * ⇒ Van en `PREGUNTAS_ZURICH`, leídas del texto impreso una por una. Estirar la
 * geometría "un poco más a la izquierda" habría inventado por lo menos una:
 * a la izquierda de `Group13` (Parto(s)/Cesárea(s)/Aborto(s)) está `FUR`, que es
 * OTRO campo del mismo renglón.
 *
 * ## ⚠️ Y cuatro rótulos que la geometría dedujo MAL
 *
 * Se corrigen en `ETIQUETAS_ZURICH` (o desaparecen al mapear el campo):
 *
 * | campo | rótulo deducido | lo que es de verdad |
 * |---|---|---|
 * | `Text10` | «Talla» | **Peso** — el renglón es `Talla __ CM. Peso __ KG. T/A __ MM/HG.` |
 * | `11` | «Peso» | **Tensión arterial** — corrido una columna |
 * | `18` | «No» | la caja de **describir las complicaciones** (tomó una opción del `Sí/No` de al lado) |
 * | `21` | «Hospitalización» | la **fecha de ingreso** (tomó la opción de al lado) |
 *
 * ## ⚠️ Lo que NO se mapea, y por qué
 *
 *   - 🔴 **`40` es el CONSENTIMIENTO LFPDPPP del paciente** («…sus datos
 *     personales generales y sensibles en este documento… consentimiento
 *     expreso… Aviso de Privacidad»), y es un campo de **TEXTO**, así que
 *     `casillasParaElAgente()` —el guardarraíl que impide que un modelo firme el
 *     `Sí acepto` de AXA— **no lo alcanza**.
 *     🔴 **No mapearlo NO lo desactiva**: un campo sin concepto canónico se le
 *     sigue ofreciendo al modelo como campo CRUDO, y encima con una etiqueta que
 *     le dice exactamente qué es. Está en 08-ALTA §6c y lo volví a olvidar aquí;
 *     lo cazó el `/code-review`. Lo que de verdad lo saca del catálogo es
 *     `camposVetadosParaElAgente`. El médico sigue pudiendo escribir ahí.
 *   - **Todas las fechas.** `DIAGNOSTICO 1`, `SINTOMAS 1`, `CONSULTA 1`, `15`,
 *     `17` y `21` son FECHAS del padecimiento aunque el nombre no lo diga, y el
 *     expediente no las guarda. La fecha de la consulta no es ninguna de ellas.
 *   - `DIAGNOSTICO 2` → no se pudo leer qué pide (la caja no tiene texto en su
 *     renglón). Queda cruda hasta que alguien mire la hoja impresa.
 *   - **Los antecedentes** van en ~12 cajas sueltas (`CANCER`, `DIABETES`,
 *     `HEPATICOS`…), no en un bloque: `antecedentes.patologicos` es un solo
 *     texto y no se reparte.
 *   - `19` (nombre del hospital) · `20` (ciudad) → no hay camino del informe al
 *     hospital, y hospital ≠ consultorio (04-MAPEO §3).
 *   - `14` «Descripción del tratamiento» → no se sabe, sin ver la hoja, si pide
 *     el tratamiento DADO o el PROPUESTO. Mismo criterio que en los otros cinco.
 *   - Los bloques de `Cirujano`/`Anestesiólogo`/`Ayudante` con su `PRESUPUESTO`
 *     → son el equipo quirúrgico y el presupuesto, no nosotros.
 */
import type { FieldDict } from '../types';

export const DICT_ZURICH: FieldDict = {
  // ── El paciente (p1) ──────────────────────────────────────────────────────
  // La hoja pide «APELLIDO PATERNO, APELLIDO MATERNO, NOMBRE(S)» en una caja.
  'paciente.nombreCompleto': 'NOMBRE',
  'paciente.edad': 'EDAD',

  // ── Signos vitales (p2) — el renglón `Talla CM. Peso KG. T/A MM/HG.` ──────
  // 🔴 Mapearlos es además lo que borra los rótulos corridos: un campo con
  // concepto canónico toma la etiqueta del canónico, no la de la geometría.
  'vitales.talla': 'Text9',
  'vitales.peso': 'Text10',
  'vitales.tensionArterial': '11',

  // ── Clínico (p2) ──────────────────────────────────────────────────────────
  'clinico.exploracionFisica': '12',

  // ── El médico tratante (p2) ───────────────────────────────────────────────
  'medico.nombre': '22',
  'medico.especialidad': '24',
  'medico.cedulaProfesional': '25',
  'medico.cedulaEspecialidad': '26',
  'medico.email': '27',
  'medico.telefono': '28',
};

/**
 * `nombre del campo -> lo que dice la HOJA` (08-ALTA §7b).
 *
 * Aquí cubre dos cosas: los rótulos que la geometría dedujo MAL (arriba) y los
 * campos numerados de la p2 cuyo nombre (`18`, `31`) no dice nada.
 */
export const ETIQUETAS_ZURICH: Record<string, string> = {
  // 🔴 Los deducidos MAL, verificados contra el renglón impreso.
  '18': 'Favor de describir las complicaciones',
  '21': 'Fecha de ingreso',
  '19': 'Sitio de Atención (nombre del hospital, clínica, etc.)',
  '20': 'Ciudad del hospital',
  // 🔴 El consentimiento del PACIENTE. Se nombra con la verdad para que se vea
  // lo que es — no para que se llene.
  '40': 'CONSENTIMIENTO del paciente para el tratamiento de sus datos personales (lo firma el asegurado, no el médico)',
  // Fechas cuyo nombre no dice que lo son.
  'DIAGNOSTICO 1': 'Fecha de diagnóstico del padecimiento',
  'SINTOMAS 1': 'Fecha de los primeros síntomas del padecimiento',
  'CONSULTA 1': 'Fecha de primera consulta por este padecimiento',
  '15': 'En caso de tratamiento médico: fecha de inicio',
  '17': 'En caso de tratamiento realizado: fecha',
  // El equipo quirúrgico y sus presupuestos — cuatro `PRESUPUESTO` idénticos.
  '30': 'Nombre del Cirujano',
  '31': 'Presupuesto de honorarios — Cirujano',
  '32': 'Presupuesto de honorarios — Anestesiólogo',
  '33': 'Nombre del Anestesiólogo',
  '34': 'Presupuesto de honorarios — Primer Ayudante',
  '35': 'Nombre del Primer Ayudante',
  '36': 'Presupuesto de honorarios — Segundo Ayudante',
  '37': 'Nombre del Segundo Ayudante',
  '38': 'Presupuesto de honorarios — Otro(s) Médico(s)',
  '39': 'Nombre de Otro(s) Médico(s)',
  '13': 'Señale los resultados de exámenes de laboratorio y gabinete',
  '14': 'Descripción del tratamiento',
  '16': 'En caso de tratamiento quirúrgico, especifique',
  '23': 'RFC del médico',
  '29': 'Teléfono celular del médico',
};

export const VETADOS_ZURICH: string[] = [
  // 🔴 El consentimiento LFPDPPP del PACIENTE, en un campo de TEXTO. Es lo que
  // `casillasParaElAgente()` bloquea en las otras hojas y aquí no puede ver.
  '40',
];

/**
 * La PREGUNTA impresa de cada grupo de radio (`FormatoEnRepo.preguntasDeCasilla`).
 *
 * 🔴 Las 15 se leyeron del renglón impreso. Dos renglones traen DOS preguntas
 * —`Accidente|Enfermedad` junto a `Embarazo: Parto|Cesárea`, y
 * `¿…incapacidad? Sí|No` junto a `Parcial|Total`— que es la misma rejilla de
 * columnas que ya mordió en Allianz (08-ALTA §7b, regla 2).
 *
 * ⚠️ `Group13` NO tiene pregunta impresa propia: a su izquierda está `FUR`, que
 * es otro campo del renglón. Pero dejarlo pelón junto a `Group12`
 * (`Parto | Cesárea`, casi las mismas opciones) obliga al modelo a elegir entre
 * los dos por el nombre —`campo:Group13` contra `campo:Group12`— y el servidor
 * acepta el que nombre, porque la etiqueta empata dentro de cualquiera de los
 * dos. Se le pone lo ÚNICO que la hoja sí dice de él: que vive en el renglón de
 * los antecedentes gineco-obstétricos (`FUR · G · P · A · C`), sin inventar una
 * pregunta que no está impresa.
 */
export const PREGUNTAS_ZURICH: Record<string, string> = {
  Group10: 'Género',
  Group11: 'Tipo de Atención',
  Group12: 'Embarazo',
  Group13: 'Antecedentes gineco-obstétricos: tipo de evento (renglón de FUR)',
  Group14: '¿Utiliza algún método anticonceptivo?',
  Group15: 'Tipo de padecimiento',
  Group16: '¿Tiene relación con otro padecimiento?',
  Group17: '¿El origen del padecimiento es primario?',
  Group18: '¿El padecimiento ocasionó u ocasionará incapacidad?',
  Group19: 'La incapacidad es (parcial o total)',
  Group20: '¿Continuará recibiendo tratamiento en el futuro?',
  Group21: '¿Hubo complicaciones?',
  Group22: 'Tipo de estancia',
  // 🔴 Estas dos son ADMINISTRATIVAS, no clínicas. Se les da su pregunta de
  // verdad justamente para que `casillasParaElAgente` las bloquee por lo que
  // SON —«convenio», «tabulador»— y no por ser un `Sí`/`No` genérico.
  Group23: '¿Es Médico de convenio de la Aseguradora?',
  Group24: 'En caso de no ser médico de convenio, ¿Acepta tabulador?',
};
