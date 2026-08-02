"use client";

import { useMemo } from "react";
import { getLocalDateString, getClinicDateString, parseLocalDateAtNoon } from "@/lib/dates";
import { resolveBookingTime, NO_WORKLOAD, type TimedBooking } from "../../_lib/event-model";
import { MONTH_NAMES, DAY_INITIALS } from "../../_lib/calendar-labels";

/**
 * Tinte por DENSIDAD de citas activas. Cuatro escalones bastan: el año es para detectar
 * dónde se acumula el trabajo, no para leer citas concretas.
 */
function densityClass(count: number): string {
  if (count === 0) return "text-gray-600";
  if (count <= 2) return "bg-blue-100 text-blue-800";
  if (count <= 5) return "bg-blue-300 text-blue-900";
  return "bg-blue-600 text-white";
}

interface Props {
  year: number;
  bookings: TimedBooking[];
  selectedDate: Date;
  /** Salta a la vista de mes centrada en ese día. */
  onDrillDown: (date: Date) => void;
}

export function YearGrid({ year, bookings, selectedDate, onDrillDown }: Props) {
  const todayStr = getClinicDateString();
  const selectedStr = getLocalDateString(selectedDate);

  /**
   * Carga de trabajo por día. `COMPLETED` **cuenta** — es el estado de toda consulta ya
   * realizada, y excluirlo dejaba en blanco todo el pasado del año.
   */
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (NO_WORKLOAD.has(b.status)) continue;
      const resolved = resolveBookingTime(b);
      if (!resolved) continue;
      map.set(resolved.date, (map.get(resolved.date) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTH_NAMES.map((name, monthIndex) => {
          const firstDay = new Date(year, monthIndex, 1);
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const leading = firstDay.getDay();
          const cells: (number | null)[] = [
            ...Array(leading).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];

          return (
            <div key={name}>
              <button
                onClick={() => onDrillDown(new Date(year, monthIndex, 1, 12))}
                className="mb-1 text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors"
              >
                {name}
              </button>
              <div className="grid grid-cols-7 gap-px">
                {DAY_INITIALS.map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-medium text-gray-300">
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;
                  const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const count = countByDate.get(dateStr) ?? 0;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => onDrillDown(parseLocalDateAtNoon(dateStr))}
                      title={count > 0 ? `${dateStr} — ${count} cita(s)` : dateStr}
                      className={`aspect-square rounded-sm text-[9px] leading-none flex items-center justify-center transition-colors hover:ring-1 hover:ring-blue-400 ${densityClass(count)} ${
                        isToday ? "ring-1 ring-red-500 font-bold" : ""
                      } ${isSelected ? "ring-1 ring-blue-600" : ""}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda de densidad */}
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
        <span>Menos</span>
        <span className="h-3 w-3 rounded-sm border border-gray-200" />
        <span className="h-3 w-3 rounded-sm bg-blue-100" />
        <span className="h-3 w-3 rounded-sm bg-blue-300" />
        <span className="h-3 w-3 rounded-sm bg-blue-600" />
        <span>Más</span>
      </div>
    </div>
  );
}
