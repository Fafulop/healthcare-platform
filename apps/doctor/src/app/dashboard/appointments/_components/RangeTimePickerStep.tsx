"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { getClinicDateString, getClinicMinutesOfDay } from "@/lib/dates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface AvailableTime {
  startTime: string;
  endTime: string;
  rangeId: string;
  locationId?: string | null;
  locationName?: string | null;
}

interface Service {
  id: string;
  serviceName: string;
  durationMinutes: number;
  price: number;
}

/**
 * Paso del selector nativo. Cosmético — sólo mueve las flechitas del `<input type="time">`.
 * NO se usa para validar nada: la rejilla real la define el servidor y aquí no se replica.
 */
const TIME_INPUT_STEP_SECONDS = 15 * 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

/**
 * Veredicto de la hora ESCRITA, resuelto contra la lista que devolvió el SERVIDOR.
 *
 * ⚠️ Esto NO decide disponibilidad — no sabe de buffers, bloqueos ni `extendedBlockMinutes`,
 * y no conoce el intervalo de la rejilla. Sólo pregunta "¿esta hora está en la lista de libres
 * que ya contestó el servidor?" y, si no, ofrece las libres MÁS CERCANAS de esa misma lista.
 * Replicar aquí las reglas de ocupación —o el intervalo— sería la lógica duplicada que la
 * regla 0 prohíbe (01-PLAN §3), y un intervalo hardcodeado se desincronizaría en silencio el
 * día que el servidor cambie el suyo.
 */
type TimeVerdict =
  | { kind: "empty" }
  | { kind: "ok"; slot: AvailableTime }
  /** No está libre, pero hay vecinas que sí; se ofrecen para no dejar al doctor adivinando. */
  | { kind: "nearest"; suggestions: AvailableTime[] }
  /** Ya pasó (hoy). El servidor tampoco la devuelve, pero "ocupada" sería una razón falsa. */
  | { kind: "past" }
  | { kind: "unavailable" };

function classifyTypedTime(
  value: string,
  freeByStart: Map<string, AvailableTime>,
  freeSlots: AvailableTime[],
  isToday: boolean,
  nowMinutes: number
): TimeVerdict {
  if (!value) return { kind: "empty" };

  const hit = freeByStart.get(value);
  if (hit) return { kind: "ok", slot: hit };

  const total = toMinutes(value);
  if (total === null) return { kind: "unavailable" };

  if (isToday && total < nowMinutes) return { kind: "past" };

  // La libre inmediatamente anterior y la inmediatamente posterior, sacadas de la lista del
  // servidor. Sin suponer cada cuánto van.
  let before: AvailableTime | null = null;
  let after: AvailableTime | null = null;
  for (const slot of freeSlots) {
    const start = toMinutes(slot.startTime);
    if (start === null) continue;
    if (start < total && (!before || start > toMinutes(before.startTime)!)) before = slot;
    if (start > total && (!after || start < toMinutes(after.startTime)!)) after = slot;
  }

  const suggestions = [before, after].filter((s): s is AvailableTime => Boolean(s));
  return suggestions.length > 0 ? { kind: "nearest", suggestions } : { kind: "unavailable" };
}

interface Props {
  doctorId: string;
  doctorSlug: string;
  /** Pre-selected service from parent (if any) */
  selectedServiceId: string | null;
  onSelectTime: (data: {
    date: string;
    startTime: string;
    endTime: string;
    serviceId: string;
    serviceName: string;
    duration: number;
    price: number;
    locationName?: string | null;
  }) => void;
}

export function RangeTimePickerStep({
  doctorId,
  doctorSlug,
  selectedServiceId: initialServiceId,
  onSelectTime,
}: Props) {
  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId);

  // Calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Availability
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<Record<string, AvailableTime[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  /**
   * Horas LIBRES del día elegido: el día completo a 15 min, dentro y fuera de los rangos.
   *
   * NO es un modo de pantalla — no hay interruptor. Convive con `timeSlots` (los rangos) en
   * todo momento: los rangos se rinden como botones y esta lista es contra la que se valida
   * la hora que el doctor ESCRIBE. El caso de uso que originó todo esto —"Sra. García, martes
   * 4pm"— es de hora conocida, y un desplegable de 96 opciones es un control de exploración
   * para una tarea donde no hay nada que explorar.
   * Diseño completo: `docs/DESDE JUNIO/CITAS/01-PLAN-agendar-sin-rango.md`.
   */
  const [freeSlots, setFreeSlots] = useState<AvailableTime[]>([]);
  /**
   * Carga del día. SEPARADA de `loadingAvailability` a propósito: ésa apaga la REJILLA del
   * calendario, y esto se pide por día, así que compartirla hacía desaparecer el calendario
   * entero —incluido el día recién clicado— en cada clic.
   */
  const [loadingSlots, setLoadingSlots] = useState(false);
  /**
   * `true` SÓLO cuando el servidor contestó bien Y sirvió de verdad el modo libre.
   *
   * ⚠️ Es la diferencia entre "no hay horas" y "no sé qué horas hay", y de ella cuelga todo
   * el paso 3. Sin este flag, CUALQUIER fallo (500, red caída, sesión muerta, member sin el
   * toggle de citas) deja `freeSlots` vacío y el veredicto contesta con total seguridad "esa
   * hora está ocupada" — de las 96 horas del día. El doctor se va a debuggear su agenda por
   * un error de red. Ver 01-PLAN §14 hallazgo 5: la lista vacía NO es una respuesta.
   */
  const [freeformReady, setFreeformReady] = useState(false);
  /** Errores del día (400 del tope, sesión caída, red…). Sin esto, un fallo se rendía como
   *  "Sin horarios disponibles", que es una mentira distinta. Se rinde junto al campo. */
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  /** Fallo de la petición del MES. Sin él, un 500 rendía "no tienes horarios publicados" —
   *  una afirmación de hecho sobre la agenda del doctor construida sobre una respuesta que
   *  nunca llegó. */
  const [monthError, setMonthError] = useState<string | null>(null);
  /** La hora escrita, en "HH:MM" 24h (lo que da `<input type="time">`). */
  const [typedTime, setTypedTime] = useState("");

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await authFetch("/api/doctor/services");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setServices(data.data);
          // Auto-select if only one service
          if (data.data.length === 1 && !selectedServiceId) {
            setSelectedServiceId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RANGOS — se pide por MES porque hace falta saber QUÉ DÍAS resaltar en el calendario.
  useEffect(() => {
    // ⚠️ El `false` explícito en CADA salida temprana no es defensivo, arregla un bloqueo
    // real: el `finally` NO apaga el spinner si la petición fue abortada (para que una
    // respuesta vieja no apague el de la nueva). Toda salida temprana que no dispare otra
    // petición deja encendido lo que encendió la anterior, y `loadingAvailability` se queda
    // en `true` PARA SIEMPRE — con la rejilla del calendario sustituida por un spinner y sin
    // forma de elegir fecha. Ver 01-PLAN §14 hallazgo 1.
    if (!selectedServiceId || !doctorSlug) { setLoadingAvailability(false); return; }

    const abortController = new AbortController();

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailableDates([]);
      setTimeSlots({});
      setMonthError(null);
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;

        const res = await fetch(
          `${API_URL}/api/doctors/${doctorSlug}/range-availability?serviceId=${selectedServiceId}&month=${monthStr}`,
          { signal: abortController.signal }
        );
        const data = await res.json();

        if (data.success) {
          setAvailableDates(data.availableDates || []);
          setTimeSlots(data.timeSlots || {});
        } else {
          setMonthError(data.error || "No se pudieron cargar tus horarios publicados.");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching range availability:", err);
        setMonthError("No se pudieron cargar tus horarios publicados.");
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingAvailability(false);
        }
      }
    };
    fetchAvailability();

    return () => abortController.abort();
  }, [selectedServiceId, currentMonth, doctorSlug]);

  /**
   * Horas libres del DÍA elegido — por día, nunca por mes.
   *
   * Pedir el mes serían ~31 × 96 = ~3 000 entradas, y no compran nada: lo único que el mes
   * necesita saber es qué días RESALTAR, y eso ya lo contesta la petición de rangos de
   * arriba. Pidiendo sólo el día seleccionado la respuesta baja a ≤96.
   *
   * ⚠️ `authFetch`, no `fetch`: `freeform=1` sólo se atiende autenticado. El endpoint es
   * público y servirlo abierto dejaría deducir la agenda ocupada del doctor por inversión
   * (toda hora que no vuelve está tomada). Ver 01-PLAN §3.
   */
  useEffect(() => {
    if (!selectedServiceId || !doctorSlug || !selectedDate) {
      setLoadingSlots(false);
      setFreeSlots([]);
      setFreeformReady(false);
      return;
    }

    const abortController = new AbortController();

    const fetchFreeform = async () => {
      setLoadingSlots(true);
      setAvailabilityError(null);
      setFreeSlots([]);
      // ⚠️ Se apaga al EMPEZAR, no sólo al fallar: si no, un fallo posterior heredaría el
      // "listo" de la petición anterior y el veredicto respondería con la lista de otro día.
      setFreeformReady(false);
      try {
        const params = new URLSearchParams({
          serviceId: selectedServiceId,
          startDate: selectedDate,
          endDate: selectedDate,
          freeform: "1",
        });
        const res = await authFetch(
          `${API_URL}/api/doctors/${doctorSlug}/range-availability?${params.toString()}`,
          { signal: abortController.signal }
        );
        const data = await res.json();

        if (!data.success) {
          setAvailabilityError(data.error || "No se pudieron cargar los horarios");
          return;
        }

        // El servidor IGNORA `freeform=1` si la sesión no es válida (o si a un member le
        // falta el permiso) y responde 200 con los horarios de los rangos. Sin comparar el
        // modo REALMENTE servido, el campo de escribir la hora validaría contra la lista de
        // rangos y diría "ocupada" de una hora libre. Ver 01-PLAN §14 hallazgo 5.
        if (data.freeform !== true) {
          setAvailabilityError(
            "Tu sesión no permite agendar fuera de tus rangos ahora mismo. Puedes elegir una de las horas de abajo, o vuelve a entrar."
          );
          return;
        }

        setFreeSlots(data.timeSlots?.[selectedDate] || []);
        setFreeformReady(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching freeform availability:", err);
        setAvailabilityError("No se pudieron cargar los horarios. Intenta de nuevo.");
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingSlots(false);
        }
      }
    };
    fetchFreeform();

    return () => abortController.abort();
  }, [selectedServiceId, selectedDate, doctorSlug]);

  // Calendar rendering
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [startDayOfWeek, daysInMonth]);

  const today = getClinicDateString();
  const selectedDateSlots = selectedDate ? timeSlots[selectedDate] || [] : [];
  const selectedService = services.find((s) => s.id === selectedServiceId);

  const freeByStart = useMemo(() => {
    const map = new Map<string, AvailableTime>();
    for (const slot of freeSlots) map.set(slot.startTime, slot);
    return map;
  }, [freeSlots]);

  const typedVerdict = useMemo(
    () =>
      classifyTypedTime(
        typedTime,
        freeByStart,
        freeSlots,
        selectedDate === today,
        getClinicMinutesOfDay()
      ),
    [typedTime, freeByStart, freeSlots, selectedDate, today]
  );

  /** Confirma una hora (venga de un botón de rango o del campo escrito). */
  const commitSlot = (slot: AvailableTime) => {
    if (!selectedDate || !selectedService) return;
    onSelectTime({
      date: selectedDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      serviceId: selectedService.id,
      serviceName: selectedService.serviceName,
      duration: selectedService.durationMinutes,
      price: Number(selectedService.price),
      locationName: slot.locationName,
    });
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Select Service */}
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
          1. Seleccionar Servicio *
        </label>
        {loadingServices ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-500">No hay servicios configurados.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(svc.id);
                  setSelectedDate(null);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                  selectedServiceId === svc.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{svc.serviceName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {svc.durationMinutes} min
                  </span>
                  {svc.price > 0 && (
                    <span className="text-xs font-medium text-blue-600">
                      ${Number(svc.price).toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Select Date (only after service is selected) */}
      {selectedServiceId && (
        <div className="border-t pt-4">
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
            2. Seleccionar Fecha
          </label>

          {/* El error del DÍA no vive aquí: se rinde pegado al campo de la hora, en el paso 3,
              porque es donde el doctor lo necesita y aquí arriba se le sale de la vista. */}
          {monthError && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
              {monthError}
            </p>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2 bg-gray-50 px-3 py-1.5 rounded-lg">
            {/* Cambiar de mes limpia la fecha elegida: si no, el paso 3 seguía ofreciendo las
                horas de un día que ya no está en la rejilla — y en modo libre esas horas ni
                siquiera se re-piden (el efecto no depende de `currentMonth`), así que se veían
                válidas. El doctor podía confirmar una hora de un día del que creía haber salido. */}
            <button
              type="button"
              onClick={() => { setCurrentMonth(new Date(year, month - 1)); setSelectedDate(null); }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700 capitalize">
              {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => { setCurrentMonth(new Date(year, month + 1)); setSelectedDate(null); }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {loadingAvailability ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 mb-3">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-gray-500 py-0.5">
                  {d}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                // ⚠️ TODO día no pasado es elegible, tenga rangos o no. Antes sólo lo eran los
                // días con rango, y eso dejaba al doctor SIN rangos sin ningún día que clicar:
                // nunca llegaba al paso 3 y por lo tanto no podía escribir una hora. El
                // resaltado sigue diciendo dónde hay rangos publicados; ya no es una reja.
                const hasRanges = availableDates.includes(dateStr);
                const isSelected = dateStr === selectedDate;
                const isPast = dateStr < today;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isPast) return;
                      setSelectedDate(dateStr);
                      setTypedTime("");
                    }}
                    disabled={isPast}
                    title={hasRanges ? "Tienes horarios publicados este día" : undefined}
                    className={`aspect-square rounded-md text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isPast
                        ? "text-gray-300"
                        : hasRanges
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}

          {/* ⚠️ Ya NO dice "sin disponibilidad": con el campo de hora escrita, un mes sin
              rangos publicados sigue siendo perfectamente agendable. Decir lo contrario
              mandaría al doctor a crear un rango que no piensa publicar — que es justo el
              precio que este trabajo existe para quitar. */}
          {availableDates.length === 0 && !loadingAvailability && !monthError && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              Este mes no tienes horarios publicados. Elige el día de todos modos y escribe la
              hora en el siguiente paso.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Select Time */}
      {selectedDate && selectedService && (
        <div className="border-t pt-4">
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
            3. Seleccionar Hora
          </label>
          {/* Horas de los RANGOS: siguen siendo botones. Son ~6-12 y el doctor que ya vive
              en sus rangos no debe notar ningún cambio. */}
          {selectedDateSlots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {selectedDateSlots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => { setTypedTime(""); commitSlot(slot); }}
                  className="flex flex-col items-center py-2 px-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-xs"
                >
                  <span className="font-semibold text-gray-900">{slot.startTime}</span>
                  <span className="text-[10px] text-gray-400">{slot.endTime}</span>
                  {slot.locationName && (
                    <span className="text-[9px] text-indigo-500 truncate w-full text-center mt-0.5 flex items-center justify-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {slot.locationName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Hora ESCRITA. No es un modo aparte ni un fallback: es el camino de "ya sé la
              hora", que es como el doctor llega a esta pantalla la mayoría de las veces. */}
          <div className={selectedDateSlots.length > 0 ? "mt-3 pt-3 border-t border-dashed" : ""}>
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="hora-libre" className="text-xs text-gray-600 shrink-0">
                {selectedDateSlots.length > 0 ? "¿Otra hora?" : "Escribe la hora:"}
              </label>
              {/* ⚠️ NUNCA confirmar en `onChange`. `type="time"` sí emite valores completos a
                  medio editar: con "16:00" puesto, teclear el "1" de las 17:00 emite "01:00"
                  —los minutos se conservan— y esa hora está libre en cualquier día futuro, así
                  que confirmar al vuelo saltaba al formulario con una cita a la 1:00 AM antes
                  de poder teclear el "7". Las flechitas hacen lo mismo desde vacío ("00:00").
                  El veredicto se muestra al escribir; CONFIRMAR es un acto aparte. */}
              <input
                id="hora-libre"
                type="time"
                step={TIME_INPUT_STEP_SECONDS}
                value={typedTime}
                disabled={loadingSlots || !freeformReady}
                onChange={(e) => setTypedTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typedVerdict.kind === "ok") {
                    e.preventDefault();
                    commitSlot(typedVerdict.slot);
                  }
                }}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-400"
              />
              {typedVerdict.kind === "ok" && freeformReady && !loadingSlots && (
                <button
                  type="button"
                  onClick={() => commitSlot(typedVerdict.slot)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Usar {typedVerdict.slot.startTime} – {typedVerdict.slot.endTime}
                </button>
              )}
              {loadingSlots && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
            </div>

            {/* La razón del día, pegada al campo que deshabilita. */}
            {availabilityError && !loadingSlots && (
              <p className="mt-1.5 text-[11px] text-amber-700">{availabilityError}</p>
            )}

            {/* ⚠️ El veredicto SÓLO se rinde con una lista real del servidor. Con `freeSlots`
                vacío por un 500 o una sesión caída, "esa hora no está libre" sería una
                afirmación segura sobre las 96 horas del día construida sobre una respuesta que
                nunca llegó — y manda al doctor a revisar su agenda por un fallo de red. */}
            {freeformReady && !loadingSlots && (
              <div className="mt-1.5 text-[11px]">
                {typedVerdict.kind === "ok" && (
                  <p className="text-green-700">Libre. Confirma con el botón o con Enter.</p>
                )}
                {typedVerdict.kind === "past" && (
                  <p className="text-amber-700">Esa hora ya pasó.</p>
                )}
                {typedVerdict.kind === "nearest" && (
                  <p className="text-amber-700 flex items-center gap-1.5 flex-wrap">
                    <span>Esa hora no está libre. Más cerca:</span>
                    {typedVerdict.suggestions.map((s) => (
                      <button
                        key={s.startTime}
                        type="button"
                        onClick={() => { setTypedTime(s.startTime); commitSlot(s); }}
                        className="px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 font-medium"
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </p>
                )}
                {typedVerdict.kind === "unavailable" && (
                  <p className="text-amber-700">
                    Esa hora no está libre: hay una cita, un bloqueo, o la consulta no alcanza a
                    terminar en el día.
                  </p>
                )}
                {typedVerdict.kind === "empty" && (
                  <p className="text-gray-400">
                    Dentro o fuera de tus rangos. Las horas ocupadas se rechazan.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sólo con lista confirmada del servidor: si no, "no hay ninguna hora libre" es lo
              que se rinde ante un error de red, y es la peor mentira posible aquí — dice que
              el día está lleno cuando lo que falló fue la petición. */}
          {freeformReady && selectedDateSlots.length === 0 && freeSlots.length === 0 && !loadingSlots && (
            <p className="mt-2 text-[11px] text-gray-400">
              Este día no tiene ninguna hora libre para este servicio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
