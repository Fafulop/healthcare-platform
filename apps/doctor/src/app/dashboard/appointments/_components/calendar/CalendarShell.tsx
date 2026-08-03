"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocalDateString, formatLocalDate } from "@/lib/dates";
import { TimeGrid } from "./TimeGrid";
import { MonthGrid } from "./MonthGrid";
import { YearGrid } from "./YearGrid";
import { monthNameLower } from "../../_lib/calendar-labels";
import type { CalendarView } from "../../_hooks/useCalendar";
import type { TimedBooking } from "../../_lib/event-model";
import type { AvailabilityRange } from "../../_hooks/useRanges";
import type { BlockedTime } from "../../_hooks/useBlockedTimes";

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
};

interface Props {
  view: CalendarView;
  onChangeView: (view: CalendarView) => void;
  /** Qué PERIODO está en pantalla. Manda en el rótulo, el mes en foco y el año. */
  anchorDate: Date;
  /** Qué DÍA está resaltado. Cambiarlo NO mueve el periodo. */
  selectedDate: Date;
  onSelectDay: (date: Date) => void;
  onDrillDownTo: (date: Date, view: CalendarView) => void;
  visibleDays: Date[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  ranges: AvailabilityRange[];
  bookings: TimedBooking[];
  blockedTimes: BlockedTime[];
  onBookInGap: (date: string, startTime: string) => void;
  onDeleteRange: (rangeId: string) => void;
  /**
   * Clic en una cita → abre su modal de acciones. Sólo recibe el ID: la cita COMPLETA la
   * resuelve la página desde `useBookings`, así el modal se re-rinde solo tras cada
   * escritura (completar, precio, vincular expediente) en vez de quedarse con una copia
   * congelada del momento del clic.
   */
  onOpenBooking: (bookingId: string) => void;
}

/**
 * Rótulo del periodo visible. Se deriva del ANCLA, no de la selección: seleccionar un día
 * de relleno no debe cambiar de qué mes dice que estás viendo.
 */
function periodLabel(view: CalendarView, anchorDate: Date, days: Date[]): string {
  if (view === "year") return String(anchorDate.getFullYear());
  if (view === "month") {
    return `${monthNameLower(anchorDate.getMonth())} ${anchorDate.getFullYear()}`;
  }
  if (view === "day") {
    return formatLocalDate(getLocalDateString(anchorDate), {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  // Una semana puede cruzar mes y año — el rótulo lo dice en vez de mentir con uno solo.
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} de ${monthNameLower(first.getMonth())} ${first.getFullYear()}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${first.getDate()} ${monthNameLower(first.getMonth())} – ${last.getDate()} ${monthNameLower(last.getMonth())} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${monthNameLower(first.getMonth())} ${first.getFullYear()} – ${last.getDate()} ${monthNameLower(last.getMonth())} ${last.getFullYear()}`;
}

export function CalendarShell({
  view, onChangeView, anchorDate, selectedDate, onSelectDay, onDrillDownTo, visibleDays,
  onPrev, onNext, onToday, ranges, bookings, blockedTimes,
  onBookInGap, onDeleteRange, onOpenBooking,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Barra de navegación */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Hoy
          </button>
          <div className="flex items-center">
            <button
              onClick={onPrev}
              title="Anterior"
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={onNext}
              title="Siguiente"
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <h3 className="text-sm font-semibold capitalize text-gray-900 sm:text-base">
            {periodLabel(view, anchorDate, visibleDays)}
          </h3>
        </div>

        {/* Selector de vista */}
        <div className="flex rounded-md border border-gray-200 p-0.5">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onChangeView(v)}
              className={`flex-1 rounded px-3 py-1 text-sm font-medium transition-colors sm:flex-none ${
                view === v
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {view === "year" ? (
        <YearGrid
          year={anchorDate.getFullYear()}
          bookings={bookings}
          selectedDate={selectedDate}
          onDrillDown={(date) => onDrillDownTo(date, "month")}
        />
      ) : view === "month" ? (
        <MonthGrid
          days={visibleDays}
          month={anchorDate.getMonth()}
          ranges={ranges}
          bookings={bookings}
          blockedTimes={blockedTimes}
          selectedDate={selectedDate}
          // Sólo SELECCIONA. Un clic en el "26" de julio viendo agosto ya no reencuadra
          // la rejilla entera a julio ni dispara una petición nueva.
          onSelectDay={onSelectDay}
          onDrillDown={(date) => onDrillDownTo(date, "day")}
          onOpenBooking={onOpenBooking}
        />
      ) : (
        <TimeGrid
          days={visibleDays}
          ranges={ranges}
          bookings={bookings}
          blockedTimes={blockedTimes}
          selectedDate={selectedDate}
          onSelectDay={(date) => {
            // En semana, clic en el encabezado de un día baja a la vista de ese día.
            if (view === "week") onDrillDownTo(date, "day");
          }}
          onBookInGap={onBookInGap}
          onDeleteRange={onDeleteRange}
          onOpenBooking={onOpenBooking}
        />
      )}
    </div>
  );
}
