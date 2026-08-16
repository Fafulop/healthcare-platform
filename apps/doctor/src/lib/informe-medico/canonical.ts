/**
 * INFORME MÉDICO — el esquema CANÓNICO (04-MAPEO §1).
 *
 *   expediente ──(1 mapeo, con lógica)──▶ CANÓNICO ──(1 diccionario tonto)──▶ PDF
 *
 * Sin el canónico en medio, agregar una aseguradora significa escribir otro
 * mapeo contra el esquema de la base, y cambiar una columna significa corregir
 * los N mapeos. Con él, agregar una aseguradora es escribir un diccionario
 * `campoCanónico -> nombre del campo AcroForm`, **sin tocar código**.
 *
 * ⚠️ El canónico es a propósito CHICO. Sólo entra lo que significa lo mismo en
 * todos los formatos (identidad, vitales, datos del médico). Las estructuras
 * propias de cada aseguradora —la tabla de 10 diagnósticos de AXA contra el
 * `Diagnóstico Definitivo` único de GNP— NO se fuerzan a un campo común: no son
 * el mismo concepto clínico y afirmar que sí lo son en un documento que firma un
 * médico es el error silencioso que sólo se descubre cuando lo rechazan
 * (04-MAPEO §1). Esos viven sólo en el diccionario de su formato.
 *
 * ⚠️ Y lo que no está NI en el canónico NI en el diccionario tampoco se pierde:
 * es un campo CRUDO (`campo:<nombre en el PDF>`, ver `types.ts`) y el doctor
 * puede escribir en él. El canónico decide qué se PRE-LLENA, no dónde se puede
 * teclear.
 */
import { esClaveCruda, nombrePdfDeClaveCruda } from './types';

/**
 * Los campos canónicos que el pre-llenado determinista sabe producir.
 * **Conjunto CERRADO**: si un formato pide algo que no está aquí, o se agrega
 * aquí con su fuente en el expediente, o se queda como campo propio del formato.
 */
export const CAMPOS_CANONICOS = {
  // ── Identidad del paciente ────────────────────────────────────────────────
  'paciente.apellidoPaterno': 'Apellido paterno',
  'paciente.apellidoMaterno': 'Apellido materno',
  'paciente.nombres': 'Nombre(s)',
  'paciente.nombreCompleto': 'Nombre completo',
  'paciente.fechaNacimiento': 'Fecha de nacimiento',
  'paciente.edad': 'Edad',
  'paciente.sexo': 'Sexo',
  'paciente.telefono': 'Teléfono del paciente',
  'paciente.email': 'Correo del paciente',
  'paciente.domicilio': 'Domicilio del paciente',
  'paciente.rfc': 'RFC del paciente',
  'paciente.numeroPoliza': 'Número de póliza',
  'paciente.polizaAseguradora': 'Aseguradora de la póliza',

  // ── Antecedentes de cabecera (columnas fijas de `patients`) ───────────────
  'antecedentes.patologicos': 'Antecedentes patológicos',
  'antecedentes.alergias': 'Alergias',
  'antecedentes.medicacionHabitual': 'Medicación habitual',
  'paciente.tipoSangre': 'Tipo de sangre',

  // ── La consulta (columnas fijas — B1 de 01-FUENTES) ───────────────────────
  'consulta.fecha': 'Fecha de la consulta',
  'consulta.motivo': 'Motivo de consulta',

  // ── Signos vitales (columnas propias, no viven en el JSON) ────────────────
  'vitales.talla': 'Talla',
  'vitales.peso': 'Peso',
  'vitales.tensionArterial': 'Tensión arterial',
  'vitales.frecuenciaCardiaca': 'Frecuencia cardiaca',
  'vitales.temperatura': 'Temperatura',
  'vitales.saturacionOxigeno': 'Saturación de oxígeno',

  // ── SOAP (B2: columnas reales, nullable) ──────────────────────────────────
  'clinico.padecimientoActual': 'Padecimiento actual',
  'clinico.exploracionFisica': 'Exploración física',
  'clinico.diagnostico': 'Diagnóstico',
  'clinico.tratamiento': 'Tratamiento',

  // ── El médico ─────────────────────────────────────────────────────────────
  'medico.nombre': 'Nombre del médico',
  // GNP pide el nombre del médico PARTIDO en tres, igual que el del paciente.
  // Se componen de `doctorFullName` + `lastName`, y quedan VACÍOS cuando la
  // ficha no trae apellidos — nunca se parte el nombre completo a ojo, porque
  // en prod ese campo a veces trae sólo los nombres de pila (`Dr. David`).
  'medico.apellidoPaterno': 'Apellido paterno del médico',
  'medico.apellidoMaterno': 'Apellido materno del médico',
  'medico.nombres': 'Nombre(s) del médico',
  'medico.especialidad': 'Especialidad',
  'medico.cedulaProfesional': 'Cédula profesional',
  'medico.cedulaEspecialidad': 'Cédula de especialidad',
  'medico.telefono': 'Teléfono del médico',
  'medico.email': 'Correo del médico',
  'medico.domicilio': 'Domicilio del consultorio',

  // ── El informe ────────────────────────────────────────────────────────────
  'informe.lugar': 'Lugar donde se emite',
  'informe.fecha': 'Fecha de emisión',
  'informe.lugarYFecha': 'Lugar y fecha',
} as const;

export type CampoCanonico = keyof typeof CAMPOS_CANONICOS;

/**
 * Cuántos renglones de la tabla de medicamentos soporta el canónico.
 *
 * Sale del formato más grande que hemos medido: AXA trae 10 renglones
 * (`Nombre y presentación…1..10`). Un formato con más renglones sube este
 * número; uno con menos simplemente no mapea los de sobra en su diccionario.
 */
export const MAX_MEDICAMENTOS = 10;

/**
 * Los campos de UN renglón de medicamento. Las claves reales llevan el índice
 * en medio: `medicamentos.1.nombre`, `medicamentos.2.cantidad`…
 *
 * El canónico necesita listas porque los formatos las piden (04-MAPEO §4c), y
 * el índice va en la CLAVE para que `FieldDict` siga siendo un mapa plano y el
 * renderer no tenga que aprender nada nuevo.
 */
export const CAMPOS_MEDICAMENTO = {
  nombre: 'Nombre y presentación',
  cantidad: 'Cantidad',
  frecuencia: 'Cada cuánto',
  duracion: 'Durante cuánto tiempo',
} as const;

export type CampoMedicamento = keyof typeof CAMPOS_MEDICAMENTO;

/** `medicamentos.3.frecuencia` — la clave canónica de un renglón. */
export function claveMedicamento(indice: number, campo: CampoMedicamento): string {
  return `medicamentos.${indice}.${campo}`;
}

/** La etiqueta en español de cualquier clave canónica, para la UI y la revisión. */
export function etiquetaCanonica(clave: string): string {
  // Un campo CRUDO se etiqueta con su propio nombre en el PDF. En AXA casi
  // todos son legibles (`Código ICD`, `Estadificación TNM`) porque el generador
  // tomó el texto de la etiqueta impresa; en GNP serán `P1_7` y ahí hará falta
  // el motor de vecindad del paso 3.
  if (esClaveCruda(clave)) return nombrePdfDeClaveCruda(clave);

  if (clave in CAMPOS_CANONICOS) return CAMPOS_CANONICOS[clave as CampoCanonico];

  const m = /^medicamentos\.(\d+)\.(\w+)$/.exec(clave);
  if (m && m[2] in CAMPOS_MEDICAMENTO) {
    return `${CAMPOS_MEDICAMENTO[m[2] as CampoMedicamento]} (medicamento ${m[1]})`;
  }
  return clave;
}
