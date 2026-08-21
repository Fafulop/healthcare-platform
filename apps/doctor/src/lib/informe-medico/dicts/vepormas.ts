/**
 * Diccionario del formato **Ve por Más (BX+) — GMM Informe Médico `SM008`**.
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔎 Los nombres se leyeron del PDF que publica Ve por Más en su propio dominio
 * (`vepormas.com`, `Producer: Adobe PDF Library 15.0`, leído con
 * `updateMetadata: false`). Los puso la aseguradora y se explican solos, así que
 * **este formato no necesita mapa de `etiquetas`** — como AXA y GNP, y al revés
 * que Allianz.
 *
 * 🟢 **Y separa al paciente del médico en el propio nombre del campo**
 * (`Nombre`/`NombreDOC`, `ApellidoPaterno`/`ApellidoPaternoDOC`), que es
 * justamente el empate que en Allianz salió MAL: ahí `p2_RFC` empataba EXACTO y
 * vivía en el bloque del médico. Aquí no hay forma de confundirlos, y aun así
 * cada renglón se verificó contra la posición del campo en la hoja.
 *
 * 🔴🔴 **DOS CAMPOS DE ESTA HOJA VIENEN CON EL NOMBRE EQUIVOCADO DE FÁBRICA**, y
 * los dos se resolvieron leyendo el texto IMPRESO alrededor de la caja
 * (hallazgo del `/code-review`, verificado contra la geometría):
 *
 *   1. `Resultado de la exploración física y de los estudios anexar
 *      interpretaciones que confirmen diagnóstico` **es la caja de la TALLA**.
 *      Mide 31 pt, vive en el renglón de los vitales y encima suyo está impreso
 *      `Talla_______cms.`; el nombre es el ENCABEZADO de la sección de arriba.
 *   2. `Antecedentes perinatales 4` (573 pt de ancho) **es la caja de
 *      PADECIMIENTO ACTUAL**: está justo debajo de ese encabezado impreso. El
 *      cuarto renglón perinatal de verdad es `Antecedentes perinatales_4`, con
 *      guión bajo y 280 pt — dos nombres casi idénticos para dos cosas
 *      distintas.
 *
 * 🔴 **Y no bastaba con NO mapearlos.** Un campo sin concepto canónico sigue
 * ofreciéndosele al modelo como campo CRUDO **con su nombre del PDF de
 * etiqueta**: el catálogo decía literalmente «Resultado de la exploración
 * física…» sobre una caja de 10 caracteres que imprime en `Talla (cms.)`. El
 * médico dicta la exploración, el modelo elige el campo cuyo nombre lo dice, y
 * la exploración acaba en la talla. Es `Mts.` sobre la tensión arterial otra
 * vez — sólo que aquí *dejarlo sin mapear era la trampa*, no la salida.
 * **Mapearlos a su concepto real es lo que borra el rótulo falso**, porque la
 * etiqueta pasa a salir del canónico.
 *
 * ⚠️ Lo que NO se mapea, y por qué:
 *
 *   - 🔴 `Descripción del tratamiento yo intervención quirúrgica` → no se sabe,
 *     sin ver la hoja, si pregunta por el tratamiento DADO o el PROPUESTO.
 *     `plan` es el propuesto, y en AXA equivocarse ahí habría dicho algo falso.
 *     Mismo criterio que en `dicts/gnp.ts` y `dicts/allianz.ts`.
 *   - `Código CIE10` y `Código CPT4` → el expediente no tiene CIE-10 ni CPT y
 *     **no se le pide al modelo que los deduzca** (04-MAPEO §3).
 *   - `NombreHospital` · `Ciudad y estado` · `Hospital en que se realizará` → no
 *     hay camino del informe al hospital, y hospital ≠ consultorio (04-MAPEO §3).
 *   - `Fecha de inicio` · `Fecha de diagnóstico` · `FechaIngreso` ·
 *     `FechaEngreso` · `FechaIntervencion` · `Fecha exacta de la cirugía` → son
 *     fechas del PADECIMIENTO y el expediente no las guarda. **La fecha de la
 *     consulta no es ninguna de ellas**: escribirla ahí es el error que el chat
 *     cometió una vez (06-AGENTE §11).
 *   - `RFC01`…`RFC13` → el RFC del MÉDICO repartido en 13 cajas de un carácter.
 *     El diccionario es 1:1 y no sabe partir un valor; además no hay canónico
 *     `medico.rfc`. Lo teclea el médico.
 *   - `Folio` · `No de proveedor` · `Si la respuesta fue afirmativa indique el
 *     número de convenio` → son datos de la ASEGURADORA, no del expediente.
 *   - `Ocupación`, `FR`, `Interconsultas`, `Observaciones`, `Duración del
 *     tratamiento`, `Descripción de las complicaciones`, los honorarios
 *     (`Cirujano`, `Ayudante`, `Anestesiólogo`), `Antecedentes GinecoObstetricos`,
 *     `Antecedentes perinatales`, `Antecedentes personales no patológicos` → no
 *     hay columna del expediente que signifique eso. Son campos CRUDOS y el
 *     médico escribe en ellos igual (SESSION-REFRESCO, 2026-08-09).
 *
 * ⚠️ **Las 27 opciones de la hoja son grupos de UNA sola casilla**, así que el
 * asistente no ve ninguna: la regla 2 de `casillasParaElAgente` bloquea los
 * grupos donde el modelo sólo puede MARCAR y nunca negar. Las marca el médico.
 * Y esta hoja rotula sus recuadros por la IZQUIERDA — ver 08-ALTA §7d.
 */
import type { FieldDict } from '../types';

export const DICT_VEPORMAS: FieldDict = {
  // ── El paciente (p1) ──────────────────────────────────────────────────────
  'paciente.nombres': 'Nombre',
  'paciente.apellidoPaterno': 'ApellidoPaterno',
  'paciente.apellidoMaterno': 'ApellidoMaterno',
  'paciente.edad': 'Edad',
  'paciente.numeroPoliza': 'No de Póliza',

  // ── Antecedentes y clínico (p1) ───────────────────────────────────────────
  // La hoja da CUATRO renglones; el canónico es un solo texto y entra en el
  // primero. Los otros tres quedan crudos para que el médico siga la lista.
  'antecedentes.patologicos': 'Antecedentes personales patológicos con fecha de inicio 1',
  // 🔴 SÍ, el nombre dice "perinatales" y NO es un error de dedo: esta caja de
  // 573 pt está impresa bajo el encabezado **Padecimiento actual**, y el cuarto
  // renglón perinatal de verdad es `Antecedentes perinatales_4` (con guión bajo,
  // 280 pt). Lo nombró mal la aseguradora. Mapearlo aquí es además lo que hace
  // que el modelo lo vea como "Padecimiento actual" y no como un antecedente.
  // `Principales signos y síntomas` se queda CRUDO: su nombre sí es correcto y
  // el médico escribe ahí los signos, que no son el mismo campo que `subjective`.
  'clinico.padecimientoActual': 'Antecedentes perinatales 4',
  // Ve por Más pide UN diagnóstico, no la tabla de 10 de AXA. Va junto a
  // `Código CIE10` y a su fecha, las dos sin fuente en el expediente.
  'clinico.diagnostico': 'Descripción del diagnóstico',

  // ── Signos vitales (p1, el renglón de cajas angostas) ─────────────────────
  // El renglón impreso es:
  //   Talla____cms. · Peso____Kg. · T/A____mm/Hg · FC:____x’ · FR:____x’ · T____C
  // 🔴 `Resultado de la exploración física…` es el nombre del ENCABEZADO de
  // arriba pegado a la caja de la TALLA. Mapearlo aquí es lo que impide que el
  // modelo escriba la exploración física dentro de la talla — ver el encabezado.
  'vitales.talla': 'Resultado de la exploración física y de los estudios anexar interpretaciones que confirmen diagnóstico',
  'vitales.peso': 'Peso',
  'vitales.tensionArterial': 'TA',
  'vitales.frecuenciaCardiaca': 'FC',
  // `T` a secas: el impreso dice `T________C`, grados centígrados. La talla
  // tiene su propia caja (arriba), así que no hay con qué confundirla.
  'vitales.temperatura': 'T',
  // `FR` (frecuencia respiratoria) no tiene concepto canónico: queda crudo.

  // ── El médico (p2) ────────────────────────────────────────────────────────
  // Los tres salen de `nombreDelMedico()` y quedan VACÍOS —con aviso— cuando el
  // perfil no trae los apellidos en su propia columna: partir `doctorFullName`
  // a ojo daba `paterno = "Michelle"` (04-MAPEO §4a-bis).
  'medico.nombres': 'NombreDOC',
  'medico.apellidoPaterno': 'ApellidoPaternoDOC',
  'medico.apellidoMaterno': 'ApellidoMaternoDOC',
  'medico.especialidad': 'Especialidad',
  'medico.cedulaProfesional': 'Cédula Profesional',
  // La hoja rotula esta caja `Cédula de Especialidad / certificación` (impreso
  // 13 pt por encima, que es la separación de TODAS las etiquetas de este
  // bloque: Especialidad 336→322, Cédula Profesional 311→297). Sin ese impreso
  // el nombre `Cédula` a secas no alcanzaba para distinguirla de la profesional.
  'medico.cedulaEspecialidad': 'Cédula',
  // ⚠️ `Teléfono` y `Email` a secas son justo los términos que se quitaron del
  // emparejador automático por no decir DE QUIÉN son (08-ALTA §8). Se mapean
  // porque la POSICIÓN los resuelve, y cada uno por su cuenta:
  //   `Teléfono` (p2 y=322) comparte renglón con `Especialidad` — del médico.
  //   `Email`    (p2 y=248) NO: su renglón es el de `No. de proveedor`, pero
  //              sigue dentro del bloque del médico (que va de y=347 a y=248) y
  //              su etiqueta impresa, justo encima, dice `Email`.
  'medico.telefono': 'Teléfono',
  'medico.email': 'Email',
  // La línea de firma al pie de la hoja.
  'medico.nombre': 'NombreYFirma01',
};
