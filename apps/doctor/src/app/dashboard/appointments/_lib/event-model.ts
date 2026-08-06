/**
 * Modelo de evento COMPARTIDO por la rejilla de calendario y el panel de día.
 *
 * Existe para que la conversión "cita → hora" viva en UN solo lugar: antes
 * `resolveBookingTime`/`timeToMin`/`minToTime` estaban dentro de `DayTimelinePanel`, y cada
 * vista nueva habría vuelto a derivarlas. Las citas tienen DOS formas (con `slot` y libres),
 * y una vista que se olvide de la segunda pierde citas en silencio.
 */

import type { AvailabilityRange } from "../_hooks/useRanges";
import type { BlockedTime } from "../_hooks/useBlockedTimes";

/** Forma mínima de cita que necesitan las vistas. `useBookings.Booking` la satisface. */
export interface TimedBooking {
  id: string;
  slotId: string | null;
  patientName: string;
  serviceName?: string | null;
  status: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  extendedBlockMinutes?: number | null;
  slot?: { date: string; startTime: string; endTime: string; duration: number } | null;
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Resuelve fecha/hora de una cita, venga de un `slot` o capturada libre.
 * Devuelve `null` si no se puede ubicar en el tiempo — esas citas no se pintan.
 */
export function resolveBookingTime(b: TimedBooking) {
  if (b.slotId && b.slot) {
    return {
      date: b.slot.date.split("T")[0],
      startTime: b.slot.startTime,
      endTime: b.slot.endTime,
      duration: b.slot.duration,
    };
  }
  if (!b.slotId && b.date && b.startTime && b.endTime) {
    return {
      date: b.date.split("T")[0],
      startTime: b.startTime,
      endTime: b.endTime,
      duration: b.duration ?? 0,
    };
  }
  return null;
}

/**
 * ⚠️ DOS preguntas distintas, DOS conjuntos. No los intercambies.
 *
 * Existían como un solo `INACTIVE_STATUSES` y eso produjo un bug real: la vista de AÑO lo
 * usó para medir carga de trabajo, y como incluye `COMPLETED` —el estado de toda consulta
 * ya realizada— pintaba en blanco todo el pasado. Justo lo contrario de lo que la vista
 * existe para mostrar. El nombre ambiguo fue el bug; los nombres largos son el arreglo.
 */

/**
 * "¿Este estado LIBERA el horario?" — para calcular huecos agendables.
 * Una cita completada ya pasó: su hueco vuelve a estar disponible.
 */
export const FREES_THE_SLOT = new Set(["CANCELLED", "COMPLETED", "NO_SHOW"]);

/**
 * "¿Este estado NO fue trabajo?" — para medir carga (densidad del año).
 * Una cita completada SÍ fue trabajo; una cancelada o un no-asistió no.
 */
export const NO_WORKLOAD = new Set(["CANCELLED", "NO_SHOW"]);

/**
 * "¿Este estado se OCULTA del calendario?" — tercera pregunta, tercer conjunto.
 *
 * Una cita cancelada no ocurrió y no va a ocurrir: en la rejilla sólo tapaba un horario que
 * en realidad está libre.
 *
 * ⚠️ **Dónde queda visible, con precisión.** En la tabla "Todas las Citas", pero SÓLO con el
 * filtro de estado en *Todos los estados* o *Cancelada*. **NO** aparece en *Activas*, que
 * conserva únicamente `PENDING`/`CONFIRMED`. Y como el estado de ENTRADA de la tabla es
 * *Activas* + hoy, cancelar una cita de hoy la hace desaparecer de las DOS superficies a la
 * vez: hay que abrir el desplegable de estados para volver a verla.
 *
 * `COMPLETED` y `NO_SHOW` **sí se dibujan** — son registro de lo que pasó ese día.
 */
export const HIDDEN_IN_CALENDAR = new Set(["CANCELLED"]);

export interface StatusMeta {
  /** Fila compacta del panel de día. */
  chipBg: string;
  chipText: string;
  /** Bloque sólido de la rejilla día/semana. */
  blockBg: string;
  blockBorder: string;
  blockText: string;
  /** Punto de la vista de mes/año. */
  dot: string;
  label: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    chipBg: "bg-amber-50 border-amber-200", chipText: "text-amber-700",
    blockBg: "bg-amber-100 hover:bg-amber-200", blockBorder: "border-l-amber-500", blockText: "text-amber-900",
    dot: "bg-amber-500", label: "Pendiente",
  },
  CONFIRMED: {
    chipBg: "bg-green-50 border-green-200", chipText: "text-green-700",
    blockBg: "bg-green-100 hover:bg-green-200", blockBorder: "border-l-green-600", blockText: "text-green-900",
    dot: "bg-green-600", label: "Confirmada",
  },
  COMPLETED: {
    chipBg: "bg-blue-50 border-blue-200", chipText: "text-blue-700",
    blockBg: "bg-blue-100 hover:bg-blue-200", blockBorder: "border-l-blue-600", blockText: "text-blue-900",
    dot: "bg-blue-600", label: "Completada",
  },
  CANCELLED: {
    chipBg: "bg-gray-50 border-gray-200", chipText: "text-gray-400",
    blockBg: "bg-gray-100 hover:bg-gray-200", blockBorder: "border-l-gray-400", blockText: "text-gray-500 line-through",
    dot: "bg-gray-400", label: "Cancelada",
  },
  NO_SHOW: {
    chipBg: "bg-red-50 border-red-200", chipText: "text-red-600",
    blockBg: "bg-red-100 hover:bg-red-200", blockBorder: "border-l-red-500", blockText: "text-red-900",
    dot: "bg-red-500", label: "No asistió",
  },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.PENDING;
}

// ---------------------------------------------------------------------------
// Eventos posicionables
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  kind: "booking" | "blocked";
  date: string;
  startMin: number;
  endMin: number;
  /**
   * Fin del BLOQUEO de agenda. Igual a `endMin` salvo cuando la cita tiene
   * `extendedBlockMinutes` mayor que su duración — ahí la agenda sigue ocupada aunque la
   * consulta ya terminó, y la rejilla lo dibuja como una cola rayada.
   */
  blockEndMin: number;
  label: string;
  sublabel?: string | null;
  status?: string;
  booking?: TimedBooking;
  reason?: string | null;
}

/** Convierte citas + bloqueos de UN día en eventos ordenados por hora de inicio. */
export function buildDayEvents(
  dateStr: string,
  bookings: TimedBooking[],
  blockedTimes: BlockedTime[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const b of bookings) {
    if (HIDDEN_IN_CALENDAR.has(b.status)) continue;
    const resolved = resolveBookingTime(b);
    if (!resolved || resolved.date !== dateStr) continue;
    const startMin = timeToMin(resolved.startTime);
    const endMin = timeToMin(resolved.endTime);
    events.push({
      id: b.id,
      kind: "booking",
      date: dateStr,
      startMin,
      endMin,
      blockEndMin: b.extendedBlockMinutes != null
        ? Math.max(endMin, startMin + b.extendedBlockMinutes)
        : endMin,
      label: b.patientName,
      sublabel: b.serviceName,
      status: b.status,
      booking: b,
    });
  }

  for (const bt of blockedTimes) {
    if (bt.date.split("T")[0] !== dateStr) continue;
    const startMin = timeToMin(bt.startTime);
    const endMin = timeToMin(bt.endTime);
    events.push({
      id: bt.id,
      kind: "blocked",
      date: dateStr,
      startMin,
      endMin,
      blockEndMin: endMin,
      label: "Bloqueado",
      reason: bt.reason,
    });
  }

  return events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export interface PositionedEvent extends CalendarEvent {
  /** Columna asignada dentro de su grupo de solapamiento (0-indexada). */
  col: number;
  /** Cuántas columnas tiene el grupo. Ancho del bloque = 1/cols. */
  cols: number;
}

/**
 * Reparte eventos solapados en columnas lado a lado, como Google Calendar.
 *
 * El API impide que dos RANGOS se solapen, pero las citas sí pueden coincidir: las citas
 * "instantáneas" y las libres no pasan por el mismo camino, y un bloqueo puede montarse
 * encima de una cita. Sin esto, dos eventos a la misma hora se taparían.
 */
export function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  const positioned: PositionedEvent[] = [];
  let cluster: CalendarEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    // Asignación voraz: la primera columna cuyo último evento ya terminó.
    const colEnds: number[] = [];
    const assigned = cluster.map((ev) => {
      const span = Math.max(ev.endMin, ev.blockEndMin);
      let col = colEnds.findIndex((end) => end <= ev.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(span); }
      else colEnds[col] = span;
      return { ev, col };
    });
    for (const { ev, col } of assigned) {
      positioned.push({ ...ev, col, cols: colEnds.length });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of events) {
    const span = Math.max(ev.endMin, ev.blockEndMin);
    if (cluster.length > 0 && ev.startMin >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, span);
  }
  flush();

  return positioned;
}

export interface Span { start: number; end: number }

/**
 * Ventanas OCUPADAS del día, fundidas. Ocupan las citas activas (extendidas por
 * `extendedBlockMinutes`) y los bloqueos; lo demás es agendable.
 */
function mergeOccupied(events: CalendarEvent[]): Span[] {
  const occupied = events
    .filter((e) => e.kind === "blocked" || !FREES_THE_SLOT.has(e.status ?? ""))
    .map((e) => ({ start: e.startMin, end: Math.max(e.endMin, e.blockEndMin) }))
    .sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  for (const w of occupied) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

/** Resta las ventanas ocupadas (ya fundidas y ordenadas) de una ventana cualquiera. */
function subtractOccupied(windowStart: number, windowEnd: number, merged: Span[]): Span[] {
  const free: Span[] = [];
  let cursor = windowStart;
  for (const m of merged) {
    if (m.end <= cursor || m.start >= windowEnd) continue;
    if (m.start > cursor) free.push({ start: cursor, end: Math.min(m.start, windowEnd) });
    cursor = Math.max(cursor, m.end);
  }
  if (cursor < windowEnd) free.push({ start: cursor, end: windowEnd });
  return free;
}

/**
 * Huecos LIBRES dentro de los rangos de disponibilidad de un día.
 *
 * ⚠️ **Hoy su único llamador es `scripts/event-model-check.ts`.** La rejilla Día/Semana dejó de
 * usarla al volverse clicable fuera de rango (rinde `computeOpenSpans`), y `DayTimelinePanel`
 * —que es lo que uno supondría— **nunca la usó**: tiene su propio bucle de resta en línea, y
 * además sólo lo alcanzan las rutas muertas `v1`/`v2`.
 *
 * Se conserva porque responde una pregunta que sigue existiendo —"¿qué queda libre DENTRO de
 * lo publicado?"— y porque sus 7 comprobaciones son las que prueban que el refactor de
 * `mergeOccupied`/`subtractOccupied` no cambió nada. Pero es código sin consumidor: **si nadie
 * la reclama en la próxima pasada, se borra**, y el duplicado de `DayTimelinePanel` es lo que
 * habría que colapsar sobre estos helpers.
 */
export function computeFreeGaps(
  ranges: AvailabilityRange[],
  events: CalendarEvent[],
): Array<{ start: number; end: number }> {
  const merged = mergeOccupied(events);
  const gaps: Span[] = [];
  for (const r of ranges) {
    gaps.push(...subtractOccupied(timeToMin(r.startTime), timeToMin(r.endTime), merged));
  }
  // Un hueco de menos de 15 min dentro de un rango es ruido visual: el rango existe para
  // ofrecer citas de su `intervalMinutes`, y ninguna cabe ahí.
  return gaps.filter((g) => g.end - g.start >= 15);
}

/**
 * Rejilla de la AFORDANCIA de agendar en el calendario.
 *
 * ⚠️ NO es el límite de lo agendable. El motor acepta cualquier minuto (`interval` admite
 * 1·3·5·15) y el campo de hora del picker deja escribir 16:07 — probado en vivo el 2026-08-05
 * (cita `cmsgk8swb0014ns0tpb4g3xc0`). Se clica en bloques de 15 para que el calendario sea
 * usable con el ratón; el minuto fino se afina escribiéndolo. Una rejilla que RECHACE 16:07
 * sería volver al mundo de los rangos.
 *
 * Comparte el número con el filtro de `computeFreeGaps` y NO su razón: allá es "no cabe una
 * cita del rango", aquí es "no cabe una celda clicable". Dos preguntas, dos constantes.
 */
export const BOOKING_GRID_MINUTES = 15;

/**
 * Ventanas LIBRES de una ventana ARBITRARIA del día — la misma resta que `computeFreeGaps`,
 * pero sin exigir que exista un rango publicado.
 *
 * Es lo que hace clicable un día sin rangos: el rango describe lo que el doctor PUBLICA en su
 * página, no lo que puede agendar él mismo, así que la rejilla no tiene por qué callarse fuera
 * de él. Se descartan las ventanas más cortas que una celda de la rejilla: no habría dónde
 * clicar.
 */
export function computeOpenSpans(
  events: CalendarEvent[],
  windowStart: number,
  windowEnd: number,
): Span[] {
  // ⚠️ La ventana se recorta al DÍA. El encuadre de la rejilla se estira para que quepa todo
  // lo que hay, y `blockEndMin` no tiene tope: una cita a las 22:00 con `extendedBlockMinutes`
  // de 150 lo empuja a las 24:30, y ahí se ofrecía como clicable un hueco que `minToTime`
  // rinde como "24:45" — una hora que `<input type="time">` rechaza, así que el doctor recibía
  // el campo VACÍO sin ninguna explicación. Con rangos no podía pasar: el hueco terminaba
  // donde termina el rango.
  const from = Math.max(0, windowStart);
  const to = Math.min(windowEnd, 24 * 60);
  if (to <= from) return [];
  return subtractOccupied(from, to, mergeOccupied(events))
    .filter((s) => s.end - s.start >= BOOKING_GRID_MINUTES);
}

/**
 * Minuto CLICADO → hora de inicio propuesta, alineada a la rejilla de 15 min.
 *
 * Se redondea hacia ABAJO: quien clica a las 16:20 quiere las 16:15, no las 16:30 (que ya es
 * el siguiente bloque visual). El resultado nunca se sale del hueco.
 */
export function snapToGrid(
  clickedMin: number,
  span: Span,
  grid: number = BOOKING_GRID_MINUTES,
): number {
  const down = Math.floor(clickedMin / grid) * grid;
  const firstInSpan = Math.ceil(span.start / grid) * grid;
  const candidate = Math.max(down, firstInSpan);
  if (candidate < span.end) return candidate;
  // Ninguna marca de la rejilla sirve. Dos casos, y el mismo remedio: la ÚLTIMA hora del hueco
  // que sí es marca, o su inicio real si tampoco hay ninguna.
  //  · Hueco más corto que una celda (09:50–10:00) → 09:50. El motor acepta cualquier minuto.
  //  · Clic exactamente en el borde inferior (`clientY === rect.bottom`, que en pantallas de
  //    DPI fraccionario se alcanza de verdad) con un fin en punto de rejilla. Devolver
  //    `span.start` ahí proponía las 07:00 a quien clicó el fondo de una columna de 14 h.
  return Math.max(span.start, Math.floor((span.end - 1) / grid) * grid);
}
