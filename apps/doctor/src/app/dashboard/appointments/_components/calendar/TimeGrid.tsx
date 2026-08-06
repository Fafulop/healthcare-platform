"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff, MapPin, Trash2 } from "lucide-react";
import { getLocalDateString, getClinicDateString, getClinicMinutesOfDay } from "@/lib/dates";
import {
  buildDayEvents, layoutDayEvents, computeOpenSpans, snapToGrid,
  minToTime, timeToMin, statusMeta, BOOKING_GRID_MINUTES,
  type TimedBooking, type PositionedEvent, type Span,
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
  /** Clic en el bloque de una cita → abre su modal de acciones. */
  onOpenBooking: (bookingId: string) => void;
  selectedDate: Date;
}

interface DayModel {
  date: Date;
  dateStr: string;
  ranges: AvailabilityRange[];
  events: PositionedEvent[];
  /** Lo LIBRE de la ventana visible, dentro y fuera de rango. Es lo clicable. */
  openSpans: Span[];
}

export function TimeGrid({
  days, ranges, bookings, blockedTimes,
  onBookInGap, onDeleteRange, onSelectDay, onOpenBooking, selectedDate,
}: Props) {
  // La línea de "ahora" se recalcula cada minuto. Se deriva de la hora de la CLÍNICA, no
  // del navegador: son la misma sólo si el doctor está físicamente en el huso de México.
  const [nowMin, setNowMin] = useState(() => getClinicMinutesOfDay());
  useEffect(() => {
    const id = setInterval(() => setNowMin(getClinicMinutesOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getClinicDateString();

  const dayBases = useMemo(() => days.map((date) => {
    const dateStr = getLocalDateString(date);
    return {
      date,
      dateStr,
      ranges: ranges.filter((r) => r.date.split("T")[0] === dateStr),
      events: layoutDayEvents(buildDayEvents(dateStr, bookings, blockedTimes)),
    };
  }), [days, ranges, bookings, blockedTimes]);

  // Encuadre vertical: se estira para que quepa todo lo que hay, nunca se encoge por
  // debajo de la franja por defecto. Sin esto una cita a las 6 AM quedaría fuera de vista.
  const [startHour, endHour] = useMemo(() => {
    let min = DEFAULT_START_HOUR * 60;
    let max = DEFAULT_END_HOUR * 60;
    for (const d of dayBases) {
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
  }, [dayBases]);

  /**
   * Lo clicable de cada día: TODO lo libre de la ventana visible, no sólo lo que cae dentro
   * de un rango publicado. Es lo que hace agendable un día sin ningún rango — la pantalla
   * muerta que originó este trabajo.
   *
   * ⚠️ Se calcula DESPUÉS del encuadre porque depende de él: la ventana visible es el límite
   * de lo que se puede clicar, y se estira sola para cubrir rangos y citas.
   *
   * Lo PASADO se recorta (hoy, hasta la hora de la clínica; los días anteriores, enteros): el
   * picker rechazaría esa hora con "ya pasó", y ofrecer un clic que sólo puede terminar en un
   * rechazo es peor que no ofrecerlo.
   *
   * ⚠️ `nowMin + 1`, no `nowMin`: en modo libre el servidor conserva estrictamente
   * `startTime > now` (`applyPastFilter`), así que el minuto EXACTO de ahora no está en su
   * lista y el picker lo clasifica como pasado. Es el mismo `<=` que ya vive en
   * `classifyTypedTime`; aquí se replica el BORDE, no la regla de ocupación.
   * ⚠️ El corte de 1 hora NO se replica a propósito: `freeform` no lo aplica (la ruta lo dice
   * y el agente ya manda `skipCutoff=1`), así que el doctor puede agendar dentro de la hora.
   */
  const dayModels: DayModel[] = useMemo(() => dayBases.map((base) => {
    const windowStart = base.dateStr === todayStr
      ? Math.max(startHour * 60, nowMin + 1)
      : startHour * 60;
    const openSpans = base.dateStr < todayStr
      ? []
      : computeOpenSpans(base.events, windowStart, endHour * 60);
    return { ...base, openSpans };
  }), [dayBases, startHour, endHour, todayStr, nowMin]);

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

          {/* Franja de RANGOS — fuera de la rejilla a propósito.
              Estos datos describen el DÍA, no un instante suyo, así que colocarlos dentro
              de la rejilla obligaba a elegir entre taparse con las citas (estaban encima, a
              z-20, justo sobre la cita de las 09:00 y no se leía) o quedar inalcanzables
              debajo. Aquí no compiten con nada, se ven sin hover y funcionan en táctil. */}
          {dayModels.some((d) => d.ranges.length > 0) && (
            <div
              className="grid border-b border-gray-100 bg-gray-50/50"
              style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <div className="py-1 pr-2 text-right text-[10px] uppercase tracking-wide text-gray-300">
                Rangos
              </div>
              {dayModels.map((day) => (
                <div key={`rs-${day.dateStr}`} className="flex flex-wrap gap-1 border-l border-gray-100 p-1">
                  {day.ranges.map((r) => (
                    <span
                      key={r.id}
                      title={`${r.startTime}–${r.endTime} · cada ${r.intervalMinutes} min${
                        r.location ? ` · ${r.location.name}` : ""
                      }`}
                      className="flex max-w-full flex-wrap items-center gap-x-1 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] text-blue-800"
                    >
                      <span className="whitespace-nowrap font-medium tabular-nums">
                        {r.startTime}–{r.endTime}
                      </span>
                      {/* Intervalo y ubicación se ven SIEMPRE, también en Semana. Estuvieron
                          sólo en el `title`, y un tooltip no existe en táctil: en una tablet
                          no había forma de leerlos — que es exactamente el problema que este
                          rework venía a resolver. En Semana se abrevian y envuelven de línea
                          en vez de esconderse. */}
                      <span className="whitespace-nowrap text-gray-500">
                        {isWeek ? `${r.intervalMinutes} min` : `cada ${r.intervalMinutes} min`}
                      </span>
                      {r.location && (
                        <span className="flex min-w-0 items-center gap-0.5 text-indigo-600">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{r.location.name}</span>
                        </span>
                      )}
                      {/* p-1.5 + icono de 14px ≈ 26px de área tocable: por encima del mínimo
                          de 24px, que para una acción DESTRUCTIVA no es opcional. */}
                      <button
                        onClick={() => onDeleteRange(r.id)}
                        title={`Eliminar rango ${r.startTime}–${r.endTime}`}
                        aria-label={`Eliminar rango ${r.startTime}–${r.endTime}`}
                        className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

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
                onOpenBooking={onOpenBooking}
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
  onBookInGap, onOpenBooking, showNowLine, nowTop, nowVisible,
}: {
  day: DayModel;
  hours: number[];
  startHour: number;
  topFor: (min: number) => number;
  heightFor: (from: number, to: number) => number;
  onBookInGap: (date: string, startTime: string) => void;
  onOpenBooking: (bookingId: string) => void;
  // Sin `onDeleteRange`: borrar un rango vive ahora en la franja "Rangos", fuera de la
  // rejilla. Dejarlo aquí sugeriría que esta columna todavía puede borrar.
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

      {/* Lo libre del día — clic para agendar, DENTRO o FUERA de un rango.
          La hora sale de DÓNDE se clicó, alineada a la rejilla de 15 min: un hueco puede
          durar horas, así que mandar siempre su inicio agendaría a las 07:00 a quien clicó
          las 16:20. El fondo azul de los rangos sigue diciendo qué está publicado; ya no
          decide qué es clicable. */}
      {day.openSpans.map((span) => (
        <button
          key={`open-${span.start}`}
          type="button"
          onClick={(e) => {
            // `detail === 0` = activado con TECLADO (Enter/Espacio): no hay punto de clic,
            // así que se propone el primer inicio de rejilla del hueco.
            const rect = e.currentTarget.getBoundingClientRect();
            const clicked = e.detail === 0 || rect.height === 0
              ? span.start
              : span.start + ((e.clientY - rect.top) / rect.height) * (span.end - span.start);
            onBookInGap(day.dateStr, minToTime(snapToGrid(clicked, span)));
          }}
          title={`${minToTime(span.start)}–${minToTime(span.end)} libre — clic para agendar (bloques de ${BOOKING_GRID_MINUTES} min; en el formulario puedes escribir cualquier minuto)`}
          aria-label={`Agendar entre ${minToTime(span.start)} y ${minToTime(span.end)}`}
          className="absolute inset-x-0.5 rounded border border-dashed border-transparent hover:border-green-400 hover:bg-green-50/60 transition-colors z-[5]"
          style={{ top: `${topFor(span.start)}px`, height: `${heightFor(span.start, span.end)}px` }}
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
            {/* <button>, no <div>: el bloque ABRE el modal de la cita, así que tiene que
                ser alcanzable con teclado y anunciarse como acción. Sus hijos son <span
                className="block">: un <div> dentro de un <button> es anidamiento inválido. */}
            <button
              type="button"
              onClick={() => onOpenBooking(ev.id)}
              title={`${minToTime(ev.startMin)}–${minToTime(ev.endMin)} · ${ev.label}${
                ev.sublabel ? ` (${ev.sublabel})` : ""
              } · ${meta.label} — clic para ver sus acciones`}
              // El `aria-label` SUSTITUYE al `title` como nombre accesible, no se suman: si
              // aquí falta algo que el tooltip sí dice, un lector de pantalla lo pierde. Por
              // eso lleva también hora de fin y estado.
              aria-label={`Cita de ${ev.label}, ${minToTime(ev.startMin)} a ${minToTime(ev.endMin)}, ${meta.label}. Ver sus acciones`}
              // Los bloques conservan sus eventos de puntero, o sea su tooltip.
              //
              // Hubo un `pointer-events-none` para los estados que LIBERAN el horario: sin él,
              // el bloque (z-10) se comía el clic del hueco (z-5) y no se podía reagendar
              // encima de una cita cancelada. Ese caso desapareció al ocultar las canceladas
              // del calendario; lo que quedaba cubierto eran `COMPLETED` y `NO_SHOW`, o sea
              // prácticamente todo el pasado — y ahí el clic-para-agendar no vale nada (nadie
              // agenda hacia atrás) mientras que el tooltip sí: en Semana las columnas miden
              // ~110px, el nombre del paciente va truncado y el tooltip era la ÚNICA forma de
              // leerlo. Se cambiaba información de uso diario por un clic que nadie hace.
              // Ahora ese mismo clic vale MÁS: abre el modal con las acciones de la cita, que
              // es justo lo que hace falta sobre una completada (cobrar, facturar, papeleo).
              // `block` + `text-left` no son cosmética: un <button> centra su contenido en
              // los dos ejes, así que sin ellos el nombre del paciente saldría centrado y —en
              // un bloque de 1 h (48px)— separado del borde superior, en vez de arrancar
              // arriba a la izquierda como cuando esto era un <div>.
              className={`absolute z-10 block overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left transition-colors ${meta.blockBg} ${meta.blockBorder}`}
              style={style}
            >
              <span className={`block text-[10px] font-semibold leading-tight truncate ${meta.blockText}`}>
                {ev.label}
              </span>
              <span className="block text-[9px] leading-tight text-gray-600 truncate tabular-nums">
                {minToTime(ev.startMin)}–{minToTime(ev.endMin)}
                {ev.sublabel ? ` · ${ev.sublabel}` : ""}
              </span>
            </button>
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
