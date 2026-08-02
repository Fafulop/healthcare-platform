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

/**
 * Huecos LIBRES dentro de los rangos de disponibilidad de un día.
 *
 * Misma regla que ya usaba el panel de día: ocupan las citas activas (extendidas por
 * `extendedBlockMinutes`) y los bloqueos; lo demás es agendable.
 */
export function computeFreeGaps(
  ranges: AvailabilityRange[],
  events: CalendarEvent[],
): Array<{ start: number; end: number }> {
  const occupied = events
    .filter((e) => e.kind === "blocked" || !FREES_THE_SLOT.has(e.status ?? ""))
    .map((e) => ({ start: e.startMin, end: Math.max(e.endMin, e.blockEndMin) }))
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const w of occupied) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }

  const gaps: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const rangeStart = timeToMin(r.startTime);
    const rangeEnd = timeToMin(r.endTime);
    let cursor = rangeStart;
    for (const m of merged) {
      if (m.end <= cursor || m.start >= rangeEnd) continue;
      if (m.start > cursor) gaps.push({ start: cursor, end: Math.min(m.start, rangeEnd) });
      cursor = Math.max(cursor, m.end);
    }
    if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });
  }
  return gaps.filter((g) => g.end - g.start >= 15);
}
