"use client";

import { Calendar, Clock, Loader2, Stethoscope, MapPin, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { formatLocalDate } from "@/lib/dates";
import type { AppointmentSlot } from "../../_hooks/useSlots";
import type { ClinicLocation } from "../../_hooks/useSlots";

function calcEndTime(startTime: string, duration: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const endMins = h * 60 + m + duration;
  return `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface NewSlotForm {
  date: string;
  startTime: string;
  duration: 30 | 60;
  locationId: string;
}

interface Props {
  slotMode: "existing" | "new";
  setSlotMode: (m: "existing" | "new") => void;
  // Existing slot picker
  availableSlots: AppointmentSlot[];
  slotsByDate: Record<string, AppointmentSlot[]>;
  availableDateSet: Set<string>;
  calendarDate: string | null;
  setCalendarDate: (d: string | null) => void;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  onSlotSelect: (slot: AppointmentSlot) => void;
  loadingSlots: boolean;
  // New slot form
  newSlotForm: NewSlotForm;
  setNewSlotForm: (f: NewSlotForm) => void;
  clinicLocations: ClinicLocation[];
  onNewSlotContinue: () => void;
  // 409 conflict error
  conflictError: string | null;
  error: string;
}

export function SlotPickerStep({
  slotMode,
  setSlotMode,
  availableSlots,
  slotsByDate,
  availableDateSet,
  calendarDate,
  setCalendarDate,
  currentMonth,
  setCurrentMonth,
  onSlotSelect,
  loadingSlots,
  newSlotForm,
  setNewSlotForm,
  clinicLocations,
  onNewSlotContinue,
  conflictError,
  error,
}: Props) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const today = todayStr();
  const slotsForCalendarDate = calendarDate ? slotsByDate[calendarDate] ?? [] : [];

  return (
    <>
      {/* Mode tabs */}
      <div className="flex rounded-lg border border-gray-200 p-1 gap-1 mb-4">
        <button
          type="button"
          onClick={() => { setSlotMode("existing"); }}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            slotMode === "existing" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Horarios disponibles
        </button>
        <button
          type="button"
          onClick={() => { setSlotMode("new"); }}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            slotMode === "new" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Nuevo horario
        </button>
      </div>

      {slotMode === "new" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input
              type="date"
              min={today}
              value={newSlotForm.date}
              onChange={(e) => setNewSlotForm({ ...newSlotForm, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio *</label>
              <input
                type="time"
                value={newSlotForm.startTime}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración *</label>
              <select
                value={newSlotForm.duration}
                onChange={(e) =>
                  setNewSlotForm({ ...newSlotForm, duration: Number(e.target.value) as 30 | 60 })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          {newSlotForm.startTime && (
            <p className="text-xs text-gray-500">
              Hora de fin:{" "}
              <span className="font-medium">
                {calcEndTime(newSlotForm.startTime, newSlotForm.duration)}
              </span>
            </p>
          )}

          {/* Location picker — only when 2+ locations */}
          {clinicLocations.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-3.5 h-3.5 mr-1" />
                Consultorio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {clinicLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setNewSlotForm({ ...newSlotForm, locationId: loc.id })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium text-left border-2 transition-all ${
                      newSlotForm.locationId === loc.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {loc.name}
                    {loc.address && (
                      <span className="block text-xs font-normal text-gray-400 truncate">
                        {loc.address}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>El precio lo determina el servicio que selecciones a continuación.</span>
          </div>

          {/* 409 conflict error */}
          {conflictError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{conflictError}</span>
            </div>
          )}

          {error && !conflictError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onNewSlotContinue}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            Continuar
          </button>
        </div>
      ) : loadingSlots ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Cargando horarios...</span>
        </div>
      ) : availableDateSet.size === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-700">Sin horarios disponibles</p>
          <p className="text-sm mt-1 text-gray-500">
            Usa "Nuevo horario" para agendar sin horario previo
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setCurrentMonth(new Date(year, month - 1)); setCalendarDate(null); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-800 capitalize text-sm">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => { setCurrentMonth(new Date(year, month + 1)); setCalendarDate(null); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                {d}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isAvailable = availableDateSet.has(dateKey);
              const isPast = dateKey < today;
              const isToday = dateKey === today;
              const isSelected = dateKey === calendarDate;

              return (
                <button
                  key={day}
                  disabled={!isAvailable || isPast}
                  onClick={() => setCalendarDate(dateKey === calendarDate ? null : dateKey)}
                  className={`
                    aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : isAvailable && !isPast
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                      : isToday
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : "text-gray-300 cursor-not-allowed"}
                  `}
                >
                  {day}
                  {isAvailable && !isPast && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Slots for selected date */}
          {calendarDate && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
                {formatLocalDate(calendarDate, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {slotsForCalendarDate.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => onSlotSelect(slot)}
                    className="flex flex-col items-start p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />
                      <span className="font-semibold text-gray-900 text-sm">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{slot.duration} min</span>
                    {slot.location && clinicLocations.length > 1 && (
                      <span className="flex items-center gap-1 text-xs text-indigo-600 mt-1">
                        <MapPin className="w-3 h-3" />
                        {slot.location.name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!calendarDate && (
            <p className="text-center text-xs text-gray-400 pt-1">
              Selecciona una fecha resaltada para ver los horarios
            </p>
          )}
        </div>
      )}
    </>
  );
}
