"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Info, Loader2, MapPin, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { getLocalDateString } from "@/lib/dates";
import type { ClinicLocation } from "../_hooks/useSlots";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  clinicLocations: ClinicLocation[];
  defaultIntervalMinutes: number;
  onSuccess: () => void;
}

export function CreateRangeModal({
  isOpen,
  onClose,
  doctorId,
  clinicLocations,
  defaultIntervalMinutes,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<"single" | "recurring">("recurring");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("14:00");
  const [intervalMinutes, setIntervalMinutes] = useState(defaultIntervalMinutes);
  const [locationId, setLocationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Update interval when default changes
  useEffect(() => {
    setIntervalMinutes(defaultIntervalMinutes);
  }, [defaultIntervalMinutes]);

  // Default to first location when locations load
  useEffect(() => {
    if (clinicLocations.length > 0 && !locationId) {
      setLocationId(clinicLocations[0].id);
    }
  }, [clinicLocations, locationId]);

  // Generate time options in 15-min increments (range boundaries must be on 15-min marks)
  const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, "0");
    const m = String((i % 4) * 15).padStart(2, "0");
    return `${h}:${m}`;
  });

  // Compute preview info
  const computePreview = () => {
    if (!startTime || !endTime) return { hours: 0, days: 0 };
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMin <= 0) return { hours: 0, days: 0 };

    const hours = totalMin / 60;

    if (mode === "single") return { hours, days: singleDate ? 1 : 0 };
    if (!startDate || !endDate) return { hours, days: 0 };

    let daysCount = 0;
    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const adjusted = dow === 0 ? 6 : dow - 1;
      if (daysOfWeek.includes(adjusted)) daysCount++;
    }
    return { hours, days: daysCount };
  };

  const { hours, days } = computePreview();
  const hasUnusualHours = startTime < "07:00" || endTime > "22:00";

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const resetForm = () => {
    setMode("recurring");
    setSingleDate("");
    setStartDate("");
    setEndDate("");
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setStartTime("09:00");
    setEndTime("14:00");
    setIntervalMinutes(defaultIntervalMinutes);
    setLocationId(clinicLocations[0]?.id ?? "");
    setSubmitError(null);
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
      setSubmitError("Por favor selecciona al menos un día de la semana");
      return;
    }
    if (startTime >= endTime) {
      setSubmitError("La hora de fin debe ser después de la hora de inicio");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        doctorId,
        mode,
        startTime,
        endTime,
        intervalMinutes,
        ...(locationId && { locationId }),
      };

      if (mode === "single") {
        payload.date = singleDate;
      } else {
        payload.startDate = startDate;
        payload.endDate = endDate;
        payload.daysOfWeek = daysOfWeek;
      }

      const response = await authFetch(`${API_URL}/api/appointments/ranges`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 409) {
        setSubmitError(data.error || "Hay conflictos con rangos existentes. Elimina los rangos existentes primero.");
        return;
      }

      if (data.success) {
        toast.success(`Se crearon ${data.count} rango${data.count !== 1 ? "s" : ""} de disponibilidad.`);
        onSuccess();
        onClose();
        resetForm();
      } else {
        setSubmitError(data.error || "Error al crear rangos de disponibilidad");
      }
    } catch {
      toast.error("Error al crear rangos. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full my-4 sm:my-8">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">Crear Disponibilidad</span>
            <span className="sm:hidden">Disponibilidad</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto"
        >
          {/* Mode */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
              Modo de Creación
            </label>
            <div className="flex gap-2 sm:gap-4">
              {(["single", "recurring"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg font-medium transition-all text-sm ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {m === "single" ? "Día Único" : "Recurrente"}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
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
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm sm:text-base"
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
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm sm:text-base"
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

          {/* Time */}
          <div className="border-t pt-4 sm:pt-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
              <Clock className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Horario de Disponibilidad
            </label>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                  Hora de Inicio *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm sm:text-base"
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
                  className="w-full px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm sm:text-base"
                  required
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Interval */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                Intervalo entre citas
              </label>
              <div className="flex gap-2 sm:gap-3">
                {([15, 30, 45, 60] as const).map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setIntervalMinutes(iv)}
                    className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      intervalMinutes === iv
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {iv} min
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Cada cuántos minutos se muestran opciones de horario a los pacientes
              </p>
            </div>
          </div>

          {/* Location */}
          {clinicLocations.length === 1 && (
            <div className="border-t pt-4 sm:pt-6">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="inline w-3.5 h-3.5 mr-1.5" />
                Consultorio
              </label>
              <div className="py-2 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                {clinicLocations[0].name}
                {clinicLocations[0].address && (
                  <span className="block text-xs font-normal text-gray-400">
                    {clinicLocations[0].address}
                  </span>
                )}
              </div>
            </div>
          )}
          {clinicLocations.length > 1 && (
            <div className="border-t pt-4 sm:pt-6">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="inline w-3.5 h-3.5 mr-1.5" />
                Consultorio
              </label>
              <div className="flex gap-2 flex-wrap">
                {clinicLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setLocationId(loc.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                      locationId === loc.id
                        ? "border-blue-600 bg-blue-600 text-white"
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

          {/* Info */}
          <div className="border-t pt-4 sm:pt-6">
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-600">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
              <span>
                Los rangos definen cuándo estás disponible. La duración de cada cita la determina el servicio que seleccione el paciente.
              </span>
            </div>
          </div>

          {/* Unusual hours warning */}
          {hasUnusualHours && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-700">
                <p className="font-medium">Horario inusual detectado</p>
                <p className="mt-0.5">
                  {startTime < "07:00" && `La hora de inicio (${startTime}) es antes de las 07:00. `}
                  {endTime > "22:00" && `La hora de fin (${endTime}) es después de las 22:00. `}
                  Verifica que sea correcto.
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          {days > 0 && hours > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm">Vista previa</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {mode === "single" ? (
                      <>
                        <strong className="text-gray-900">1 rango</strong> de{" "}
                        <strong className="text-gray-900">{hours}h</strong> ({startTime} – {endTime})
                        {" "}• Intervalo: cada {intervalMinutes} min
                      </>
                    ) : (
                      <>
                        <strong className="text-gray-900">{days} rango{days !== 1 ? "s" : ""}</strong> de{" "}
                        <strong className="text-gray-900">{hours}h</strong> cada uno ({startTime} – {endTime})
                        {" "}• Intervalo: cada {intervalMinutes} min
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || days === 0 || hours <= 0}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Creando...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">
                    Crear {days} Rango{days !== 1 ? "s" : ""}
                  </span>
                  <span className="sm:hidden">Crear ({days})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
