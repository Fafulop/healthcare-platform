/**
 * INFORME MÉDICO — PASO 4: el pre-llenado DETERMINISTA (02-PLAN §6, 04-MAPEO §2).
 *
 * Toma la ficha del paciente, la consulta y el médico, y produce el canónico ya
 * lleno. **Sin LLM y sin base de datos**: es una función pura y aburrida, y por
 * eso se puede verificar campo por campo.
 *
 * 🔴 A/B1/B2 NO pasan por el modelo "para simplificar" (01-FUENTES §3): meter un
 * dato determinista a un LLM lo vuelve probabilístico gratis. `dateOfBirth` no
 * se interpreta, se copia.
 *
 * 🔴 Un campo sin fuente se queda VACÍO y marcado (`origin: 'empty'`), nunca
 * adivinado. Un CIE-10 inventado en un documento médico-legal firmado por un
 * médico es el peor caso posible de esta funcionalidad.
 */
import { calcularEdad } from '@/lib/edad';
import { claveMedicamento, MAX_MEDICAMENTOS, type CampoMedicamento } from './canonical';
// 🔴 La ZONA de cada fecha se decide en un solo módulo, compartido con el texto
// que lee el modelo y con las etiquetas del panel. El FORMATO (`dd/mm/aaaa` con
// ceros) se queda aquí. Este import no rompe la pureza: el módulo no toca Prisma.
import { partesDelDiaDeFuente, partesDelDiaEnMexico } from './fechas-de-fuente';
import type { Answers, AnswerValue, FieldDict } from './types';

/** Lo que Prisma devuelve para una columna `Decimal` (o un número ya convertido). */
type Decimalish = number | string | { toString(): string } | null | undefined;

export interface PacienteInforme {
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date;
  sex: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  rfc?: string | null;
  bloodType?: string | null;
  currentAllergies?: string | null;
  currentChronicConditions?: string | null;
  currentMedications?: string | null;
  numeroPoliza?: string | null;
  polizaAseguradora?: string | null;
}

export interface ConsultaInforme {
  encounterDate: string | Date;
  chiefComplaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  vitalsBloodPressure?: string | null;
  vitalsHeartRate?: number | null;
  vitalsTemperature?: Decimalish;
  vitalsWeight?: Decimalish;
  vitalsHeight?: Decimalish;
  vitalsOxygenSat?: number | null;
}

export interface MedicoInforme {
  doctorFullName: string;
  /**
   * Los apellidos. Columna aparte de `doctorFullName` y **la única fuente
   * confiable** de ellos: ver `nombreDelMedico()`. Puede venir vacía.
   */
  lastName?: string | null;
  primarySpecialty?: string | null;
  cedulaProfesional?: string | null;
  /** `[{ titulo, cedula }]` — GNP y AXA piden la de especialidad por separado. */
  prescriptionCredentials?: unknown;
  clinicPhone?: string | null;
  clinicAddress?: string | null;
  city?: string | null;
  email?: string | null;
}

export interface MedicamentoInforme {
  drugName: string;
  presentation?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: string | null;
}

export interface EntradaPrefill {
  paciente: PacienteInforme;
  consulta: ConsultaInforme;
  medico: MedicoInforme;
  /** De las recetas de ESA consulta. Alimenta la tabla de 10 renglones de AXA. */
  medicamentos?: MedicamentoInforme[];
}

export interface ResultadoPrefill {
  answers: Answers;
  /**
   * Lo que el pre-llenado NO pudo trasladar entero. No es cosmético: si estos
   * avisos se tragan, el informe sale corto y nadie se entera.
   */
  avisos: AvisoPrefill[];
}

export type AvisoPrefill =
  | { tipo: 'medicamentos-truncados'; total: number; escritos: number }
  | { tipo: 'apellido-heuristico'; de: DeQuien; lastName: string; paterno: string; materno: string }
  | { tipo: 'apellido-unico'; de: DeQuien; lastName: string }
  | { tipo: 'sexo-desconocido'; valor: string }
  | { tipo: 'medico-sin-apellidos'; doctorFullName: string }
  | { tipo: 'medico-nombre-ambiguo'; doctorFullName: string; lastName: string };

/** De quién es el apellido que se partió a ojo. Los dos avisos aplican a los dos. */
export type DeQuien = 'paciente' | 'medico';

/** Los campos canónicos del nombre PARTIDO del médico. Hoy sólo GNP los pide. */
const CAMPOS_NOMBRE_MEDICO = [
  'medico.apellidoPaterno',
  'medico.apellidoMaterno',
  'medico.nombres',
] as const;

/**
 * 🔴 Los avisos que ESTE formato puede hacer accionables.
 *
 * `construirPrefillDeterminista` es agnóstico de la aseguradora —es lo que
 * permite que sea una función pura— así que produce los avisos del nombre del
 * médico siempre. Pero AXA y Allianz **no tienen casillas de apellido del
 * médico**: enseñarle ahí *"escríbelas aquí"* manda al doctor a buscar un campo
 * que no existe en su hoja, y encima en TODOS sus informes.
 *
 * Un aviso que sale siempre y no se puede atender es un contador que nunca da
 * cero: enseña a ignorar la barra de avisos, y entonces deja de servir para los
 * que sí importan (`medicamentos-truncados`). Misma regla que ya rige para
 * `sin-campo-en-el-formato` en el renderer.
 */
export function avisosDelFormato(avisos: AvisoPrefill[], dict: FieldDict): AvisoPrefill[] {
  const pideNombrePartido = CAMPOS_NOMBRE_MEDICO.some((c) => dict[c] !== undefined);
  if (pideNombrePartido) return avisos;
  return avisos.filter(
    (a) =>
      !(a.tipo === 'medico-sin-apellidos' || a.tipo === 'medico-nombre-ambiguo') &&
      !((a.tipo === 'apellido-heuristico' || a.tipo === 'apellido-unico') && a.de === 'medico')
  );
}

const SEXO: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' };

/** Un valor determinista con su procedencia. Cadena vacía ⇒ `empty` explícito. */
function det(valor: string | null | undefined, source: string): AnswerValue {
  const v = (valor ?? '').trim();
  return v === '' ? { value: '', source: null, origin: 'empty' } : { value: v, source, origin: 'deterministic' };
}

/**
 * `162.00` → `162`, `68.40` → `68.4`. Prisma devuelve los `Decimal` con los dos
 * decimales de la columna y "Peso: 68.40 kg" se lee como un dato tecleado por
 * una máquina, no por un médico.
 */
function decimal(v: Decimalish): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : v.toString();
  if (s.trim() === '') return null;
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** `162` + `cm` → `162 cm`. Sin valor, no hay unidad que poner. */
function conUnidad(v: string | null, unidad: string): string | null {
  return v === null ? null : `${v} ${unidad}`;
}

const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function ddmmaaaa(y: number, m: number, d: number): string {
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * dd/mm/aaaa de una columna **`@db.Date`** (`dateOfBirth`, `followUpDate`).
 *
 * Prisma las devuelve a **medianoche UTC**, así que el día calendario correcto
 * son los componentes **UTC**: leerlas en local en UTC-6 daría el día anterior.
 * Es el mismo cuidado que documenta `lib/edad.ts`.
 */
function fechaCalendario(d: string | Date): string | null {
  if (typeof d === 'string') {
    const [y, m, day] = d.split('T')[0].split('-').map(Number);
    // Sin guarda esto daría "NaN/NaN/NaN", que `det()` ve como texto y estampa
    // como `deterministic`: una fecha inventada presentada como "del
    // expediente". `null` cae al `empty` explícito, que es la regla.
    if (!y || !m || !day) return null;
    return ddmmaaaa(y, m, day);
  }
  if (Number.isNaN(d.getTime())) return null;
  return ddmmaaaa(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * dd/mm/aaaa de la fecha de la CONSULTA (`encounterDate`).
 *
 * 🔴 Esto usaba los componentes **locales del servidor**, y eso no es una zona:
 * es "la que tenga la máquina". En Railway (`TZ` sin poner ⇒ UTC) acertaba por
 * accidente con las 193/199 filas que están a medianoche UTC, y **fallaba en
 * local** —una máquina en México daba el día anterior— así que dev y prod no
 * coincidían. Y con las 6 filas que sí traen hora de verdad fallaba en los dos.
 *
 * La regla —medianoche UTC exacta ⇒ día de calendario, si no ⇒ instante en hora
 * de México— vive en `fechas-de-fuente.ts` y la comparten el pre-llenado, el
 * texto que lee el modelo y las etiquetas del panel. Antes estaba replicada, y
 * las copias no decían lo mismo.
 */
function fechaDeConsulta(d: string | Date): string | null {
  // Un `YYYY-MM-DD` pelón no trae hora ni zona: es un día calendario y ya.
  // (`new Date('2026-08-05')` sería medianoche UTC = el día 4 en local.)
  if (typeof d === 'string' && SOLO_DIA.test(d)) return fechaCalendario(d);
  const f = typeof d === 'string' ? new Date(d) : d;
  const p = partesDelDiaDeFuente(f, 'consulta');
  // `null` cae al `empty` explícito. Nunca un "undefined/undefined/NaN" firmado
  // como si viniera del expediente.
  return p === null ? null : ddmmaaaa(p.anio, p.mes, p.dia);
}

/**
 * dd/mm/aaaa de HOY, en hora de **México**.
 *
 * 🔴 Esto SÍ estaba roto en producción, todos los días. `hoy` es un instante de
 * verdad y se leía con componentes locales; con el contenedor en UTC, entre las
 * **18:00 y las 24:00 hora de México** el informe se emitía fechado **MAÑANA** —
 * en `informe.fecha` y `informe.lugarYFecha`, que es la fecha de emisión de un
 * documento que la aseguradora cruza contra el siniestro.
 */
function fechaDeHoy(ahora = new Date()): string | null {
  const p = partesDelDiaEnMexico(ahora);
  return p === null ? null : ddmmaaaa(p.anio, p.mes, p.dia);
}

/**
 * Parte `lastName` en paterno + materno.
 *
 * ⚠️ Es una HEURÍSTICA y falla con `de la Cruz`, `Ponce de León` y con pacientes
 * extranjeros de un solo apellido. `Patient` guarda los apellidos en UNA columna
 * y los tres formatos los piden partidos (04-MAPEO §4a). Se propone y el doctor
 * corrige; **no se parte en silencio** — de ahí el aviso.
 *
 * El `source` dice que viene de una heurística, pero el `origin` sigue siendo
 * `deterministic`: el conjunto de `origin` está CERRADO en tres lugares que ya
 * shipearon y un sexto valor rompería cualquier `switch` de la UI en silencio.
 */
function partirApellidos(
  lastName: string,
  de: DeQuien = 'paciente'
): { paterno: string; materno: string; aviso: AvisoPrefill | null } {
  const limpio = lastName.trim().replace(/\s+/g, ' ');
  const corte = limpio.lastIndexOf(' ');
  if (corte === -1) {
    return { paterno: limpio, materno: '', aviso: { tipo: 'apellido-unico', de, lastName: limpio } };
  }
  const paterno = limpio.slice(0, corte);
  const materno = limpio.slice(corte + 1);
  return { paterno, materno, aviso: { tipo: 'apellido-heuristico', de, lastName: limpio, paterno, materno } };
}

/** Para comparar nombres sin que un acento o una mayúscula decidan. */
function plano(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * 🔴 EL NOMBRE DEL MÉDICO, que NO se puede partir a ojo.
 *
 * `Doctor` guarda dos columnas y en prod se usan de dos maneras incompatibles
 * (medido sobre los 11 doctores, 2026-08-15):
 *
 * | `doctorFullName` | `lastName` | qué es |
 * |---|---|---|
 * | `Dra. Adriana Michelle` | `Treviño Figueroa` | el "full name" trae SÓLO los nombres de pila |
 * | `Dr. Gerardo Lopez Fafutis` | `Lopez Fafutis` | el "full name" trae todo y `lastName` repite |
 * | `Dra. Pamela Hernandez Arriaga` | *(vacío)* | **no hay apellidos que valgan** (4 de 11) |
 *
 * Partir `doctorFullName` por el último espacio —como se hace con el paciente—
 * daría `paterno = "Michelle"` y `paterno = "David"`: un nombre de pila impreso
 * en la casilla del apellido del médico que FIRMA el documento.
 *
 * ⇒ Los apellidos salen de `lastName` y los nombres de lo que sobra; cuando
 * `lastName` viene vacío los tres campos quedan **vacíos y avisados**, que es la
 * regla de esta carpeta: sin fuente, no se adivina.
 *
 * Y `completo` arregla de paso lo que AXA y Allianz ya imprimían mal: cuando el
 * "full name" no incluye los apellidos, se le AGREGAN — el título se conserva
 * porque en una hoja médica va bien.
 */
export function nombreDelMedico(
  doctorFullName: string,
  lastName: string | null | undefined
): { completo: string; nombres: string; paterno: string; materno: string; avisos: AvisoPrefill[] } {
  const avisos: AvisoPrefill[] = [];
  const limpio = (doctorFullName ?? '').trim().replace(/\s+/g, ' ');
  const sinTitulo = limpio.replace(/^(dr|dra|doctor|doctora|lic|mtro|mtra)\.?\s+/i, '').trim();
  const apellidos = (lastName ?? '').trim().replace(/\s+/g, ' ');

  if (apellidos === '') {
    // No hay de dónde: ni partiendo ni adivinando. Se avisa y se deja vacío.
    avisos.push({ tipo: 'medico-sin-apellidos', doctorFullName: limpio });
    return { completo: limpio, nombres: '', paterno: '', materno: '', avisos };
  }

  const { paterno, materno, aviso } = partirApellidos(apellidos, 'medico');
  if (aviso) avisos.push(aviso);

  // ¿El "full name" ya trae los apellidos, o sólo los nombres de pila?
  //
  // ⚠️ Se compara por PALABRAS, no por caracteres: un `endsWith` de texto hace
  // que `fffffffff` "contenga" el apellido `ff` y le recorte dos letras al
  // nombre. Los apellidos son palabras completas o no son.
  const palabras = sinTitulo.split(' ').filter((p) => p !== '');
  const palabrasApellido = apellidos.split(' ').filter((p) => p !== '');
  const cola = palabras.slice(-palabrasApellido.length);
  const yaLosTrae =
    palabras.length >= palabrasApellido.length &&
    plano(cola.join(' ')) === plano(palabrasApellido.join(' '));

  // 🔴 El caso de en medio: el "full name" trae ALGUNO de los apellidos pero no
  // todos (`Dra. Adriana Michelle Treviño` + `Treviño Figueroa`, o
  // `Dr. Gerardo Lopez Fafutis` + `Lopez`). Ahí no se puede ni recortar ni
  // agregar: agregar imprime `… Treviño Treviño Figueroa` en la línea de la
  // FIRMA, y recortar por longitud parte el nombre por donde no es.
  //
  // Los apellidos sí se saben (salen de `lastName`); lo que no se sabe son los
  // nombres de pila, así que se dejan vacíos y se avisa. Es la misma regla de
  // siempre: sin fuente confiable no se adivina, y menos en el campo con el que
  // la aseguradora identifica a quien firma.
  const solapaParcial =
    !yaLosTrae && palabrasApellido.some((a) => palabras.some((p) => plano(p) === plano(a)));
  if (solapaParcial) {
    avisos.push({ tipo: 'medico-nombre-ambiguo', doctorFullName: limpio, lastName: apellidos });
    return { completo: limpio, nombres: '', paterno, materno, avisos };
  }

  const nombres = yaLosTrae ? palabras.slice(0, palabras.length - palabrasApellido.length).join(' ') : sinTitulo;
  const completo = yaLosTrae ? limpio : `${limpio} ${apellidos}`.trim();

  return { completo, nombres, paterno, materno, avisos };
}

/** La cédula de especialidad sale de `prescriptionCredentials`: `[{ titulo, cedula }]`. */
function cedulaEspecialidad(credenciales: unknown, especialidad?: string | null): string | null {
  if (!Array.isArray(credenciales)) return null;
  const filas = credenciales.filter(
    (c): c is { titulo?: string; cedula?: string } => typeof c === 'object' && c !== null
  );
  const conCedula = filas.filter((c) => typeof c.cedula === 'string' && c.cedula.trim() !== '');
  if (conCedula.length === 0) return null;

  // La entrada de "médico general" es la cédula PROFESIONAL, no la de
  // especialidad: si se cuela aquí, el informe declara la misma cédula dos veces.
  const noGeneral = conCedula.filter((c) => !/general/i.test(c.titulo ?? ''));
  const candidatas = noGeneral.length > 0 ? noGeneral : [];
  if (candidatas.length === 0) return null;

  // Con varias especialidades no se puede saber cuál rige este informe salvo que
  // una empate con `primarySpecialty`. Sin empate se deja vacío y lo elige el
  // doctor: poner "la primera" es inventar cuál es la que ejerce en este caso.
  if (candidatas.length === 1) return candidatas[0].cedula!.trim();
  const esp = (especialidad ?? '').trim().toLowerCase();
  const exacta = esp === '' ? undefined : candidatas.find((c) => (c.titulo ?? '').trim().toLowerCase() === esp);
  return exacta ? exacta.cedula!.trim() : null;
}

/**
 * El canónico lleno con lo que SÍ sale del expediente sin interpretar nada.
 *
 * Lo que NO llena, a propósito (04-MAPEO §3): CIE-10, CPT, estadificación TNM,
 * presupuesto y el **hospital** — no hay camino desde el informe a un
 * `ClinicLocation`, y hospital y consultorio no son lo mismo.
 */
export function construirPrefillDeterminista(entrada: EntradaPrefill): ResultadoPrefill {
  const { paciente: p, consulta: c, medico: m } = entrada;
  const avisos: AvisoPrefill[] = [];
  const answers: Answers = {};

  // ── Identidad ─────────────────────────────────────────────────────────────
  const { paterno, materno, aviso } = partirApellidos(p.lastName);
  if (aviso) avisos.push(aviso);
  answers['paciente.apellidoPaterno'] = det(paterno, 'patient.lastName (heurística: último espacio)');
  answers['paciente.apellidoMaterno'] = det(materno, 'patient.lastName (heurística: último espacio)');
  answers['paciente.nombres'] = det(p.firstName, 'patient.firstName');
  answers['paciente.nombreCompleto'] = det(`${p.firstName} ${p.lastName}`, 'patient.firstName + patient.lastName');

  answers['paciente.fechaNacimiento'] = det(fechaCalendario(p.dateOfBirth), 'patient.dateOfBirth');
  const edad = calcularEdad(p.dateOfBirth);
  answers['paciente.edad'] = Number.isNaN(edad)
    ? { value: '', source: null, origin: 'empty' }
    : det(String(edad), 'patient.dateOfBirth (calculada)');

  const sexo = SEXO[(p.sex ?? '').toLowerCase()];
  if (!sexo && (p.sex ?? '').trim() !== '') avisos.push({ tipo: 'sexo-desconocido', valor: p.sex });
  answers['paciente.sexo'] = det(sexo ?? null, 'patient.sex');

  answers['paciente.telefono'] = det(p.phone, 'patient.phone');
  answers['paciente.email'] = det(p.email, 'patient.email');
  answers['paciente.domicilio'] = det(
    [p.address, p.city, p.state].map((x) => (x ?? '').trim()).filter(Boolean).join(', '),
    'patient.address + city + state'
  );
  answers['paciente.rfc'] = det(p.rfc, 'patient.rfc');
  answers['paciente.numeroPoliza'] = det(p.numeroPoliza, 'patient.numeroPoliza');
  answers['paciente.polizaAseguradora'] = det(p.polizaAseguradora, 'patient.polizaAseguradora');

  // ── Antecedentes de cabecera ──────────────────────────────────────────────
  answers['antecedentes.patologicos'] = det(p.currentChronicConditions, 'patient.currentChronicConditions');
  answers['antecedentes.alergias'] = det(p.currentAllergies, 'patient.currentAllergies');
  answers['antecedentes.medicacionHabitual'] = det(p.currentMedications, 'patient.currentMedications');
  answers['paciente.tipoSangre'] = det(p.bloodType, 'patient.bloodType');

  // ── La consulta ───────────────────────────────────────────────────────────
  answers['consulta.fecha'] = det(fechaDeConsulta(c.encounterDate), 'encounter.encounterDate');
  answers['consulta.motivo'] = det(c.chiefComplaint, 'encounter.chiefComplaint');

  // ── Vitales. Las unidades son las del expediente: talla en cm, peso en kg ──
  answers['vitales.talla'] = det(conUnidad(decimal(c.vitalsHeight), 'cm'), 'encounter.vitalsHeight');
  answers['vitales.peso'] = det(conUnidad(decimal(c.vitalsWeight), 'kg'), 'encounter.vitalsWeight');
  answers['vitales.tensionArterial'] = det(c.vitalsBloodPressure, 'encounter.vitalsBloodPressure');
  answers['vitales.frecuenciaCardiaca'] = det(
    c.vitalsHeartRate == null ? null : `${c.vitalsHeartRate} lpm`,
    'encounter.vitalsHeartRate'
  );
  answers['vitales.temperatura'] = det(conUnidad(decimal(c.vitalsTemperature), '°C'), 'encounter.vitalsTemperature');
  answers['vitales.saturacionOxigeno'] = det(
    c.vitalsOxygenSat == null ? null : `${c.vitalsOxygenSat} %`,
    'encounter.vitalsOxygenSat'
  );

  // ── SOAP. Nullable: sólo hay valor si el doctor trabajó en modo SOAP ───────
  answers['clinico.padecimientoActual'] = det(c.subjective, 'encounter.subjective');
  answers['clinico.exploracionFisica'] = det(c.objective, 'encounter.objective');
  // ⚠️ `assessment` es TEXTO LIBRE, no CIE-10. El expediente no tiene claves.
  answers['clinico.diagnostico'] = det(c.assessment, 'encounter.assessment');
  answers['clinico.tratamiento'] = det(c.plan, 'encounter.plan');

  // ── El médico ─────────────────────────────────────────────────────────────
  const nm = nombreDelMedico(m.doctorFullName, m.lastName);
  avisos.push(...nm.avisos);
  answers['medico.nombre'] = det(nm.completo, 'doctor.doctorFullName + doctor.lastName');
  answers['medico.apellidoPaterno'] = det(nm.paterno, 'doctor.lastName (partido a ojo)');
  answers['medico.apellidoMaterno'] = det(nm.materno, 'doctor.lastName (partido a ojo)');
  answers['medico.nombres'] = det(nm.nombres, 'doctor.doctorFullName sin los apellidos');
  answers['medico.especialidad'] = det(m.primarySpecialty, 'doctor.primarySpecialty');
  answers['medico.cedulaProfesional'] = det(m.cedulaProfesional, 'doctor.cedulaProfesional');
  answers['medico.cedulaEspecialidad'] = det(
    cedulaEspecialidad(m.prescriptionCredentials, m.primarySpecialty),
    'doctor.prescriptionCredentials'
  );
  answers['medico.telefono'] = det(m.clinicPhone, 'doctor.clinicPhone');
  answers['medico.email'] = det(m.email, 'doctor.user.email');
  answers['medico.domicilio'] = det(m.clinicAddress, 'doctor.clinicAddress');

  // ── El informe ────────────────────────────────────────────────────────────
  const hoy = fechaDeHoy();
  answers['informe.lugar'] = det(m.city, 'doctor.city');
  answers['informe.fecha'] = det(hoy, 'fecha de emisión');
  answers['informe.lugarYFecha'] = det(
    [m.city, hoy].map((x) => (x ?? '').trim()).filter(Boolean).join(', '),
    'doctor.city + fecha de emisión'
  );

  // ── Medicamentos ──────────────────────────────────────────────────────────
  const meds = entrada.medicamentos ?? [];
  const escritos = Math.min(meds.length, MAX_MEDICAMENTOS);
  if (meds.length > MAX_MEDICAMENTOS) {
    // 🔴 El resto NO cabe en el canónico. Callarlo deja un informe corto que se
    // ve completo: la UI tiene que decir cuáles faltan y que se anexen aparte.
    avisos.push({ tipo: 'medicamentos-truncados', total: meds.length, escritos });
  }
  for (let i = 0; i < escritos; i++) {
    const med = meds[i];
    const n = i + 1;
    const fuente = `prescription.medications[${i}]`;
    const valores: Record<CampoMedicamento, string | null> = {
      nombre: [med.drugName, med.presentation, med.dosage].map((x) => (x ?? '').trim()).filter(Boolean).join(' '),
      cantidad: med.quantity ?? null,
      frecuencia: med.frequency ?? null,
      duracion: med.duration ?? null,
    };
    for (const campo of Object.keys(valores) as CampoMedicamento[]) {
      answers[claveMedicamento(n, campo)] = det(valores[campo], `${fuente}.${campo}`);
    }
  }

  return { answers, avisos };
}
