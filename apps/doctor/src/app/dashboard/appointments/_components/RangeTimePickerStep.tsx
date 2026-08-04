"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { getClinicDateString } from "@/lib/dates";

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
   * Modo LIBRE: las horas salen de un día completo en vez de los rangos publicados, así que
   * el doctor puede agendar FUERA de sus rangos y también ENCIMA de uno.
   *
   * No es un modo de cuenta ni una bandera en `doctors`: es un interruptor de esta pantalla,
   * apagado por defecto. Quien usa rangos hoy no ve ningún cambio.
   * Diseño completo: `docs/DESDE JUNIO/CITAS/01-PLAN-agendar-sin-rango.md`.
   */
  const [freeform, setFreeform] = useState(false);
  /**
   * Carga del día en modo libre. SEPARADA de `loadingAvailability` a propósito: ésa apaga la
   * REJILLA del calendario, y en modo libre se pide por día, así que compartirla hacía
   * desaparecer el calendario entero —incluido el día recién clicado— en cada clic.
   */
  const [loadingSlots, setLoadingSlots] = useState(false);
  /** Errores del endpoint (400 del tope de días, sesión caída…). Sin esto, un fallo se
   *  rendía como "Sin horarios disponibles", que es una mentira distinta. */
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

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

  // Modo RANGOS — se pide por MES porque hace falta saber QUÉ DÍAS encender en el calendario.
  useEffect(() => {
    // ⚠️ El `false` explícito en CADA salida temprana no es defensivo, arregla un bloqueo
    // real: el `finally` NO apaga el spinner si la petición fue abortada (para que una
    // respuesta vieja no apague el de la nueva), así que al prender el interruptor con una
    // petición en vuelo se abortaba, este efecto salía por `freeform` y el de modo libre
    // salía por `!selectedDate` — y `loadingAvailability` se quedaba en `true` PARA SIEMPRE,
    // con la rejilla del calendario sustituida por un spinner y sin forma de elegir fecha.
    if (freeform) { setLoadingAvailability(false); return; }
    if (!selectedServiceId || !doctorSlug) { setLoadingAvailability(false); return; }

    const abortController = new AbortController();

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailableDates([]);
      setTimeSlots({});
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
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching range availability:", err);
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingAvailability(false);
        }
      }
    };
    fetchAvailability();

    return () => abortController.abort();
  }, [selectedServiceId, currentMonth, doctorSlug, freeform]);

  /**
   * Modo LIBRE — se pide por DÍA, no por mes.
   *
   * En modo libre TODOS los días tienen disponibilidad, así que la pregunta "¿qué días
   * encender?" no existe: pedir el mes serían ~31 × 96 entradas para pintar un calendario
   * donde todo está encendido. Pidiendo el día seleccionado, la respuesta baja a ≤96.
   *
   * ⚠️ `authFetch`, no `fetch`: `freeform=1` sólo se atiende autenticado. El endpoint es
   * público y servirlo abierto dejaría deducir la agenda ocupada del doctor por inversión
   * (toda hora que no vuelve está tomada). Ver 01-PLAN §3.
   */
  useEffect(() => {
    if (!freeform) { setLoadingSlots(false); return; }
    if (!selectedServiceId || !doctorSlug || !selectedDate) {
      setLoadingSlots(false);
      setTimeSlots({});
      return;
    }

    const abortController = new AbortController();

    const fetchFreeform = async () => {
      setLoadingSlots(true);
      setAvailabilityError(null);
      setTimeSlots({});
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
        // modo servido, la UI seguiría mostrando el interruptor prendido y el aviso de
        // "cualquier hora" sobre una lista que sólo trae horas publicadas. Se corrige sola.
        if (data.freeform !== true) {
          setFreeform(false);
          setAvailabilityError(
            "Tu sesión no permite ver todos los horarios ahora mismo. Se muestran los de tus rangos."
          );
          return;
        }

        setTimeSlots(data.timeSlots || {});
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
  }, [selectedServiceId, selectedDate, doctorSlug, freeform]);

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
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700">
              2. Seleccionar Fecha
            </label>
            {/* Interruptor del modo libre. Apagado por defecto: quien usa rangos no cambia. */}
            <button
              type="button"
              role="switch"
              aria-checked={freeform}
              onClick={() => {
                setFreeform((v) => !v);
                setSelectedDate(null);
                setAvailabilityError(null);
              }}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>Ver todos los horarios</span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  freeform ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    freeform ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>

          {freeform && (
            <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 mb-2">
              Puedes agendar a cualquier hora, dentro o fuera de tus rangos. Los horarios ya
              ocupados por una cita o un bloqueo no aparecen.
            </p>
          )}

          {availabilityError && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
              {availabilityError}
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
                // En modo libre TODO día no pasado es elegible: no hay rangos que consultar,
                // y las horas ocupadas se filtran después, al pedir las del día.
                const hasAvail = freeform || availableDates.includes(dateStr);
                const isSelected = dateStr === selectedDate;
                const isPast = dateStr < today;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => hasAvail && !isPast && setSelectedDate(dateStr)}
                    disabled={!hasAvail || isPast}
                    className={`aspect-square rounded-md text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : hasAvail && !isPast
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : isPast
                        ? "text-gray-300"
                        : "text-gray-400"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}

          {/* ⚠️ Sólo en modo RANGOS: `availableDates` está vacío SIEMPRE en modo libre (no se
              pide por mes), así que sin este guard el aviso saldría en todos los días. */}
          {!freeform && availableDates.length === 0 && !loadingAvailability && (
            <div className="text-center py-3">
              <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Sin disponibilidad para este servicio</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Time */}
      {selectedDate && selectedService && (
        <div className="border-t pt-4">
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
            3. Seleccionar Hora
          </label>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            </div>
          ) : selectedDateSlots.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin horarios disponibles</p>
          ) : freeform ? (
            /* Desplegable, no rejilla: un día completo a 15 min son hasta 96 opciones y una
               rejilla de 96 botones es inusable. La rejilla se queda para el modo rangos,
               donde son ~6-12. */
            <select
              defaultValue=""
              onChange={(e) => {
                const slot = selectedDateSlots.find((s) => s.startTime === e.target.value);
                if (!slot || !selectedService) return;
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
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="" disabled>
                -- Elige una hora ({selectedDateSlots.length} disponibles) --
              </option>
              {selectedDateSlots.map((slot) => (
                <option key={slot.startTime} value={slot.startTime}>
                  {slot.startTime} – {slot.endTime}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {selectedDateSlots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() =>
                    onSelectTime({
                      date: selectedDate,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      serviceId: selectedService.id,
                      serviceName: selectedService.serviceName,
                      duration: selectedService.durationMinutes,
                      price: Number(selectedService.price),
                      locationName: slot.locationName,
                    })
                  }
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
        </div>
      )}
    </div>
  );
}
