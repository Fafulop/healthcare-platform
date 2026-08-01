/**
 * Redaction + digest helpers for agent tool-call logging (bitácora: la
 * conversación del 2026-07-31 en que el agente ofreció 3 horarios inexistentes
 * y NO se pudo saber qué le devolvieron las tools).
 *
 * INVARIANTE (la misma que declara `lib/ai/log-tool-errors.ts` y el comentario
 * de `AgentToolError.message` en el schema): **a una tabla de depuración no
 * llega jamás un dato de paciente.** Los resultados de las tools traen nombres,
 * teléfonos, correos y notas clínicas; los inputs de `propose_*` traen contacto
 * del paciente directo. Por eso aquí NADA se copia por defecto:
 *
 * - INPUT: se conserva el valor SOLO si la llave está en `SAFE_INPUT_KEYS`
 *   (fechas, ids, enums, banderas). Cualquier otra llave —incluida
 *   `patientName`, que es un término de búsqueda -> PII— se sustituye por una
 *   etiqueta de tipo (`<string:12>`), que basta para depurar la FORMA de la
 *   llamada sin guardar el contenido.
 * - RESULT: nunca se copia el payload. Se guarda un resumen: llaves de primer
 *   nivel, conteos, escalares numéricos/booleanos (son métricas, no datos), y
 *   texto SOLO de las llaves de `DIGEST_TEXT_KEYS` (`nota`, `aviso`, `error` —
 *   las genera el servidor, no la BD). Los arreglos se guardan como conteo,
 *   salvo que TODOS sus elementos sean fechas u horas ("2026-08-05", "11:00"),
 *   que no identifican a nadie y son justo lo que hay que auditar.
 *
 * Regla de oro para el mantenedor: para agregar una llave a cualquiera de las
 * dos listas hay que poder afirmar que su valor no identifica a un paciente.
 * Ante la duda, NO se agrega — la etiqueta de tipo casi siempre alcanza.
 */

/** Llaves de input cuyo valor se conserva tal cual. Solo fechas, horas, ids,
 * enums y banderas — nada de texto libre. Deliberadamente NO incluye
 * `patientName`, `email`, `telefono`, `motivo`, `notas`, `razon`, `reason`. */
const SAFE_INPUT_KEYS = new Set([
  // fechas y horas
  'date', 'startDate', 'endDate', 'fecha', 'startTime', 'endTime',
  'blockStartTime', 'blockEndTime', 'month', 'year', 'daysOfWeek',
  // ids (opacos: no identifican a un paciente sin cruzar la BD)
  'id', 'ids', 'bookingId', 'rangeId', 'rangeIds', 'serviceId', 'locationId',
  'patientId', 'blockedTimeId', 'cfdiId', 'invoiceId', 'movimientoId', 'slotId',
  // enums y banderas
  'status', 'vencidas', 'mode', 'dryRun', 'tipo', 'type', 'formaPago',
  'metodoPago', 'usoCfdi', 'moneda', 'intervalMinutes', 'extendedBlockMinutes',
  'limit', 'incluirCanceladas', 'soloActivas',
]);

/** Llaves de resultado cuyo TEXTO se conserva (recortado).
 *
 * ⚠️ La lista es corta A PROPÓSITO y `error` NO está en ella, aunque sea lo más
 * útil para depurar: los `error` de las tools SÍ interpolan datos del paciente.
 * Contraejemplo real — `modules/facturas.ts:1442`:
 *
 *   error: `Los datos fiscales de ${nombre} están incompletos — faltan: …`
 *
 * El nombre cae en el carácter ~22, dentro de cualquier recorte razonable. Al
 * quedar fuera de esta lista, un `error` se guarda como `<string:87>`: se sigue
 * viendo QUE la tool falló y con qué tamaño, sin copiar el texto. (Los errores
 * de tools que TRUENAN ya viven en `agent_tool_errors`, con su propio contrato.)
 *
 * `nota` y `aviso` sí están: hoy TODOS sus valores son conteos, folios, estatus
 * o nombres de servicio del catálogo del doctor — se revisó una por una
 * (tools.ts getAvailability · expediente.ts:373 · facturas.ts:499,647,1032,1169).
 * Si alguna vez alguien interpola un nombre de paciente en un `nota`, esta lista
 * es lo que hay que volver a revisar. */
const DIGEST_TEXT_KEYS = new Set(['nota', 'aviso']);

const MAX_INPUT_STRING = 64;
const MAX_ARRAY_ITEMS = 20;
const MAX_TEXT = 200;
const MAX_DIGEST_CHARS = 2_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isDateOrTimeLike(v: unknown): boolean {
  return typeof v === 'string' && (DATE_RE.test(v) || TIME_RE.test(v));
}

/** Etiqueta de tipo — describe la FORMA del valor sin revelar su contenido. */
function tag(v: unknown): string {
  if (v === null) return '<null>';
  if (Array.isArray(v)) return `<array:${v.length}>`;
  switch (typeof v) {
    case 'string':
      return `<string:${v.length}>`;
    case 'number':
      return '<number>';
    case 'boolean':
      return '<boolean>';
    case 'object':
      return `<object:${Object.keys(v as object).length}>`;
    default:
      return `<${typeof v}>`;
  }
}

function isScalar(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Recorta sin cambiar el tipo: strings a 64, arreglos a 20 elementos.
 * El centinela "…+N" solo se añade a arreglos de strings: metérselo a uno de
 * números (`daysOfWeek`) lo volvería un arreglo de tipo mixto en JSONB. */
function cap(v: unknown): unknown {
  if (typeof v === 'string') return v.length > MAX_INPUT_STRING ? v.slice(0, MAX_INPUT_STRING) + '…' : v;
  if (Array.isArray(v)) {
    const items = v.slice(0, MAX_ARRAY_ITEMS).map((x) => (typeof x === 'string' ? cap(x) : x));
    if (v.length <= MAX_ARRAY_ITEMS) return items;
    return items.every((x) => typeof x === 'string') ? [...items, `…+${v.length - MAX_ARRAY_ITEMS}`] : items;
  }
  return v;
}

/**
 * Input del modelo con TODO lo que no esté explícitamente permitido sustituido
 * por su etiqueta de tipo. Default-deny: una llave nueva de una tool futura
 * queda redactada sola, sin que nadie tenga que acordarse.
 */
export function redactInput(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    const safeShape = isScalar(v) || (Array.isArray(v) && v.every(isScalar));
    out[k] = SAFE_INPUT_KEYS.has(k) && safeShape ? cap(v) : tag(v);
  }
  return out;
}

/**
 * Resumen NO-PHI del resultado de una tool: qué llaves trajo, cuántas filas y
 * los escalares que son métricas. Suficiente para contestar "¿qué vio el
 * modelo?" sin guardar lo que vio.
 *
 * Ejemplo real (el caso que motivó esto):
 *   { keys: [...], nota: "Sin servicio especificado…", fechasDisponibles: [],
 *     fechasDisponibles_n: 0, horarios_keys: 0, bufferMinutos: 0 }
 * — con eso se distingue en un vistazo el modo "solo fechas" del cálculo real,
 * y si el modelo ofreció un día que la tool nunca devolvió.
 */
export function digestResult(
  result: unknown,
  /** Metadatos del recorte (run-turn). Van AQUÍ y no pegados afuera para que
   * queden DENTRO del tope de tamaño de abajo — si no, el digest se pasa del
   * límite que este archivo promete. */
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const conExtra = (o: Record<string, unknown>) => (extra ? { ...o, ...extra } : o);
  if (result == null) return conExtra({ vacio: true });
  if (typeof result !== 'object') return conExtra({ escalar: tag(result) });
  if (Array.isArray(result)) return conExtra({ n: result.length });

  const entries = Object.entries(result as Record<string, unknown>);
  // `keys` va capado a 20 A PROPÓSITO: es lo único que sobrevive al corte por
  // tamaño de abajo, así que ese recorte es lo que acota el fallback.
  const out: Record<string, unknown> = { keys: entries.map(([k]) => k).slice(0, 20), ...(extra ?? {}) };

  for (const [k, v] of entries) {
    if (typeof v === 'number' || typeof v === 'boolean') {
      // Hoy TODO escalar numérico de primer nivel es una métrica (conteos,
      // minutos, banderas): lo clínico y lo fiscal viaja anidado, y lo anidado
      // aquí solo aporta su número de llaves. ⚠️ Es la única regla del archivo
      // que confía en la FORMA y no en una allowlist: una tool futura que
      // devuelva un escalar clínico arriba (peso, presión) lo guardaría. Si eso
      // pasa, este branch se vuelve allowlist como el de texto.
      out[k] = v;
    } else if (typeof v === 'string') {
      out[k] = DIGEST_TEXT_KEYS.has(k) ? v.slice(0, MAX_TEXT) : tag(v);
    } else if (Array.isArray(v)) {
      out[`${k}_n`] = v.length;
      // Fechas y horas SÍ se guardan: no identifican a nadie y son exactamente
      // lo que hay que poder auditar contra lo que el modelo respondió.
      if (v.length > 0 && v.every(isDateOrTimeLike)) out[k] = v.slice(0, MAX_ARRAY_ITEMS);
    } else if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      out[`${k}_keys`] = keys.length;
      // Un mapa fecha -> [...] (p. ej. `horarios`) : las LLAVES son fechas, útiles y anónimas.
      if (keys.length > 0 && keys.every((kk) => DATE_RE.test(kk))) {
        out[`${k}_fechas`] = keys.slice(0, MAX_ARRAY_ITEMS);
      }
    } else if (v === null) {
      out[k] = null;
    }
  }

  // Cinturón de seguridad: un resultado inesperadamente ancho no infla la fila.
  const json = JSON.stringify(out);
  if (json.length > MAX_DIGEST_CHARS) {
    return { keys: out.keys, truncado: true, bytes: json.length, ...(extra ?? {}) };
  }
  return out;
}
