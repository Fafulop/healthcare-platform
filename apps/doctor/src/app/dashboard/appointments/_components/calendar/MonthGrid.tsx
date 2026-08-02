"use client";

import { useMemo } from "react";
import { getLocalDateString, getClinicDateString } from "@/lib/dates";
import { buildDayEvents, minToTime, statusMeta, type TimedBooking } from "../../_lib/event-model";
import { DAY_NAMES_SHORT as DAY_NAMES } from "../../_lib/calendar-labels";
import type { AvailabilityRange } from "../../_hooks/useRanges";
import type { BlockedTime } from "../../_hooks/useBlockedTimes";

/** Cuántas citas se listan antes de colapsar en "+N más". */
const MAX_CHIPS = 3;

interface Props {
  /** Semanas COMPLETAS: incluye los días de relleno del mes anterior/siguiente. */
  days: Date[];
  /** Mes en foco — los días fuera de él se atenúan. */
  month: number;
  ranges: AvailabilityRange[];
  bookings: TimedBooking[];
  blockedTimes: BlockedTime[];
  selectedDate: Date;
  onSelectDay: (date: Date) => void;
  /** Doble propósito: seleccionar el día Y saltar a la vista de día. */
  onDrillDown: (date: Date) => void;
}

export function MonthGrid({
  days, month, ranges, bookings, blockedTimes, selectedDate, onSelectDay, onDrillDown,
}: Props) {
  const todayStr = getClinicDateString();
  const selectedStr = getLocalDateString(selectedDate);

  const cells = useMemo(() => days.map((date) => {
    const dateStr = getLocalDateString(date);
    // Sólo citas: los bloqueos no se listan a nivel de mes (ruido), pero el punto de
    // disponibilidad sí los ignora a propósito — lo que importa es si hay consulta.
    const events = buildDayEvents(dateStr, bookings, []).filter((e) => e.kind === "booking");
    return {
      date,
      dateStr,
      events,
      hasRanges: ranges.some((r) => r.date.split("T")[0] === dateStr),
      hasBlocks: blockedTimes.some((b) => b.date.split("T")[0] === dateStr),
      inMonth: date.getMonth() === month,
    };
  }), [days, month, ranges, bookings, blockedTimes]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedStr;
          const extra = cell.events.length - MAX_CHIPS;

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDay(cell.date)}
              className={`min-h-[92px] border-b border-r border-gray-100 p-1 cursor-pointer transition-colors ${
                cell.inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100/60"
              } ${isSelected ? "ring-2 ring-inset ring-blue-400" : ""}`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : cell.inMonth ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                <span className="flex items-center gap-1">
                  {cell.hasBlocks && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" title="Tiene bloqueos" />}
                  {cell.hasRanges && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" title="Tiene disponibilidad" />}
                </span>
              </div>

              <div className="mt-0.5 space-y-0.5">
                {cell.events.slice(0, MAX_CHIPS).map((ev) => {
                  const meta = statusMeta(ev.status ?? "PENDING");
                  return (
                    <div
                      key={ev.id}
                      title={`${minToTime(ev.startMin)} · ${ev.label} · ${meta.label}`}
                      className={`flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight ${meta.blockBg}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                      <span className="tabular-nums text-gray-500">{minToTime(ev.startMin)}</span>
                      <span className={`truncate ${meta.blockText}`}>{ev.label}</span>
                    </div>
                  );
                })}
                {extra > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDrillDown(cell.date); }}
                    className="w-full px-1 text-left text-[10px] font-medium text-blue-600 hover:underline"
                  >
                    +{extra} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
