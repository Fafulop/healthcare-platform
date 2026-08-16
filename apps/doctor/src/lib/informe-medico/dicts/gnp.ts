/**
 * Diccionario del formato **GNP — Informe Médico GMM** (el OFICIAL, 62 campos).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1).
 *
 * 🔎 Los nombres se leyeron del PDF que publica GNP en su propio dominio
 * (`Producer: Adobe PDF library 15.00`, leído con `updateMetadata: false`), no
 * de los docs ni del PDF de Eleonor. **Y desmienten lo que 02-PLAN §3 decía de
 * GNP** —"puramente posicional, `P1_7`, `P2_15`, cero semántica"—: eso era el
 * archivo del TERCERO. El oficial trae nombres tan buenos como los de AXA
 * (`Apellido paterno`, `Diagnóstico Definitivo`, `Cédula profesional`), así que
 * este formato **no necesita mapa de `etiquetas`**.
 *
 * ⚠️ Lo que NO se mapea, y por qué:
 *
 *   - `Código ICD` y `CPT` → el expediente no tiene CIE-10 ni CPT. Se quedan
 *     vacíos y los teclea el médico; **no se le pide al modelo que los deduzca**
 *     (04-MAPEO §3).
 *   - `Presupuesto` → no existe en el expediente.
 *   - `Hospital` · `Ciudad` · `Estado` → no hay camino del informe al hospital, y
 *     hospital ≠ consultorio (04-MAPEO §3).
 *   - `Fecha Inicio` · `Fecha diagnóstico` · `Fecha tratamiento` · `Fecha ingreso`
 *     → son fechas del PADECIMIENTO, y el expediente no las guarda. La fecha de
 *     la consulta NO es ninguna de ellas: escribirla ahí es justo el error que el
 *     chat cometió una vez (`06-AGENTE` §11).
 *   - `Tratamiento` → 🔴 sin ver la hoja no se sabe si GNP pregunta por el
 *     tratamiento DADO o por el PROPUESTO. `plan` es el propuesto y en AXA
 *     equivocarse ahí habría dicho algo falso, así que se deja al médico hasta
 *     que alguien mire el renglón (mismo criterio que en `dicts/allianz.ts`).
 *   - `Padecimiento relacionado`, `Antecedentes No Patológicos`,
 *     `Antecedentes gineco-obstétricos`, `Antecedentes perinatales`,
 *     `Información adicional`, `Descripción de complicaciones` → no hay columna
 *     del expediente que signifique eso.
 *   - Los bloques de médico `_2` y `_3` → son los interconsultantes, no nosotros.
 *   - `Genero` → 🔴 es un RADIO cuyas opciones son `M`/`F`, y el canónico
 *     entrega `"Masculino"`. Empatarlos pediría una tabla de equivalencias por
 *     formato que hoy no existe, y aproximar en un grupo excluyente está
 *     prohibido: el médico lo marca de un clic. Ver SESSION-REFRESCO.
 */
import type { FieldDict } from '../types';

export const DICT_GNP: FieldDict = {
  // ── El paciente (p1) ──────────────────────────────────────────────────────
  // Sin ambigüedad con el bloque del médico: allá los campos se llaman
  // `Apellido paterno del médico`. Es el empate que en Allianz salió MAL
  // (`p2_RFC` estaba en el bloque del médico) y aquí sí se verificó campo a campo.
  'paciente.apellidoPaterno': 'Apellido paterno',
  'paciente.apellidoMaterno': 'Apellido materno',
  'paciente.nombres': 'Nombre',
  'paciente.fechaNacimiento': 'Fecha Nacimiento',   // maxLength 10 ⇒ dd/mm/aaaa cabe justo
  'paciente.edad': 'Edad',                          // maxLength 3
  'paciente.numeroPoliza': 'No de Póliza',

  // ── Antecedentes y clínico (p1) ───────────────────────────────────────────
  'antecedentes.patologicos': 'Antecedentes Patológicos',
  'clinico.padecimientoActual': 'Padecimiento actual',
  // GNP pide UN diagnóstico definitivo, no la tabla de 10 de AXA. `assessment`
  // es texto libre y cabe: el campo es multilínea de 407×64.
  'clinico.diagnostico': 'Diagnóstico Definitivo',
  // La hoja lo rotula "Resultado de exploración física y de los estudios
  // realizados". `objective` es la exploración; los estudios los agrega el
  // médico si hace falta — por eso se mapea y no se deja vacío.
  'clinico.exploracionFisica': 'Resultado del estudio',

  // ── El médico (p2, PRIMER bloque) ─────────────────────────────────────────
  // GNP lo pide partido en tres. Los tres salen de `nombreDelMedico()` y quedan
  // VACÍOS —con aviso— cuando el perfil no trae apellidos en su propia columna.
  'medico.apellidoPaterno': 'Apellido paterno del médico',
  'medico.apellidoMaterno': 'Apellido materno del médico',
  'medico.nombres': 'Nombres del médico tratante',
  'medico.especialidad': 'Especialidad',
  'medico.cedulaProfesional': 'Cédula profesional',
  'medico.cedulaEspecialidad': 'Cédula Especialidad',
  // ⚠️ maxLength 10: un teléfono con paréntesis o guiones (`(33) 1234-5678`) no
  // cabe y se OMITE con reporte, nunca recortado a medias.
  'medico.telefono': 'Teléfono Médico',
  'medico.email': 'Correo del Médico',
  'medico.nombre': 'Nombre y firma del médico tratante',

  // ── El informe ────────────────────────────────────────────────────────────
  // GNP no tiene cajas sueltas de lugar y fecha: trae una sola al pie.
  'informe.lugarYFecha': 'Lugar y fecha',
};
