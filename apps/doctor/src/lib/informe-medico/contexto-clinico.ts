/**
 * El expediente en TEXTO, para dárselo a un modelo.
 *
 * Compartido por el DICTADO y el CHAT: los dos le pasan expediente al LLM y los
 * dos tienen que armarlo igual. Estaba en línea dentro de `dictar/route.ts`.
 *
 * 🔴 La regla de alcance (06-AGENTE §7 · 07-PLAN §4): esto se llama **sólo** con
 * material del MISMO paciente y del MISMO doctor — el `where` lo comprueba, no se
 * confía en los ids que mande el cliente.
 *
 * 07-PLAN: el informe se hace a nivel PACIENTE. Sigue anclado a UNA consulta —la
 * que da el pre-llenado 🟩 verde— y el doctor ELIGE además otras consultas, notas
 * y recetas. Todo lo elegido entra por aquí, en orden cronológico, y lo que el
 * modelo saque de ahí cae en 🟧 ámbar.
 */
import { prisma } from '@healthcare/database';

export interface ConsultaParaModelo {
  titulo: string;
  contenido: string;
}

/** Tope duro de consultas por llamada del DICTADO: el prompt no crece sin límite. */
export const MAX_CONSULTAS = 5;

/** La zona del negocio. El servidor corre en UTC; "hoy" nunca es UTC aquí. */
const MX_TZ = 'America/Mexico_City';

/** Los tres tipos de fuente (07-PLAN §4). `PatientMedia` y `PatientSummary` NO
 * son fuente: de un estudio no se puede leer el contenido, y resumir un resumen
 * de IA con otra IA deja la procedencia sin significado (07-PLAN §10). */
export type TipoFuente = 'consulta' | 'nota' | 'receta';

/** Lo que se guarda en `medical_reports.sources`: una INSTANTÁNEA, no una FK. */
export interface FuenteElegida {
  tipo: TipoFuente;
  id: string;
  /** La fecha clínica de la fuente (ISO), para ordenar sin volver a la base. */
  fecha: string;
  /** Cuándo se actualizó por última vez cuando se eligió: deja ver la deriva. */
  actualizadoEn: string;
}

/** Una fuente ya convertida a texto, lista para el prompt. */
export interface FuenteParaModelo {
  tipo: TipoFuente;
  id: string;
  titulo: string;
  contenido: string;
  /** Para ordenar cronológicamente y para mostrarla en el panel. */
  fecha: Date;
  /** Cuándo se actualizó la fila. Es lo que deja ver la DERIVA: si la nota se
   * editó después de elegirla, el id solo no dice que el modelo vio otra cosa. */
  actualizadoEn: Date;
  tokensAprox: number;
}

/**
 * 🔴 El presupuesto del bloque de fuentes (07-PLAN §11).
 *
 * NO es un límite técnico —gpt-4o admite 128k y el prompt real mide ~6,600
 * tokens— ni de costo (~$0.03 por turno). Es de **calidad**: un prompt más largo
 * diluye la atención del modelo, que ya tiene que elegir entre 255 campos.
 *
 * ⚠️ Y no aplica al ANCLA: esa entra siempre y el doctor no la puede quitar, así
 * que si contara, un informe podría quedar imposible de conversar sin arreglo.
 * El presupuesto rige lo que el doctor SÍ puede deseleccionar.
 */
export const PRESUPUESTO_TOKENS_FUENTES = 6000;

/**
 * Tokens aproximados de un texto en español. ~4 caracteres por token es la regla
 * de dedo de los tokenizadores BPE; se usa para un PRESUPUESTO, no para facturar,
 * y basta con que no se quede corta.
 */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

/** `EncounterTemplate.customFields` → `nombre del campo -> etiqueta que ve el doctor`. */
function etiquetasDePlantilla(customFields: unknown): Map<string, string> {
  const campos = Array.isArray(customFields) ? customFields : [];
  const etiquetaDe = new Map<string, string>();
  for (const f of campos as Array<{ name?: string; label?: string; labelEs?: string }>) {
    if (f?.name) etiquetaDe.set(f.name, f.labelEs || f.label || f.name);
  }
  return etiquetaDe;
}

/**
 * `customData` con las ETIQUETAS de su plantilla, no con las claves crudas: se le
 * entrega al modelo "Tipo de Lesión: nevo displásico", no "tipoLesion: nevo".
 */
function lineasDeCustomData(customData: unknown, customFields: unknown): string[] {
  const etiquetaDe = etiquetasDePlantilla(customFields);
  const custom = (customData ?? {}) as Record<string, unknown>;
  if (typeof custom !== 'object' || custom === null || Array.isArray(custom)) return [];
  const lineas: string[] = [];
  for (const [k, v] of Object.entries(custom)) {
    if (v === null || v === undefined || v === '') continue;
    lineas.push(`${etiquetaDe.get(k) ?? k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  }
  return lineas;
}

/**
 * 🔴 La fecha SIEMPRE con la zona explícita, que es la convención del repo
 * (`agenda-agent/dates.ts`, facturas, fiscal). Estos son timestamps con hora —no
 * `@db.Date`— y el servidor corre en UTC: con `toISOString()` una consulta de las
 * 6 de la tarde en CDMX se le presenta al modelo fechada al DÍA SIGUIENTE, que es
 * el campo que la aseguradora cruza contra la fecha del siniestro.
 */
function fechaMx(d: Date): string {
  return d.toLocaleDateString('es-MX', { timeZone: MX_TZ });
}

// ── Las tres fuentes → texto ────────────────────────────────────────────────

type ConsultaConPlantilla = {
  id: string; encounterDate: Date; chiefComplaint: string | null;
  subjective: string | null; objective: string | null; assessment: string | null;
  plan: string | null; clinicalNotes: string | null; customData: unknown;
  vitalsBloodPressure: string | null; vitalsHeartRate: number | null;
  vitalsTemperature: unknown; vitalsWeight: unknown; vitalsHeight: unknown;
  vitalsOxygenSat: number | null; vitalsOther: string | null;
  template: { name: string; customFields: unknown } | null;
};

function textoDeConsulta(e: ConsultaConPlantilla): { titulo: string; contenido: string } {
  const partes: string[] = [];
  if (e.chiefComplaint) partes.push(`Motivo de consulta: ${e.chiefComplaint}`);
  for (const [k, v] of [
    ['Padecimiento actual', e.subjective], ['Exploración física', e.objective],
    ['Diagnóstico', e.assessment], ['Tratamiento', e.plan], ['Notas', e.clinicalNotes],
  ] as Array<[string, string | null]>) if (v) partes.push(`${k}: ${v}`);

  // Los signos vitales: el pre-llenado los copia del ANCLA, pero de una consulta
  // ADJUNTA nadie los lee — y "la tensión de hace tres meses" es justo lo que la
  // aseguradora pregunta en la evolución.
  const vitales: string[] = [];
  const num = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v);
  for (const [k, v] of [
    ['TA', e.vitalsBloodPressure], ['FC', num(e.vitalsHeartRate)],
    ['Temp', num(e.vitalsTemperature)], ['Peso', num(e.vitalsWeight)],
    ['Talla', num(e.vitalsHeight)], ['SpO2', num(e.vitalsOxygenSat)],
    ['Otros', e.vitalsOther],
  ] as Array<[string, string | null]>) if (v !== null && v !== '') vitales.push(`${k}: ${v}`);
  if (vitales.length > 0) partes.push(`Signos vitales: ${vitales.join(' · ')}`);

  partes.push(...lineasDeCustomData(e.customData, e.template?.customFields));

  return {
    titulo: `Consulta del ${fechaMx(e.encounterDate)}${e.template?.name ? ` (${e.template.name})` : ''}`,
    contenido: partes.join('\n'),
  };
}

type NotaDelPaciente = { id: string; content: string; createdAt: Date; updatedAt: Date };

function textoDeNota(n: NotaDelPaciente): { titulo: string; contenido: string } {
  return {
    titulo: `Nota del ${fechaMx(n.createdAt)}`,
    contenido: n.content.trim(),
  };
}

type RecetaConMedicamentos = {
  id: string; prescriptionDate: Date; diagnosis: string | null;
  clinicalNotes: string | null; customData: unknown;
  template: { name: string; customFields: unknown } | null;
  medications: Array<{
    drugName: string; presentation: string | null; dosage: string;
    frequency: string; duration: string | null; instructions: string;
  }>;
};

function textoDeReceta(r: RecetaConMedicamentos): { titulo: string; contenido: string } {
  const partes: string[] = [];
  if (r.diagnosis) partes.push(`Diagnóstico: ${r.diagnosis}`);
  if (r.clinicalNotes) partes.push(`Notas: ${r.clinicalNotes}`);
  for (const m of r.medications) {
    const detalle = [m.presentation, m.dosage, m.frequency, m.duration, m.instructions]
      .filter((x) => x && String(x).trim() !== '')
      .join(' · ');
    partes.push(`Medicamento: ${m.drugName}${detalle ? ` — ${detalle}` : ''}`);
  }
  partes.push(...lineasDeCustomData(r.customData, r.template?.customFields));
  return {
    titulo: `Receta del ${fechaMx(r.prescriptionDate)}${r.template?.name ? ` (${r.template.name})` : ''}`,
    contenido: partes.join('\n'),
  };
}

// ── El catálogo: qué puede elegir el doctor ─────────────────────────────────

/** Una fuente disponible, para el panel. Sin contenido clínico: el panel sólo
 * necesita reconocerla, y mandar el expediente entero para pintar una lista de
 * casillas es PHI que no hace falta mover. */
export interface FuenteDisponible {
  tipo: TipoFuente;
  id: string;
  fecha: string;
  actualizadoEn: string;
  titulo: string;
  /** Primera línea, recortada: para reconocerla de un vistazo. */
  resumen: string;
  /** Lo que ocupa en el prompt, para que el panel enseñe el presupuesto. */
  tokensAprox: number;
}

function resumirse(contenido: string): string {
  const limpia = contenido.replace(/\s+/g, ' ').trim();
  return limpia.length > 140 ? `${limpia.slice(0, 139)}…` : limpia;
}

/**
 * Todo lo que el doctor puede elegir como fuente, del más reciente al más viejo
 * (que es como se busca en una lista) — el orden CRONOLÓGICO ascendente se aplica
 * al armar el prompt, no aquí.
 *
 * 🔴 Sólo recetas `issued` y `expired` (07-PLAN §4). Una receta en `draft` **no
 * fue** el tratamiento del paciente, y declararla a la aseguradora es afirmar
 * algo falso. Es la misma regla del pre-llenado. La vencida sí cuenta: fue
 * tratamiento, que hoy esté vencida no la borra de la historia.
 */
export async function catalogoDeFuentes(
  patientId: string,
  doctorId: string
): Promise<FuenteDisponible[]> {
  const [consultas, notas, recetas] = await Promise.all([
    prisma.clinicalEncounter.findMany({
      where: { patientId, doctorId },
      include: { template: { select: { name: true, customFields: true } } },
      orderBy: { encounterDate: 'desc' },
    }),
    prisma.patientNote.findMany({
      where: { patientId, doctorId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.prescription.findMany({
      where: { patientId, doctorId, status: { in: ['issued', 'expired'] } },
      include: {
        template: { select: { name: true, customFields: true } },
        medications: { orderBy: { order: 'asc' } },
      },
      orderBy: { prescriptionDate: 'desc' },
    }),
  ]);

  const salida: FuenteDisponible[] = [];

  for (const e of consultas) {
    const { titulo, contenido } = textoDeConsulta(e);
    if (contenido.trim() === '') continue;   // una consulta vacía no es fuente
    salida.push({
      tipo: 'consulta', id: e.id,
      fecha: e.encounterDate.toISOString(),
      actualizadoEn: e.updatedAt.toISOString(),
      titulo, resumen: resumirse(contenido),
      tokensAprox: estimarTokens(`${titulo}\n${contenido}`),
    });
  }
  for (const n of notas) {
    const { titulo, contenido } = textoDeNota(n);
    if (contenido === '') continue;
    salida.push({
      tipo: 'nota', id: n.id,
      fecha: n.createdAt.toISOString(),
      actualizadoEn: n.updatedAt.toISOString(),
      titulo, resumen: resumirse(contenido),
      tokensAprox: estimarTokens(`${titulo}\n${contenido}`),
    });
  }
  for (const r of recetas) {
    const { titulo, contenido } = textoDeReceta(r);
    if (contenido.trim() === '') continue;
    salida.push({
      tipo: 'receta', id: r.id,
      fecha: r.prescriptionDate.toISOString(),
      actualizadoEn: r.updatedAt.toISOString(),
      titulo, resumen: resumirse(contenido),
      tokensAprox: estimarTokens(`${titulo}\n${contenido}`),
    });
  }

  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ── Lo elegido → el bloque del prompt ───────────────────────────────────────

const TIPOS: ReadonlySet<string> = new Set<TipoFuente>(['consulta', 'nota', 'receta']);

/**
 * Lee la columna JSONB `sources`. Prisma la tipa como "cualquier JSON" y de
 * verdad lo es: castearla a ciegas haría reventar el armado del prompt con un
 * error que no dice nada. Lo que no tenga la forma esperada se descarta.
 */
export function leerFuentes(json: unknown): FuenteElegida[] {
  if (!Array.isArray(json)) return [];
  const salida: FuenteElegida[] = [];
  const vistos = new Set<string>();
  for (const bruto of json) {
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) continue;
    const f = bruto as Record<string, unknown>;
    if (typeof f.tipo !== 'string' || !TIPOS.has(f.tipo)) continue;
    if (typeof f.id !== 'string' || f.id === '') continue;
    const llave = `${f.tipo}:${f.id}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    salida.push({
      tipo: f.tipo as TipoFuente,
      id: f.id,
      fecha: typeof f.fecha === 'string' ? f.fecha : '',
      actualizadoEn: typeof f.actualizadoEn === 'string' ? f.actualizadoEn : '',
    });
  }
  return salida;
}

export interface ResultadoFuentes {
  /** Lo que sí se le manda al modelo, en orden CRONOLÓGICO ascendente. */
  fuentes: FuenteParaModelo[];
  /** Elegidas que ya no existen (o dejaron de ser de este paciente/doctor). Se
   * REPORTAN: un informe que se conversa sin la receta que el doctor eligió, y
   * sin decirlo, es indistinguible de que el modelo la ignorara. */
  faltantes: FuenteElegida[];
  /** Lo que ocupan las elegidas. NO incluye el ancla, que no se puede quitar. */
  tokensAprox: number;
}

/**
 * Las fuentes elegidas, en TEXTO y en orden cronológico ascendente (el modelo lee
 * una historia, no un montón — lo pidió el usuario en 07-PLAN §6).
 *
 * 🔴 Todo se lee acotado por `patientId` + `doctorId`: los ids vienen de la
 * columna, pero la columna la escribió una petición anterior y el alcance se
 * comprueba SIEMPRE aquí, no una sola vez al guardar.
 *
 * @param excluirEncounterId el ANCLA: se arma aparte y no debe salir dos veces.
 */
export async function fuentesParaModelo(
  elegidas: FuenteElegida[],
  patientId: string,
  doctorId: string,
  excluirEncounterId?: string | null
): Promise<ResultadoFuentes> {
  const porTipo = (t: TipoFuente) =>
    elegidas.filter((f) => f.tipo === t && !(t === 'consulta' && f.id === excluirEncounterId))
      .map((f) => f.id);

  const idsConsulta = porTipo('consulta');
  const idsNota = porTipo('nota');
  const idsReceta = porTipo('receta');

  if (idsConsulta.length === 0 && idsNota.length === 0 && idsReceta.length === 0) {
    return { fuentes: [], faltantes: [], tokensAprox: 0 };
  }

  const [consultas, notas, recetas] = await Promise.all([
    idsConsulta.length === 0 ? [] : prisma.clinicalEncounter.findMany({
      where: { id: { in: idsConsulta }, patientId, doctorId },
      include: { template: { select: { name: true, customFields: true } } },
    }),
    idsNota.length === 0 ? [] : prisma.patientNote.findMany({
      where: { id: { in: idsNota }, patientId, doctorId },
    }),
    idsReceta.length === 0 ? [] : prisma.prescription.findMany({
      // La MISMA regla que el catálogo y que el pre-llenado: una receta que
      // volvió a `draft` o se canceló después de elegirla deja de ser fuente.
      where: { id: { in: idsReceta }, patientId, doctorId, status: { in: ['issued', 'expired'] } },
      include: {
        template: { select: { name: true, customFields: true } },
        medications: { orderBy: { order: 'asc' } },
      },
    }),
  ]);

  const fuentes: FuenteParaModelo[] = [];
  const encontrados = new Set<string>();

  const agregar = (
    tipo: TipoFuente, id: string, fecha: Date, actualizadoEn: Date,
    { titulo, contenido }: { titulo: string; contenido: string }
  ) => {
    // 🔴 Una fuente que quedó VACÍA no cuenta como encontrada: al modelo no le
    // llega nada de ella, así que cae en `faltantes` y se REPORTA. Marcarla como
    // encontrada la borraría de la selección sin una palabra, y el doctor
    // seguiría creyendo que el asistente la está leyendo.
    if (contenido.trim() === '') return;
    encontrados.add(`${tipo}:${id}`);
    fuentes.push({
      tipo, id, titulo, contenido, fecha, actualizadoEn,
      tokensAprox: estimarTokens(`${titulo}\n${contenido}`),
    });
  };

  for (const e of consultas) agregar('consulta', e.id, e.encounterDate, e.updatedAt, textoDeConsulta(e));
  for (const n of notas) agregar('nota', n.id, n.createdAt, n.updatedAt, textoDeNota(n));
  for (const r of recetas) agregar('receta', r.id, r.prescriptionDate, r.updatedAt, textoDeReceta(r));

  fuentes.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  return {
    fuentes,
    faltantes: elegidas.filter(
      (f) => !(f.tipo === 'consulta' && f.id === excluirEncounterId)
        && !encontrados.has(`${f.tipo}:${f.id}`)
    ),
    tokensAprox: fuentes.reduce((t, f) => t + f.tokensAprox, 0),
  };
}

/** Lo que el CLIENTE manda al elegir: tipo e id, nada más. */
export interface FuentePedida { tipo: TipoFuente; id: string }

/** Lee lo que llega en el body. No se le cree la forma al navegador. */
export function leerFuentesPedidas(bruto: unknown): FuentePedida[] | { error: string } {
  if (!Array.isArray(bruto)) return { error: 'sources debe ser un arreglo' };
  const salida: FuentePedida[] = [];
  const vistos = new Set<string>();
  for (const f of bruto) {
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      return { error: 'cada fuente debe ser un objeto { tipo, id }' };
    }
    const { tipo, id } = f as Record<string, unknown>;
    if (typeof tipo !== 'string' || !TIPOS.has(tipo)) {
      return { error: `tipo debe ser uno de: ${[...TIPOS].join(', ')}` };
    }
    if (typeof id !== 'string' || id === '') return { error: 'cada fuente necesita un id' };
    const llave = `${tipo}:${id}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    salida.push({ tipo: tipo as TipoFuente, id });
  }
  return salida;
}

export type ResolucionFuentes =
  | {
      ok: true;
      fuentes: FuenteElegida[];
      tokensAprox: number;
      /** Las que se pidieron y ya no se pudieron leer. Se guardan SIN ellas y se
       * dicen; no tumban la petición. */
      descartadas: FuentePedida[];
    }
  | { ok: false; error: string };

/**
 * 🔴 EL VEREDICTO ES DEL SERVIDOR (regla 0). El cliente manda `{tipo, id}` y
 * aquí se comprueba contra el expediente:
 *
 *   · que la fuente EXISTA y sea de ESTE paciente y de ESTE doctor;
 *   · que una receta siga `issued`/`expired` — una en `draft` no fue el
 *     tratamiento del paciente y declararla a la aseguradora sería falso;
 *   · que lo elegido QUEPA en el presupuesto del prompt.
 *
 * `fecha` y `actualizadoEn` los pone el SERVIDOR desde la base, no el cliente:
 * son el registro de qué se consultó y en qué versión, y un dato de procedencia
 * que escribe el navegador no registra nada.
 *
 * 🔴 Si no cabe, NO se recorta solo (07-PLAN §11): se le dice al doctor que
 * deseleccione. Él eligió esas fuentes a propósito; quitarle una en silencio —o
 * media— es deshacer su decisión sin avisar, y un recorte callado es
 * indistinguible de "el modelo lo ignoró".
 *
 * ⚠️ Una fuente que ya NO se puede leer —se borró la nota, la receta volvió a
 * borrador— se DESCARTA y se reporta; **no tumba la petición**. Rechazarla
 * entera dejaba el informe atorado para siempre: el id fantasma sigue en la
 * columna, viaja en cada PATCH, y el panel no tiene una casilla que
 * desmarcar — ni siquiera se podía quitar OTRA fuente.
 */
export async function resolverFuentesElegidas(
  pedidas: FuentePedida[],
  patientId: string,
  doctorId: string,
  anclaEncounterId: string | null
): Promise<ResolucionFuentes> {
  // El ANCLA no se elige como fuente extra: ya entra sola y saldría dos veces.
  const limpias = pedidas.filter((f) => !(f.tipo === 'consulta' && f.id === anclaEncounterId));
  if (limpias.length === 0) return { ok: true, fuentes: [], tokensAprox: 0, descartadas: [] };

  // 🔴 Se resuelve con `fuentesParaModelo`, el MISMO camino que usa el chat.
  // Antes esto releía el catálogo entero del paciente —todas sus consultas,
  // notas y recetas, renderizadas a texto— para validar dos ids, y lo hacía en
  // CADA clic de una casilla. Y siendo dos caminos distintos, podían acabar
  // discrepando sobre qué cuenta como fuente válida, que es justo la clase de
  // regla replicada que no se debe tener por triplicado.
  const { fuentes, faltantes, tokensAprox } = await fuentesParaModelo(
    limpias.map((f) => ({ ...f, fecha: '', actualizadoEn: '' })),
    patientId, doctorId, anclaEncounterId
  );

  if (tokensAprox > PRESUPUESTO_TOKENS_FUENTES) {
    return {
      ok: false,
      error: `Lo que elegiste no cabe en la conversación (${tokensAprox} de `
        + `${PRESUPUESTO_TOKENS_FUENTES}). Quita una consulta, una nota o una receta: `
        + `no se recorta solo, porque entonces no sabrías qué leyó el asistente.`,
    };
  }

  return {
    ok: true,
    fuentes: fuentes.map((f) => ({
      tipo: f.tipo, id: f.id,
      fecha: f.fecha.toISOString(),
      actualizadoEn: f.actualizadoEn.toISOString(),
    })),
    tokensAprox,
    descartadas: faltantes.map((f) => ({ tipo: f.tipo, id: f.id })),
  };
}

/**
 * Las consultas ADJUNTAS del dictado (05-VOZ). Se queda para esa ruta: el chat ya
 * usa `fuentesParaModelo`, que además de consultas entiende notas y recetas.
 */
export async function consultasParaModelo(
  encounterIds: string[],
  patientId: string,
  doctorId: string
): Promise<ConsultaParaModelo[]> {
  const ids = [...new Set(encounterIds)].slice(0, MAX_CONSULTAS);
  if (ids.length === 0) return [];

  const encs = await prisma.clinicalEncounter.findMany({
    where: { id: { in: ids }, patientId, doctorId },
    include: { template: { select: { name: true, customFields: true } } },
    orderBy: { encounterDate: 'desc' },
  });

  return encs
    .map((e) => textoDeConsulta(e))
    .filter((t) => t.contenido.trim() !== '');
}
