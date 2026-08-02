import { useState, useMemo, useCallback } from "react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addDays, addWeeks, addMonths, addYears,
} from "date-fns";
import { getLocalDateString, todayInClinicTz, parseLocalDateAtNoon } from "@/lib/dates";

/** Vistas al estilo Google Calendar. */
export type CalendarView = "day" | "week" | "month" | "year";

/**
 * La semana arranca en DOMINGO para no contradecir la rejilla de mes que ya existe
 * (`AppointmentsCalendar` rotula Dom→Sáb). Si algún día se cambia, se cambia en los dos.
 */
const WEEK_STARTS_ON = 0 as const;

/** Ventana de fechas efectivamente VISIBLE — es también lo que hay que traer del API. */
export interface CalendarWindow {
  start: Date;
  end: Date;
}

/**
 * Ventana del mes natural. Es lo que `useRanges`/`useBlockedTimes` derivaban solos antes de
 * recibir la ventana desde afuera; queda exportado para las páginas heredadas (`v2`), que
 * siguen siendo mensuales y no tienen selector de vista.
 */
export function monthWindowFor(date: Date): CalendarWindow {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

/**
 * Ventana visible de cada vista.
 *
 * `month` se extiende a semanas COMPLETAS porque la rejilla pinta los días de relleno del
 * mes anterior/siguiente: sin esto esos días saldrían siempre vacíos aunque tengan citas.
 */
function windowFor(date: Date, view: CalendarView): CalendarWindow {
  switch (view) {
    case "day":
      return { start: date, end: date };
    case "week":
      return {
        start: startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
      };
    case "month":
      return {
        start: startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(endOfMonth(date), { weekStartsOn: WEEK_STARTS_ON }),
      };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
  }
}

export function useCalendar() {
  /**
   * DOS estados, no uno.
   *
   * `anchorDate` decide QUÉ PERIODO está en pantalla (la ventana, el mes en foco, el
   * rótulo). `selectedDate` decide QUÉ DÍA está resaltado. Estaban fundidos en uno solo, y
   * por eso hacer clic en un día de relleno del mes vecino —el "26" de julio mientras ves
   * agosto— reencuadraba la rejilla entera a julio y volvía a pedir datos. Seleccionar un
   * día no debe mover el periodo.
   *
   * Ambos anclados al MEDIODÍA en hora de la clínica: `new Date()` del navegador ya cae en
   * el día siguiente a partir de las 18:00 (UTC−6).
   */
  const [anchorDate, setAnchorDate] = useState<Date>(() => todayInClinicTz());
  const [selectedDate, setSelectedDate] = useState<Date>(() => todayInClinicTz());
  const [view, setViewRaw] = useState<CalendarView>("week");

  // --- Campos heredados: los consumen `v1` (lista de slots) y `v2`. No quitar. ---
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [listDate, setListDate] = useState<string>(getLocalDateString(todayInClinicTz()));
  const [showAllSlots, setShowAllSlots] = useState(false);

  const selectedDateStr = getLocalDateString(selectedDate);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  // --- Navegación por vista ---

  const visibleWindow = useMemo(() => windowFor(anchorDate, view), [anchorDate, view]);

  /** Días que pinta la vista actual (1 en día, 7 en semana, 35-42 en mes). */
  const visibleDays = useMemo(() => {
    if (view === "year") return [];
    const days: Date[] = [];
    const { start, end } = visibleWindow;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      days.push(parseLocalDateAtNoon(getLocalDateString(d)));
    }
    return days;
  }, [visibleWindow, view]);

  const step = useCallback((current: Date, direction: 1 | -1) => {
    switch (view) {
      case "day":   return addDays(current, direction);
      case "week":  return addWeeks(current, direction);
      case "month": return addMonths(current, direction);
      case "year":  return addYears(current, direction);
    }
  }, [view]);

  /**
   * `‹ ›` mueven el ancla Y la selección el mismo salto, para que el día resaltado viaje
   * con el periodo en vez de quedarse atrás fuera de la pantalla.
   */
  const shift = useCallback((direction: 1 | -1) => {
    setAnchorDate((current) => step(current, direction));
    setSelectedDate((current) => step(current, direction));
  }, [step]);

  const goPrev = useCallback(() => shift(-1), [shift]);
  const goNext = useCallback(() => shift(1), [shift]);

  const goToday = useCallback(() => {
    const today = todayInClinicTz();
    setAnchorDate(today);
    setSelectedDate(today);
  }, []);

  /** Selecciona un día SIN mover el periodo — es lo que arregla el clic en día de relleno. */
  const selectDay = useCallback((date: Date) => setSelectedDate(date), []);

  /** Baja de nivel: selecciona el día Y reencuadra el periodo en él. */
  const drillDownTo = useCallback((date: Date, nextView: CalendarView) => {
    setSelectedDate(date);
    setAnchorDate(date);
    setViewRaw(nextView);
  }, []);

  /**
   * Cambiar de vista reencuadra en el día SELECCIONADO: si elegiste el 26 de julio estando
   * en agosto y luego pides vista de Día, esperas ver el 26 de julio.
   */
  const setView = useCallback((next: CalendarView) => {
    setAnchorDate(selectedDate);
    setViewRaw(next);
  }, [selectedDate]);

  return {
    anchorDate,
    selectedDate,
    setSelectedDate,
    selectDay,
    drillDownTo,
    selectedDateStr,
    view,
    setView,
    visibleWindow,
    visibleDays,
    goPrev,
    goNext,
    goToday,
    // Heredados
    viewMode,
    setViewMode,
    listDate,
    setListDate,
    showAllSlots,
    setShowAllSlots,
    calendarDays,
    year,
    month,
  };
}
