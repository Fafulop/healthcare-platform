"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { getLocalDateString } from "@/lib/dates";

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

  // Fetch availability when service + month change
  useEffect(() => {
    if (!selectedServiceId || !doctorSlug) return;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;

        const res = await fetch(
          `${API_URL}/api/doctors/${doctorSlug}/range-availability?serviceId=${selectedServiceId}&month=${monthStr}`
        );
        const data = await res.json();

        if (data.success) {
          setAvailableDates(data.availableDates || []);
          setTimeSlots(data.timeSlots || {});
        }
      } catch (err) {
        console.error("Error fetching range availability:", err);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [selectedServiceId, currentMonth, doctorSlug]);

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

  const today = getLocalDateString(new Date());
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
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
            2. Seleccionar Fecha
          </label>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2 bg-gray-50 px-3 py-1.5 rounded-lg">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month - 1))}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700 capitalize">
              {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month + 1))}
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
                const hasAvail = availableDates.includes(dateStr);
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

          {availableDates.length === 0 && !loadingAvailability && (
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
          {selectedDateSlots.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin horarios disponibles</p>
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
