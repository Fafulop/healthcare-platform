/**
 * Diccionario del formato **MetLife — Informe Médico `CC-1-020 VER5`** (4 págs).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔎 Bajado de `metlife.com.mx` (`Producer: Adobe PDF Library 15.0`, leído con
 * `updateMetadata: false`). Ya trae sus 164 campos (133 texto + 31 grupos de UNA
 * casilla). Rotula sus recuadros por la IZQUIERDA (08-ALTA §7d).
 *
 * ## 🔴 Las tres trampas de esta hoja
 *
 * **1. El campo `…1` de un bloque suele ser la COLA del renglón del rótulo, no
 * la primera línea de escritura.** Medido:
 *
 * | bloque | `…1` | `…2` | `…3` |
 * |---|---|---|---|
 * | `Detallar resultados de exploración física…` | **45 pt** | 567 pt | 567 pt |
 * | `a Principales signos síntomas…` | **311 pt** | 567 pt | 567 pt |
 * | `h Indicar el tratamiento…` | **165 pt** | 567 pt | 567 pt |
 *
 * La propuesta automática ofrecía el `…1` en los tres. Mapear ahí mete la
 * exploración física entera en una caja de 45 pt — es la caja de la TALLA de
 * Ve por Más otra vez. ⚠️ Y **no hay regla**: en `Antecedentes personales
 * patológicos` el `1` SÍ es la línea ancha, porque ahí el rótulo va en su propio
 * renglón. Hay que medir bloque por bloque.
 *
 * **2. Hay CUATRO bloques de médico y sólo uno es el nuestro.** La §6 de la hoja
 * es *Equipo quirúrgico* —`a) Anestesiólogo`, `b) Primer ayudante`, `c) Otro`,
 * `d) Otro`— y la §7 es *Datos del médico*. Sus campos se llaman
 * `Nombre completo_2/_3/_4` y `Cédula profesional especialidad`…`_5`, sin nada
 * en el nombre que diga de quién son. **El médico tratante es el bloque de la
 * §7**: `Nombre completo_4`, `Especialidad_3`, `Cédula profesional
 * especialidad_5`. La propuesta automática ofrecía `medico.especialidad →
 * "Especialidad"`, que es la del participante `c) Otro` — el mismo error que
 * `p2_RFC` en Allianz, que estaba en el bloque del médico (08-ALTA §8).
 *
 * **3. Dos campos llevan el nombre de un ENCABEZADO de sección** (`1 Datos del
 * paciente` es la caja de *Nombre completo*; `2 Antecedentes clínicos de
 * importancia` es la de *Historia clínica breve*). El primero se arregla
 * mapeándolo —la etiqueta pasa a salir del canónico—; el segundo, con
 * `ETIQUETAS_METLIFE`, porque no hay concepto canónico que le corresponda.
 *
 * ## ⚠️ Lo que NO se mapea, y por qué
 *
 *   - 🔴 **Todas las fechas.** La hoja las parte en TRES cajas (`D3`/`M3`/`A3`
 *     con `maxLength` 2/2/4) y el diccionario es 1:1: no sabe repartir un valor
 *     entre tres campos. Escribir `dd/mm/aaaa` en la caja del día sería un dato
 *     falso, no un dato apretado. Las llena el médico.
 *   - 🔴 **`medico.email`.** También va partido: `Correo electrónico_5` + la caja
 *     del dominio, con la `@` impresa en medio. Meter el correo completo en la
 *     primera mitad imprimiría `dr@ejemplo.mx @ ____`.
 *   - `h Indicar el tratamiento yo intervención quirúrgica…` → no se sabe, sin
 *     ver la hoja, si pide el tratamiento DADO o el PROPUESTO. `plan` es el
 *     propuesto y en AXA equivocarse ahí habría dicho algo falso. Mismo criterio
 *     que en `dicts/gnp.ts`, `dicts/allianz.ts` y `dicts/vepormas.ts`.
 *   - `Código CIE` → el expediente no tiene CIE-10 y **no se le pide al modelo
 *     que lo deduzca** (04-MAPEO §3).
 *   - `G` · `P` · `A` · `C` (gesta/para/aborto/cesárea) → no hay columna.
 *   - Los bloques del **equipo quirúrgico** (§6) → no somos nosotros.
 *   - `Tiempo de evolución`, `Causa / etiología`, `Descripción de la técnica`,
 *     los honorarios del pie → no hay columna del expediente que signifique eso.
 *     Son campos CRUDOS y el médico escribe en ellos igual.
 */
import type { FieldDict } from '../types';

export const DICT_METLIFE: FieldDict = {
  // ── El informe ────────────────────────────────────────────────────────────
  'informe.lugarYFecha': 'Lugar y fecha',

  // ── El paciente (p1) ──────────────────────────────────────────────────────
  // 🔴 Sí, se llama "1 Datos del paciente": es el ENCABEZADO de la sección
  // pegado a la caja de *Nombre completo* (el rótulo impreso a su izquierda).
  // Mapearlo es además lo que hace que el modelo la vea como "Nombre completo".
  'paciente.nombreCompleto': '1 Datos del paciente',
  'paciente.edad': 'EDAD',

  // ── Signos vitales (p1) ───────────────────────────────────────────────────
  // La hoja sólo pide estos dos.
  'vitales.peso': 'Peso',
  'vitales.talla': 'Talla',

  // ── Antecedentes y clínico ────────────────────────────────────────────────
  // Aquí el `1` SÍ es la línea ancha (567 pt): el rótulo va en su propio renglón.
  'antecedentes.patologicos': 'Antecedentes personales patológicos 1',
  // 🔴 El `…2`, no el `…1`: el `1` mide 311 pt porque es la cola del renglón del
  // rótulo. `subjective` es lo que el paciente cuenta, que es lo que pide.
  'clinico.padecimientoActual': 'a Principales signos síntomas y detalle de la evolución 2',
  // 🔴 Igual: el `…1` mide 45 pt. `objective` es la exploración.
  'clinico.exploracionFisica':
    'Detallar resultados de exploración física estudios de laboratorio yo gabinete que demuestren el diagnóstico referido 2',
  'clinico.diagnostico': 'd Diagnóstico etiológico definitivo',

  // ── El médico tratante — §7 «Datos del médico», NO el equipo quirúrgico ────
  'medico.nombre': 'Nombre completo_4',
  'medico.especialidad': 'Especialidad_3',
  'medico.cedulaProfesional': 'Cédula profesional especialidad_5',
  'medico.telefono': 'Teléfono del consultorio',
  'medico.domicilio': 'Domiclio consultorio', // (sic) — así lo escribió MetLife
};

/**
 * `nombre del campo -> lo que dice la HOJA`, para los campos CRUDOS cuyo nombre
 * miente o no distingue de quién es (08-ALTA §7b).
 *
 * 🔴 Sin esto, el modelo ve **cuatro** cajas rotuladas `Nombre completo` y no
 * puede saber cuál es la del médico tratante y cuáles las del equipo quirúrgico.
 * Es texto IMPRESO de la hoja, no interpretación.
 *
 * ⚠️ Los campos que SÍ tienen concepto canónico no se pisan: conservan la
 * etiqueta del canónico, que es la buena.
 */
export const ETIQUETAS_METLIFE: Record<string, string> = {
  // El encabezado de sección pegado a la caja de Historia clínica breve.
  '2 Antecedentes clínicos de importancia': 'Historia clínica breve',
  // Equipo quirúrgico (§6) — de quién es cada bloque.
  'Nombre completo_2': 'Nombre completo — a) Anestesiólogo',
  'Cédula profesional especialidad': 'Cédula profesional / especialidad — a) Anestesiólogo',
  'Correo electrónico': 'Correo electrónico — a) Anestesiólogo',
  'Nombre completo_3': 'Nombre completo — b) Primer ayudante',
  'Cédula profesional especialidad_2': 'Cédula profesional / especialidad — b) Primer ayudante',
  'Correo electrónico_2': 'Correo electrónico — b) Primer ayudante',
  'c Otro especificar tipo de participación 2': 'Nombre completo — c) Otro participante',
  'd Otro especificar tipo de participación 2': 'Nombre completo — d) Otro participante',
  Especialidad: 'Especialidad — c) Otro participante',
  Especialidad_2: 'Especialidad — d) Otro participante',
  'Cédula profesional especialidad_3': 'Cédula profesional / especialidad — c) Otro participante',
  'Cédula profesional especialidad_4': 'Cédula profesional / especialidad — d) Otro participante',
  'Correo electrónico_3': 'Correo electrónico — c) Otro participante',
  'Correo electrónico_4': 'Correo electrónico — d) Otro participante',
  'Correo electrónico_5': 'Correo electrónico — MÉDICO TRATANTE (§7)',
  // 🔴 Los `Número celular` y `Registro Federal de Contribuyentes` sólo se
  // distinguían por un `_N` sin significado. Cubrirlos a medias es PEOR que no
  // cubrirlos: rotular a) y b) e ir dejando el resto crudo insinúa que los
  // crudos son otra cosa. Van los cinco bloques completos.
  'Número celular': 'Número celular — a) Anestesiólogo',
  'Número celular_2': 'Número celular — b) Primer ayudante',
  'Número celular_3': 'Número celular — c) Otro participante',
  'Número celular_4': 'Número celular — d) Otro participante',
  'Número celular_5': 'Número celular — MÉDICO TRATANTE (§7)',
  'Registro Federal de Contribuyentes': 'RFC — a) Anestesiólogo',
  'Registro Federal de Contribuyentes_2': 'RFC — b) Primer ayudante',
  'Registro Federal de Contribuyentes_3': 'RFC — c) Otro participante',
  'Registro Federal de Contribuyentes_4': 'RFC — d) Otro participante',
  'Registro Federal de Contribuyentes_5': 'RFC — MÉDICO TRATANTE (§7)',
  // 🔴 Las cajas de la HOMOCLAVE del RFC: 3 caracteres, a la derecha de cada
  // RFC. Sin esto el motor las rotula por vecindad y sale un desastre:
  // `undefined_12` recibía la etiqueta «Teléfono del consultorio» —LA MISMA
  // cadena a la que este dict manda `medico.telefono`— así que el modelo podía
  // meter los 3 primeros dígitos del teléfono en la homoclave del tratante.
  // Los otros cuatro salían como «Nombre completo».
  undefined_3: 'Homoclave del RFC (3 posiciones) — a) Anestesiólogo',
  undefined_5: 'Homoclave del RFC (3 posiciones) — b) Primer ayudante',
  undefined_7: 'Homoclave del RFC (3 posiciones) — c) Otro participante',
  undefined_9: 'Homoclave del RFC (3 posiciones) — d) Otro participante',
  undefined_12: 'Homoclave del RFC (3 posiciones) — MÉDICO TRATANTE (§7)',
  // Y las mitades del dominio del correo, que se rotulaban sólo «@».
  undefined_4: 'Correo electrónico, dominio (después de la @) — a) Anestesiólogo',
  undefined_6: 'Correo electrónico, dominio (después de la @) — b) Primer ayudante',
  undefined_8: 'Correo electrónico, dominio (después de la @) — c) Otro participante',
  undefined_10: 'Correo electrónico, dominio (después de la @) — d) Otro participante',
  undefined_13: 'Correo electrónico, dominio (después de la @) — MÉDICO TRATANTE (§7)',
  // 🔴 La fórmula obstétrica. Sus nombres (`G`,`P`,`A`,`C`) SON lo que dice la
  // hoja, pero de una letra: `esOpaco()` los da por ilegibles —con razón, nadie
  // elige un campo llamado `A`— y sin esto llegan al modelo como `campo:A`.
  G: 'Gesta (fórmula obstétrica G / P / A / C)',
  P: 'Para (fórmula obstétrica G / P / A / C)',
  A: 'Abortos (fórmula obstétrica G / P / A / C)',
  C: 'Cesáreas (fórmula obstétrica G / P / A / C)',

  // ── 🔴 LAS FECHAS PARTIDAS EN TRES ────────────────────────────────────────
  // Cada fecha de esta hoja son TRES cajas (`D6`/`M6`/`A6`, maxLength 2/2/4).
  // Todas miden ≤3 caracteres de nombre, así que `esOpaco()` las manda a la
  // derivación por vecindad… que le da a las tres **la misma etiqueta**, porque
  // la pregunta impresa es una sola y `GUIA_DE_FECHA` descarta a propósito los
  // rótulos `Día`/`Mes`/`Año` (en AXA eran guías sobre UNA caja ancha, y
  // tomarlas daba tres campos rotulados «Mes»).
  //
  // Resultado medido: `D1`, `M1` y `A1` llegaban al modelo los tres como
  // «Lugar y fecha:». Con tres campos indistinguibles y topes 2/2/4, escribir
  // `03` (el día) en la caja del AÑO se acepta en silencio —2 ≤ 4— y la
  // aseguradora recibe una fecha falsa.
  //
  // El prefijo del nombre SÍ discrimina (D=día, M=mes, A=año), así que la
  // etiqueta lo dice explícitamente. El diccionario canónico sigue sin mapear
  // ninguna fecha —es 1:1 y no sabe repartir un valor en tres— pero el médico y
  // el asistente ya pueden llenarlas a mano sabiendo cuál es cuál.
  D1: 'Lugar y fecha — DÍA (2 dígitos)',
  M1: 'Lugar y fecha — MES (2 dígitos)',
  A1: 'Lugar y fecha — AÑO (4 dígitos)',
  D2: 'Fecha en que inició esta enfermedad / accidente / embarazo — DÍA (2 dígitos)',
  M2: 'Fecha en que inició esta enfermedad / accidente / embarazo — MES (2 dígitos)',
  A2: 'Fecha en que inició esta enfermedad / accidente / embarazo — AÑO (4 dígitos)',
  D2F: 'Fecha de inicio de principales signos y síntomas — DÍA (2 dígitos)',
  M2F: 'Fecha de inicio de principales signos y síntomas — MES (2 dígitos)',
  A2F: 'Fecha de inicio de principales signos y síntomas — AÑO (4 dígitos)',
  D3: 'e) Fecha de diagnóstico — DÍA (2 dígitos)',
  M3: 'e) Fecha de diagnóstico — MES (2 dígitos)',
  A3: 'e) Fecha de diagnóstico — AÑO (4 dígitos)',
  D4: 'f) Fecha de inicio de tratamiento — DÍA (2 dígitos)',
  M4: 'f) Fecha de inicio de tratamiento — MES (2 dígitos)',
  A4: 'f) Fecha de inicio de tratamiento — AÑO (4 dígitos)',
  D5: 'o) Fecha probable de alta o prealta — DÍA (2 dígitos)',
  M5: 'o) Fecha probable de alta o prealta — MES (2 dígitos)',
  A5: 'o) Fecha probable de alta o prealta — AÑO (4 dígitos)',
  D6: 'Fecha de ingreso — DÍA (2 dígitos)',
  M6: 'Fecha de ingreso — MES (2 dígitos)',
  A6: 'Fecha de ingreso — AÑO (4 dígitos)',
  D7: 'Fecha de intervención — DÍA (2 dígitos)',
  M7: 'Fecha de intervención — MES (2 dígitos)',
  A7: 'Fecha de intervención — AÑO (4 dígitos)',
  M8: 'Fecha (última del formato) — MES (2 dígitos)',
  A8: 'Fecha (última del formato) — AÑO (4 dígitos)',
  // Los «Detallar» que no dicen qué detallan. 🔴 Verificados contra el texto
  // IMPRESO, uno por uno: mi primera versión rotuló `Detallar_222` como
  // «complicaciones» y es FALSO — vive bajo la pregunta k) (insumos), mientras
  // que las complicaciones son la l) y tienen sus tres campos propios. Como el
  // mapa a mano PISA lo que deduce la geometría, ese rótulo falso habría ganado
  // y el modelo habría escrito la complicación bajo «¿utilizó insumos?».
  Detallar22: 'j) ¿Utilizó equipo especial para el procedimiento? — Detallar',
  Detallar_2: 'k) ¿Utilizó insumos y/o materiales para el procedimiento? — Detallar',
  Detallar_222: 'k) ¿Utilizó insumos y/o materiales para el procedimiento? — Detallar (continuación)',
  // La línea de firma del pie.
  FIRMA: 'Nombre completo y firma autógrafa del médico tratante',
};
