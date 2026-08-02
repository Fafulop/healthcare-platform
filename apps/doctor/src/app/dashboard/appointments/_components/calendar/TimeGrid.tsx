"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff, MapPin, Trash2 } from "lucide-react";
import { getLocalDateString, getClinicDateString, getClinicMinutesOfDay } from "@/lib/dates";
import {
  buildDayEvents, layoutDayEvents, computeFreeGaps,
  minToTime, timeToMin, statusMeta, FREES_THE_SLOT,
  type TimedBooking, type PositionedEvent,
} from "../../_lib/event-model";
import { DAY_NAMES_SHORT } from "../../_lib/calendar-labels";
import type { AvailabilityRange } from "../../_hooks/useRanges";
import type { BlockedTime } from "../../_hooks/useBlockedTimes";

/** Alto de una hora. Con 48px un bloque de 30 min mide 24px — el mínimo legible. */
const HOUR_PX = 48;
/** Ventana por defecto cuando el día no tiene nada que encuadrar. */
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;

interface Props {
  days: Date[];
  ranges: AvailabilityRange[];
  bookings: TimedBooking[];
  blockedTimes: BlockedTime[];
  onBookInGap: (date: string, startTime: string) => void;
  onDeleteRange: (rangeId: string) => void;
  onSelectDay: (date: Date) => void;
  selectedDate: Date;
}

interface DayModel {
  date: Date;
  dateStr: string;
  ranges: AvailabilityRange[];
  events: PositionedEvent[];
  gaps: Array<{ start: number; end: number }>;
}

export function TimeGrid({
  days, ranges, bookings, blockedTimes,
  onBookInGap, onDeleteRange, onSelectDay, selectedDate,
}: Props) {
  // La línea de "ahora" se recalcula cada minuto. Se deriva de la hora de la CLÍNICA, no
  // del navegador: son la misma sólo si el doctor está físicamente en el huso de México.
  const [nowMin, setNowMin] = useState(() => getClinicMinutesOfDay());
  useEffect(() => {
    const id = setInterval(() => setNowMin(getClinicMinutesOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getClinicDateString();

  const dayModels: DayModel[] = useMemo(() => days.map((date) => {
    const dateStr = getLocalDateString(date);
    const dayRanges = ranges.filter((r) => r.date.split("T")[0] === dateStr);
    const events = buildDayEvents(dateStr, bookings, blockedTimes);
    return {
      date,
      dateStr,
      ranges: dayRanges,
      events: layoutDayEvents(events),
      gaps: computeFreeGaps(dayRanges, events),
    };
  }), [days, ranges, bookings, blockedTimes]);

  // Encuadre vertical: se estira para que quepa todo lo que hay, nunca se encoge por
  // debajo de la franja por defecto. Sin esto una cita a las 6 AM quedaría fuera de vista.
  const [startHour, endHour] = useMemo(() => {
    let min = DEFAULT_START_HOUR * 60;
    let max = DEFAULT_END_HOUR * 60;
    for (const d of dayModels) {
      for (const r of d.ranges) {
        min = Math.min(min, timeToMin(r.startTime));
        max = Math.max(max, timeToMin(r.endTime));
      }
      for (const e of d.events) {
        min = Math.min(min, e.startMin);
        max = Math.max(max, Math.max(e.endMin, e.blockEndMin));
      }
    }
    return [Math.floor(min / 60), Math.ceil(max / 60)];
  }, [dayModels]);

  const totalMin = (endHour - startHour) * 60;
  const gridHeight = (totalMin / 60) * HOUR_PX;
  const topFor = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX;
  const heightFor = (from: number, to: number) => Math.max(((to - from) / 60) * HOUR_PX, 14);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const isWeek = days.length > 1;

  // El panel de día decía "Sin disponibilidad este día"; sin esto, un día vacío es una
  // rejilla en blanco que no distingue "no hay nada" de "no cargó".
  const isEmpty = dayModels.every((d) => d.ranges.length === 0 && d.events.length === 0);

  return (
    // overflow-x-auto: con el panel del asistente acoplado la página se angosta y 7 columnas
    // no caben. Se desplaza en horizontal en vez de aplastar las columnas hasta lo ilegible.
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: isWeek ? `${56 + days.length * 110}px` : undefined }}>
          {/* Encabezado de días */}
          <div
            className="grid border-b border-gray-200 sticky top-0 bg-white z-20"
            style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div />
            {dayModels.map(({ date, dateStr }) => {
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === getLocalDateString(selectedDate);
              return (
                <button
                  key={dateStr}
                  onClick={() => onSelectDay(date)}
                  className={`py-2 text-center border-l border-gray-100 transition-colors hover:bg-gray-50 ${
                    isSelected && isWeek ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">
                    {DAY_NAMES_SHORT[date.getDay()]}
                  </div>
                  <div
                    className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday ? "bg-blue-600 text-white" : "text-gray-800"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                </button>
              );
            })}
          </div>

          {isEmpty && (
            <div className="flex items-center justify-center gap-2 border-b border-gray-100 bg-gray-50/60 py-2 text-xs text-gray-400">
              <CalendarOff className="h-3.5 w-3.5" />
              {isWeek ? "Sin disponibilidad esta semana" : "Sin disponibilidad este día"}
            </div>
          )}

          {/* Rejilla */}
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
              height: `${gridHeight}px`,
            }}
          >
            {/* Canal de horas */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400 tabular-nums"
                  style={{ top: `${(h - startHour) * HOUR_PX}px` }}
                >
                  {h === startHour ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {dayModels.map((day) => (
              <DayColumn
                key={day.dateStr}
                day={day}
                hours={hours}
                startHour={startHour}
                topFor={topFor}
                heightFor={heightFor}
                onBookInGap={onBookInGap}
                onDeleteRange={onDeleteRange}
                showNowLine={day.dateStr === todayStr}
                nowTop={topFor(nowMin)}
                nowVisible={nowMin >= startHour * 60 && nowMin <= endHour * 60}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day, hours, startHour, topFor, heightFor,
  onBookInGap, onDeleteRange, showNowLine, nowTop, nowVisible,
}: {
  day: DayModel;
  hours: number[];
  startHour: number;
  topFor: (min: number) => number;
  heightFor: (from: number, to: number) => number;
  onBookInGap: (date: string, startTime: string) => void;
  onDeleteRange: (rangeId: string) => void;
  showNowLine: boolean;
  nowTop: number;
  nowVisible: boolean;
}) {
  return (
    <div className="relative border-l border-gray-100">
      {/* Líneas de hora */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-gray-100"
          style={{ top: `${(h - startHour) * HOUR_PX}px` }}
        />
      ))}

      {/* Rangos de disponibilidad como FONDO. El API garantiza que no se solapan entre sí
          (`ranges/route.ts` rechaza el traslape), así que no necesitan carriles. */}
      {day.ranges.map((r) => {
        const top = topFor(timeToMin(r.startTime));
        const height = heightFor(timeToMin(r.startTime), timeToMin(r.endTime));
        return (
          <div
            key={r.id}
            className="absolute inset-x-0 bg-blue-50/70 border-y border-blue-100 pointer-events-none"
            style={{ top: `${top}px`, height: `${height}px` }}
          />
        );
      })}

      {/* Controles del rango — SIEMPRE visibles y por encima de todo (z-20).
          Antes se revelaban con `group-hover` sobre el fondo del rango, y eso no funcionaba:
          los huecos (z-5) y las citas (z-10) son HERMANOS del fondo, no descendientes, así
          que apuntarles daba `:hover` a la columna y nunca al rango. En escritorio el botón
          casi nunca aparecía; en táctil no aparecía jamás pero seguía recibiendo el toque.
          Como esta rejilla sustituyó al panel de día, era la ÚNICA forma de borrar un rango. */}
      {day.ranges.map((r) => (
        <div
          key={`ctl-${r.id}`}
          className="absolute right-1 z-20 flex items-center gap-1"
          style={{ top: `${topFor(timeToMin(r.startTime)) + 2}px` }}
        >
          <span className="flex items-center gap-1 rounded bg-white/90 px-1 py-0.5 text-[10px] text-gray-600 shadow-sm">
            {r.location && (
              <span className="hidden items-center gap-0.5 text-indigo-600 sm:flex">
                <MapPin className="h-2.5 w-2.5" />
                {r.location.name}
              </span>
            )}
            {/* `intervalMinutes` sólo se veía en el encabezado del panel de día; sin esto
                el doctor no tenía dónde consultar el intervalo de un rango ya creado. */}
            <span className="whitespace-nowrap">cada {r.intervalMinutes} min</span>
          </span>
          <button
            onClick={() => onDeleteRange(r.id)}
            title={`Eliminar rango ${r.startTime}–${r.endTime}`}
            className="rounded bg-white/90 p-1 text-red-600 shadow-sm hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Huecos libres — clic para agendar, igual que en el panel de día */}
      {day.gaps.map((gap) => (
        <button
          key={`gap-${gap.start}`}
          onClick={() => onBookInGap(day.dateStr, minToTime(gap.start))}
          title={`${minToTime(gap.start)}–${minToTime(gap.end)} libre — clic para agendar`}
          className="absolute inset-x-0.5 rounded border border-dashed border-transparent hover:border-green-400 hover:bg-green-50/60 transition-colors z-[5]"
          style={{ top: `${topFor(gap.start)}px`, height: `${heightFor(gap.start, gap.end)}px` }}
        />
      ))}

      {/* Eventos */}
      {day.events.map((ev) => {
        const width = 100 / ev.cols;
        const left = ev.col * width;
        const style = {
          top: `${topFor(ev.startMin)}px`,
          height: `${heightFor(ev.startMin, ev.endMin)}px`,
          left: `calc(${left}% + 2px)`,
          width: `calc(${width}% - 4px)`,
        };

        if (ev.kind === "blocked") {
          return (
            <div
              key={ev.id}
              title={ev.reason ? `Bloqueado — ${ev.reason}` : "Bloqueado"}
              className="absolute z-10 rounded border border-orange-300 overflow-hidden"
              style={{
                ...style,
                // Rayado diagonal: se lee como "no disponible" sin competir con las citas.
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgb(255 237 213) 0 6px, rgb(254 215 170) 6px 12px)",
              }}
            >
              <span className="block px-1 pt-0.5 text-[10px] font-medium text-orange-800 truncate">
                {ev.reason || "Bloqueado"}
              </span>
            </div>
          );
        }

        const meta = statusMeta(ev.status ?? "PENDING");
        const hasExtBlock = ev.blockEndMin > ev.endMin;
        // Una cita cancelada/completada LIBERA su horario, así que `computeFreeGaps` emite
        // un hueco agendable justo debajo de su bloque. Como el bloque va en z-10 y el hueco
        // en z-5, el bloque se comía el clic: cancelar la cita de las 10:00 y querer
        // reagendar ahí no hacía nada. Estos bloques son informativos y no tienen onClick,
        // así que los dejamos pasar el clic. Cuesta su tooltip; vale más poder reagendar.
        const freesTheSlot = FREES_THE_SLOT.has(ev.status ?? "");
        return (
          <div key={ev.id} className="contents">
            {/* Cola del bloqueo extendido: la consulta terminó pero la agenda sigue ocupada. */}
            {hasExtBlock && (
              <div
                className="absolute z-[9] rounded-b border-x border-b border-indigo-200 bg-indigo-50/80"
                title={`Bloqueo extendido hasta ${minToTime(ev.blockEndMin)}`}
                style={{
                  top: `${topFor(ev.endMin)}px`,
                  height: `${heightFor(ev.endMin, ev.blockEndMin)}px`,
                  left: style.left,
                  width: style.width,
                }}
              />
            )}
            <div
              title={`${minToTime(ev.startMin)}–${minToTime(ev.endMin)} · ${ev.label}${
                ev.sublabel ? ` (${ev.sublabel})` : ""
              } · ${meta.label}`}
              className={`absolute z-10 overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 transition-colors ${meta.blockBg} ${meta.blockBorder} ${
                freesTheSlot ? "pointer-events-none" : ""
              }`}
              style={style}
            >
              <div className={`text-[10px] font-semibold leading-tight truncate ${meta.blockText}`}>
                {ev.label}
              </div>
              <div className="text-[9px] leading-tight text-gray-600 truncate tabular-nums">
                {minToTime(ev.startMin)}–{minToTime(ev.endMin)}
                {ev.sublabel ? ` · ${ev.sublabel}` : ""}
              </div>
            </div>
          </div>
        );
      })}

      {/* Línea de ahora */}
      {showNowLine && nowVisible && (
        <div className="absolute inset-x-0 z-30 pointer-events-none" style={{ top: `${nowTop}px` }}>
          <div className="relative border-t-2 border-red-500">
            <span className="absolute -left-1 -top-[5px] block h-2 w-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}
