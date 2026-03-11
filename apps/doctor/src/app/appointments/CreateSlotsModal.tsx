"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Info, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import { getLocalDateString } from '@/lib/dates';

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface SlotEntry {
  date: string;
  startTime: string;
  endTime: string;
}

// Generate individual slot entries from form parameters
function generateSlotEntries(
  mode: "single" | "recurring",
  singleDate: string,
  startDate: string,
  endDate: string,
  daysOfWeek: number[],
  startTime: string,
  endTime: string,
  duration: number,
  hasBreak: boolean,
  breakStart: string,
  breakEnd: string
): SlotEntry[] {
  const entries: SlotEntry[] = [];

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const [breakStartH, breakStartM] = hasBreak ? breakStart.split(":").map(Number) : [0, 0];
  const [breakEndH, breakEndM] = hasBreak ? breakEnd.split(":").map(Number) : [0, 0];
  const breakStartMin = hasBreak ? breakStartH * 60 + breakStartM : 0;
  const breakEndMin = hasBreak ? breakEndH * 60 + breakEndM : 0;

  const dates: string[] = [];
  if (mode === "single" && singleDate) {
    dates.push(singleDate);
  } else if (mode === "recurring" && startDate && endDate) {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      if (daysOfWeek.includes(adjustedDay)) {
        dates.push(getLocalDateString(d));
      }
    }
  }

  for (const date of dates) {
    let currentMin = startMinutes;
    while (currentMin + duration <= endMinutes) {
      const slotEnd = currentMin + duration;
      // Skip slots that overlap with break
      if (hasBreak && currentMin < breakEndMin && slotEnd > breakStartMin) {
        currentMin = breakEndMin;
        continue;
      }
      const slotStartTime = `${String(Math.floor(currentMin / 60)).padStart(2, '0')}:${String(currentMin % 60).padStart(2, '0')}`;
      const slotEndTime = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
      entries.push({ date, startTime: slotStartTime, endTime: slotEndTime });
      currentMin = slotEnd;
    }
  }

  return entries;
}

interface CreateSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
  initialData?: any; // Voice assistant data for pre-filling
}

export default function CreateSlotsModal({
  isOpen,
  onClose,
  doctorId,
  onSuccess,
  initialData,
}: CreateSlotsModalProps) {
  const [mode, setMode] = useState<"single" | "recurring">("recurring"); // Always recurring for voice
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState<30 | 60>(60);
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewSlots, setPreviewSlots] = useState<number>(0);

  // Task info state (informational)
  const [tasksInfo, setTasksInfo] = useState<{
    count: number;
    message: string;
    tasks: any[];
  } | null>(null);

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Pre-fill form with voice assistant data
  useEffect(() => {
    if (initialData) {
      setMode("recurring"); // Force recurring mode
      if (initialData.startDate) setStartDate(initialData.startDate);
      if (initialData.endDate) setEndDate(initialData.endDate);
      if (initialData.daysOfWeek) setDaysOfWeek(initialData.daysOfWeek);
      if (initialData.startTime) setStartTime(initialData.startTime);
      if (initialData.endTime) setEndTime(initialData.endTime);
      if (initialData.duration) setDuration(initialData.duration);
      if (initialData.hasBreak !== undefined) setHasBreak(initialData.hasBreak);
      if (initialData.breakStart) setBreakStart(initialData.breakStart);
      if (initialData.breakEnd) setBreakEnd(initialData.breakEnd);
    }
  }, [initialData]);

  // Calculate preview of slots to be created
  useEffect(() => {
    if (!startTime || !endTime || !duration) {
      setPreviewSlots(0);
      return;
    }

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const [breakStartH, breakStartM] = hasBreak ? breakStart.split(":").map(Number) : [0, 0];
    const [breakEndH, breakEndM] = hasBreak ? breakEnd.split(":").map(Number) : [0, 0];

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const breakStartMinutes = hasBreak ? breakStartH * 60 + breakStartM : 0;
    const breakEndMinutes = hasBreak ? breakEndH * 60 + breakEndM : 0;
    const breakDuration = hasBreak ? breakEndMinutes - breakStartMinutes : 0;

    const totalMinutes = endMinutes - startMinutes - breakDuration;
    const slotsPerDay = Math.floor(totalMinutes / duration);

    if (mode === "single") {
      setPreviewSlots(slotsPerDay);
    } else if (mode === "recurring" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let daysCount = 0;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (daysOfWeek.includes(adjustedDay)) {
          daysCount++;
        }
      }

      setPreviewSlots(slotsPerDay * daysCount);
    }
  }, [
    mode,
    singleDate,
    startDate,
    endDate,
    daysOfWeek,
    startTime,
    endTime,
    duration,
    hasBreak,
    breakStart,
    breakEnd,
  ]);

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, '0');
    const m = i % 2 === 0 ? '00' : '30';
    return `${h}:${m}`;
  });

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const executeSlotCreation = async (replaceConflicts = false) => {
    setIsSubmitting(true);

    try {
      const payload: any = {
        doctorId,
        mode,
        startTime,
        endTime,
        duration,
        basePrice: 0,
        discount: null,
        discountType: null,
        replaceConflicts, // NEW: Include replaceConflicts flag
      };

      if (hasBreak) {
        payload.breakStart = breakStart;
        payload.breakEnd = breakEnd;
      }

      if (mode === "single") {
        payload.date = singleDate;
      } else {
        payload.startDate = startDate;
        payload.endDate = endDate;
        payload.daysOfWeek = daysOfWeek;
      }

      const response = await authFetch(`${API_URL}/api/appointments/slots`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Handle 409 Conflict response (slot conflicts detected)
      if (response.status === 409) {
        // Show error alert and don't allow replacement
        const conflictList = data.conflicts.slice(0, 5).map((c: any) => {
          const [y, m, d] = c.date.split('T')[0].split('-').map(Number);
          const dateLabel = new Date(y, m - 1, d).toLocaleDateString('es-MX');
          return `• ${dateLabel} ${c.startTime}-${c.endTime}${c.hasBookings ? ` (${c.currentBookings} reserva${c.currentBookings > 1 ? 's' : ''})` : ''}`;
        }).join('\n');

        const moreCount = data.conflicts.length > 5 ? `\n... y ${data.conflicts.length - 5} más` : '';

        setSubmitError(
          `No se pueden crear los horarios. ${data.message} Horarios con conflicto: ${conflictList}${moreCount}. Por favor, elimina primero los horarios existentes.`
        );
        setIsSubmitting(false);
        return;
      }

      if (data.success) {
        // Show success message
        let message = `Se crearon ${data.count} horarios de citas.`;
        if (data.replaced > 0) {
          message += ` (${data.replaced} reemplazados)`;
        }

        // Show task info if exists (informational)
        if (data.tasksInfo) {
          setTasksInfo(data.tasksInfo);
        }

        toast.success(message);
        onSuccess();
        onClose();
        resetForm();
      } else {
        toast.error(data.error || "Error al crear horarios");
      }
    } catch (error) {
      console.error("Error creating slots:", error);
      toast.error("Error al crear horarios. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitError(null);

    if (mode === "single" && !singleDate) {
      setSubmitError("Por favor selecciona una fecha");
      return;
    }

    if (mode === "recurring" && (!startDate || !endDate)) {
      setSubmitError("Por favor selecciona fechas de inicio y fin");
      return;
    }

    if (mode === "recurring" && daysOfWeek.length === 0) {
      setSubmitError("Por favor selecciona al menos un dia de la semana");
      return;
    }

    // Submit without allowing replacements (replaceConflicts = false)
    await executeSlotCreation(false);
  };

  const resetForm = () => {
    setMode("single");
    setSingleDate("");
    setStartDate("");
    setEndDate("");
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setStartTime("09:00");
    setEndTime("17:00");
    setDuration(60);
    setHasBreak(false);
    setBreakStart("12:00");
    setBreakEnd("13:00");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full my-4 sm:my-8">
        {/* Header */}
        <div className="bg-blue-600 px-4 sm:px-6 py-3 sm:py-4 rounded-t-lg flex items-center justify-between">
          <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline">Crear Horarios de Citas</span>
            <span className="sm:hidden">Crear Horarios</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 sm:p-2 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Mode Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
              Modo de Creación
            </label>
            <div className="flex gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  mode === "single"
                    ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                    : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200"
                }`}
              >
                Día Único
              </button>
              <button
                type="button"
                onClick={() => setMode("recurring")}
                className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  mode === "recurring"
                    ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                    : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200"
                }`}
              >
                Recurrente
              </button>
            </div>
          </div>

          {/* Date Selection */}
          <div className="border-t pt-4 sm:pt-6">
            {mode === "single" ? (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                  Seleccionar Fecha *
                </label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  min={getLocalDateString(new Date())}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                />
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Fecha de Inicio *
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={getLocalDateString(new Date())}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Fecha de Fin *
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || getLocalDateString(new Date())}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                    Repetir en *
                  </label>
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    {dayNames.map((day, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                          daysOfWeek.includes(index)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Settings */}
          <div className="border-t pt-4 sm:pt-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
              <Clock className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Configuración de Horario
            </label>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                  Hora de Inicio *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2 sm:px-4 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                  Hora de Fin *
                </label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2 sm:px-4 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-3 sm:mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                Duración del Horario *
              </label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setDuration(30)}
                  className={`flex-1 py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    duration === 30
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  30 min
                </button>
                <button
                  type="button"
                  onClick={() => setDuration(60)}
                  className={`flex-1 py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    duration === 60
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  60 min
                </button>
              </div>
            </div>

            {/* Break Time */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <label className="flex items-center gap-2 mb-2 sm:mb-3">
                <input
                  type="checkbox"
                  checked={hasBreak}
                  onChange={(e) => setHasBreak(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  Agregar descanso (opcional)
                </span>
              </label>

              {hasBreak && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                      Inicio
                    </label>
                    <select
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                      Fin
                    </label>
                    <select
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Precio */}
          <div className="border-t pt-4 sm:pt-6">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-blue-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>El precio de la cita lo determina el servicio seleccionado por el paciente al reservar.</span>
            </div>
          </div>

          {/* Vista Previa */}
          {previewSlots > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm sm:text-base">Vista Previa</p>
                  <p className="text-xs sm:text-sm text-blue-700 mt-0.5 sm:mt-1">
                    Esto creará <strong>{previewSlots} horarios</strong>
                    {mode === "recurring" && (
                      <span className="hidden sm:inline"> en el rango de fechas seleccionado</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Task Info Banner (Informational) */}
          {tasksInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">
                ℹ️ {tasksInfo.message}
              </p>
              <div className="mt-2 space-y-1">
                {tasksInfo.tasks.slice(0, 3).map((task, idx) => (
                  <p key={idx} className="text-xs text-blue-700">
                    • {task.title} ({task.startTime}-{task.endTime})
                  </p>
                ))}
                {tasksInfo.tasks.length > 3 && (
                  <p className="text-xs text-blue-600">
                    ... y {tasksInfo.tasks.length - 3} más
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTasksInfo(null)}
                className="mt-2 text-sm text-blue-600 underline hover:text-blue-800"
              >
                Entendido
              </button>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">{submitError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors text-sm sm:text-base"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || previewSlots === 0}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Creando...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Crear {previewSlots} Horario{previewSlots !== 1 ? "s" : ""}</span>
                  <span className="sm:hidden">Crear ({previewSlots})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
