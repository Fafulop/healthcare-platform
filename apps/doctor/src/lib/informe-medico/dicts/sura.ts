/**
 * Diccionario del formato **SURA — Informe Médico** (3 págs, enero 2025).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔎 Bajado de `segurossura.com.mx`. Ya trae sus 106 campos (82 texto + 24
 * grupos de UNA casilla). Rotula sus recuadros por la IZQUIERDA (08-ALTA §7d).
 *
 * ## 🔴 La rareza de esta hoja: hay opciones que NO son casillas
 *
 * **13 campos de TEXTO con `maxLength = 1`** funcionan como casillas: se
 * contesta escribiendo una `X` al lado de la opción. Es un tipo de pregunta que
 * el motor nunca había visto — la familia de los RADIOS de GNP, otra vez por una
 * puerta nueva.
 *
 * 🔴 **Y por ser texto, `casillasParaElAgente()` NO los protege.** Esa función
 * bloquea los grupos peligrosos entre las CASILLAS; estos entran al catálogo
 * como campos de texto corrientes, así que sus reglas no se aplican:
 *
 *   - `Si` y `No_3` son el par de **«¿Hubo complicaciones?»** — exactamente el
 *     caso que la regla 3 bloquea en AXA (`Sí_2`), aquí sin guardarraíl.
 *   - `Cirujano` y `Cirujano_2` son **dos preguntas distintas** (Médico 1 y
 *     Médico 2) con nombres que sólo se distinguen por un `_2`.
 *
 * ⇒ Se cierran con `ETIQUETAS_SURA`, que es lo único que puede decirle al modelo
 * de qué pregunta es cada casilla-de-texto. **Ninguna se mapea al canónico:** el
 * pre-llenado no marca opciones, las marca el médico.
 *
 * ## ⚠️ Lo que NO se mapea, y por qué
 *
 *   - 🔴 **Todas las fechas.** Y el motivo NO es el que parece: **esta hoja no
 *     tiene campos `Mes` ni `Año`** (medido: 0 de los 82 de texto). Cada fecha
 *     es UNA sola caja —`Día`…`Día_5`, un widget de 90×12 pt— con las guías
 *     `Día`/`Mes`/`Año` impresas encima, como el `Día_4` de AXA. Lo que bloquea
 *     el mapeo es su **`maxLength = 4`**: no cabe `15/03/2025` (10) ni el
 *     `15032025` (8) al que el renderer rescataría, así que se omitiría como
 *     `no-cabe-en-el-campo`. Sin ver una hoja llena no se sabe qué espera SURA
 *     en 4 caracteres, y adivinarlo en una fecha que la aseguradora cruza contra
 *     el siniestro es justo lo que no se hace.
 *   - `paciente.sexo` → la hoja pide `M`/`F` con una marca; el canónico entrega
 *     `"Masculino"`. Es lo mismo que pasa con `Genero` en GNP: empatarlos pide
 *     una tabla de equivalencias por formato que hoy no existe, y aproximar en
 *     un grupo excluyente está prohibido.
 *   - `Código CIE10Row1` y `Código CPT4` → no hay CIE-10 ni CPT en el expediente
 *     y **no se le pide al modelo que los deduzca** (04-MAPEO §3).
 *   - `Nombre del hospital` · `Ciudad` → no hay camino del informe al hospital, y
 *     hospital ≠ consultorio (04-MAPEO §3).
 *   - `Banco`, `Clabe interbancaria`, `No. Proveedor`, `Presupuesto…` → son
 *     datos administrativos del pago, no del expediente.
 *   - Los bloques de **Médico 1/2/3** (interconsultantes) → no somos nosotros.
 *   - `Texto7`, `Texto11`, `PresupuestoRow1` → cajas grandes sin rótulo impreso
 *     que la hoja no explica. Quedan CRUDAS y el médico escribe en ellas; nadie
 *     ha visto la hoja impresa para saber qué piden.
 */
import type { FieldDict } from '../types';

export const DICT_SURA: FieldDict = {
  // ── El paciente (p1) ──────────────────────────────────────────────────────
  'paciente.nombreCompleto': 'Apellido paterno materno y nombre del paciente',
  'paciente.edad': 'Edad',
  'paciente.numeroPoliza': 'Texto2', // rotulado «No. de póliza» en la hoja

  // ── Antecedentes y clínico ────────────────────────────────────────────────
  'antecedentes.patologicos': 'Antecedentes personales patológicosRow1',
  // 🔴 `Texto9` es la caja de la TALLA y `Texto10` la del PESO: sus nombres no
  // dicen nada y el rótulo impreso está a su izquierda. Verificado contra la
  // geometría, no deducido del orden.
  'vitales.talla': 'Texto9',
  'vitales.peso': 'Texto10',
  'clinico.diagnostico': 'Descripción del diagnóstico',

  // ── El médico tratante (p2) ───────────────────────────────────────────────
  // ⚠️ Este bloque es el del médico que FIRMA. Los de «Médico 1/2/3» de más
  // abajo son los interconsultantes y no se tocan.
  'medico.nombre': 'Apellido paterno materno y nombre del médico',
  'medico.especialidad': 'Especialidad',
  'medico.cedulaProfesional': 'Cédula profesional',
  'medico.cedulaEspecialidad': 'Texto14', // «No. cédula especialidad o certificación»
  'medico.telefono': 'Texto12', // «Teléfono»
  'medico.email': 'Texto15', // «E-Mail»
  // ⚠️ `RFC` NO se mapea: no hay concepto canónico `medico.rfc` (canonical.ts
  // sólo llega hasta `medico.domicilio`) y **este diccionario no es el lugar
  // para inventar uno** — agregarlo tocaría el canónico, que comparten los SEIS
  // formatos. Queda como campo CRUDO y lo teclea el médico.

  // ── El informe (p3) ───────────────────────────────────────────────────────
  'informe.lugarYFecha': 'Lugar y fecha',
};

/**
 * `nombre del campo -> lo que dice la HOJA` (08-ALTA §7b).
 *
 * 🔴 Aquí NO es cosmético: sin esto, 13 campos de un carácter llegan al modelo
 * como texto corriente sin decir de qué pregunta son, y los `Texto*` llegan sin
 * decir nada en absoluto. Es texto IMPRESO, no interpretación.
 */
/**
 * Los grupos EXCLUYENTES de casillas-de-texto (`FormatoEnRepo.opcionesDeTexto`).
 *
 * 🔴 Sin esto, nada impide que queden marcados el `Sí` **y** el `No` de
 * «¿Hubo complicaciones?»: son dos campos de texto independientes, y la
 * exclusividad estructural que da el PDF a una casilla de verdad —un campo, un
 * valor— aquí no existe. La hoja le afirmaría a la aseguradora las dos cosas.
 * El servidor lo impone (regla 0); la regla del prompt es sólo cortesía.
 */
export const OPCIONES_DE_TEXTO_SURA: Array<{ pregunta: string; campos: string[] }> = [
  { pregunta: '¿Hubo complicaciones?', campos: ['Si', 'No_3'] },
  {
    pregunta: 'Tipo de estancia',
    campos: ['Urgencia', 'Hospitalaria', 'Corta estanciaambulatoria'],
  },
  {
    pregunta: 'Médico 1 — tipo de participación',
    campos: ['Interconsultante', 'Cirujano', 'Anestesiólogo', 'Ayudantía'],
  },
  {
    pregunta: 'Médico 2 — tipo de participación',
    campos: ['Interconsultante_2', 'Cirujano_2', 'Anestesiólogo_2', 'Ayudantía_2'],
  },
  { pregunta: '¿Forma parte de nuestra red? — Médico 1', campos: ['Si_2', 'No_4'] },
  { pregunta: '¿Forma parte de nuestra red? — Médico 2', campos: ['Si_3', 'No_5'] },
  { pregunta: '¿Forma parte de nuestra red? — Médico 3', campos: ['Si_4', 'No_6'] },
];

export const ETIQUETAS_SURA: Record<string, string> = {
  // ── Las CASILLAS-DE-TEXTO (maxLength 1, se contestan con una «X») ─────────
  // 🔴 Cada una dice su PREGUNTA además de su opción: `Cirujano` y `Cirujano_2`
  // sólo se distinguían por el `_2`, y `Si`/`No_3` no decían de qué son.
  Si: '¿Hubo complicaciones? — marcar con X la opción «Si»',
  No_3: '¿Hubo complicaciones? — marcar con X la opción «No»',
  Urgencia: 'Tipo de estancia — marcar con X la opción «Urgencia»',
  Hospitalaria: 'Tipo de estancia — marcar con X la opción «Hospitalaria»',
  'Corta estanciaambulatoria':
    'Tipo de estancia — marcar con X la opción «Corta estancia / ambulatoria»',
  Interconsultante: 'Médico 1, tipo de participación — marcar con X «Interconsultante»',
  Cirujano: 'Médico 1, tipo de participación — marcar con X «Cirujano»',
  Anestesiólogo: 'Médico 1, tipo de participación — marcar con X «Anestesiólogo»',
  Ayudantía: 'Médico 1, tipo de participación — marcar con X «Ayudantía»',
  Interconsultante_2: 'Médico 2, tipo de participación — marcar con X «Interconsultante»',
  Cirujano_2: 'Médico 2, tipo de participación — marcar con X «Cirujano»',
  Anestesiólogo_2: 'Médico 2, tipo de participación — marcar con X «Anestesiólogo»',
  Ayudantía_2: 'Médico 2, tipo de participación — marcar con X «Ayudantía»',

  // ── Los `Texto*` sin rótulo en su nombre ──────────────────────────────────
  Texto3: 'Número de certificado',
  Texto4: 'Si el padecimiento se relaciona con otro: ¿cuál?',
  Texto5: 'Fecha de inicio del padecimiento — descripción',
  Texto6: 'Tratamiento / intervención quirúrgica realizada',
  Texto8: 'Tiempo de evolución del padecimiento: ¿cuál?',
  Texto13: 'Celular del médico tratante',

  // ── Las cajas de fecha ────────────────────────────────────────────────────
  // El nombre `Día_4` no dice de QUÉ fecha es, igual que en AXA (§7).
  //
  // 🔴 **NO prometen una fecha completa, y por eso la etiqueta no la nombra.**
  // Son UNA caja de 90×12 pt con las guías `Día`/`Mes`/`Año` impresas encima
  // (como el `Día_4` de AXA) **pero con `maxLength = 4`**, donde AXA admite 8.
  // En 4 caracteres no cabe `15/03/2025` ni `15032025`: el renderer intentaría
  // el rescate sin barras, tampoco cabría, y lo omitiría como
  // `no-cabe-en-el-campo` — el médico vería cinco fechas en pantalla y el PDF
  // saldría sin ninguna. Nadie ha visto una hoja de SURA llena, así que **no se
  // adivina qué espera** (¿sólo el año?): se dice lo que se sabe y quien mire la
  // hoja lo corrige. El catálogo ya le anuncia al modelo el tope de 4.
  Día: 'Fecha de inicio del padecimiento — ⚠️ la caja sólo admite 4 caracteres',
  Día_2: 'Fecha del diagnóstico — ⚠️ la caja sólo admite 4 caracteres',
  Día_3: 'Fecha del tratamiento o intervención — ⚠️ la caja sólo admite 4 caracteres',
  Día_4: 'Fecha de ingreso hospitalario — ⚠️ la caja sólo admite 4 caracteres',
  Día_5: 'Fecha de egreso hospitalario — ⚠️ la caja sólo admite 4 caracteres',

  // ── Los bloques de interconsultantes ─────────────────────────────────────
  'Apellido paterno materno y nombre sRow1': 'Nombre — Médico 1 (interconsultante)',
  'Apellido paterno materno y nombre sRow1_2': 'Nombre — Médico 2 (interconsultante)',
  'Apellido paterno materno y nombre sRow1_3': 'Nombre — Médico 3 (interconsultante)',
  EspecialidadRow1: 'Especialidad — Médico 1 (interconsultante)',
  EspecialidadRow1_2: 'Especialidad — Médico 2 (interconsultante)',
  EspecialidadRow1_3: 'Especialidad — Médico 3 (interconsultante)',
  'Cédula profesionalRow1': 'Cédula profesional — Médico 1 (interconsultante)',
  'Cédula profesionalRow1_2': 'Cédula profesional — Médico 2 (interconsultante)',
  'Cédula profesionalRow1_3': 'Cédula profesional — Médico 3 (interconsultante)',
  'Cédula de especialidadRow1': 'Cédula de especialidad — Médico 1 (interconsultante)',
  'Cédula de especialidadRow1_2': 'Cédula de especialidad — Médico 2 (interconsultante)',
  'Cédula de especialidadRow1_3': 'Cédula de especialidad — Médico 3 (interconsultante)',
  // 🔴 La pregunta impresa es **«¿Forma parte de nuestra red?»**, no «¿Acepta
  // tabulador?» — eso lo inventé yo en la primera versión, y además de ser
  // FALSO nombraba una declaración de facturación, que es justo la familia que
  // `casillasParaElAgente` bloquea… salvo que aquí son campos de TEXTO y esa
  // función no los ve. Es texto impreso, verificado contra la geometría.
  Si_2: '¿Forma parte de nuestra red? — Médico 1 (interconsultante), marcar con X «Si»',
  No_4: '¿Forma parte de nuestra red? — Médico 1 (interconsultante), marcar con X «No»',
  Si_3: '¿Forma parte de nuestra red? — Médico 2 (interconsultante), marcar con X «Si»',
  No_5: '¿Forma parte de nuestra red? — Médico 2 (interconsultante), marcar con X «No»',
  Si_4: '¿Forma parte de nuestra red? — Médico 3 (interconsultante), marcar con X «Si»',
  No_6: '¿Forma parte de nuestra red? — Médico 3 (interconsultante), marcar con X «No»',
  'Otra cuál': 'Otra participación, ¿cuál? — Médico 1 (interconsultante)',
  'Otra cuál_2': 'Otra participación, ¿cuál? — Médico 2 (interconsultante)',
  'Otra cuál_3': 'Otra participación, ¿cuál? — Médico 3 (interconsultante)',
};
