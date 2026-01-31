"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, DollarSign, Percent, Info, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import ConflictDialog from "@/components/ConflictDialog";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

// Helper function to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  const [basePrice, setBasePrice] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSlots, setPreviewSlots] = useState<number>(0);

  // Conflict state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{
    appointmentConflicts: any[];
    taskConflicts: any[];
    hasBookedAppointments: boolean;
    appointmentCheckFailed?: boolean;
    taskCheckFailed?: boolean;
  } | null>(null);
  const [checkFailureWarning, setCheckFailureWarning] = useState(false);
  const [skipConflictCheck, setSkipConflictCheck] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

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
      if (initialData.basePrice) setBasePrice(initialData.basePrice);
      if (initialData.hasDiscount !== undefined) setHasDiscount(initialData.hasDiscount);
      if (initialData.discount) setDiscount(initialData.discount);
      if (initialData.discountType) setDiscountType(initialData.discountType);
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

  const calculateFinalPrice = () => {
    const base = parseFloat(basePrice) || 0;
    if (!hasDiscount || !discount) return base;

    const discountValue = parseFloat(discount) || 0;
    if (discountType === "PERCENTAGE") {
      return base - (base * discountValue) / 100;
    } else {
      return Math.max(0, base - discountValue);
    }
  };

  const executeSlotCreation = async () => {
    setIsSubmitting(true);

    try {
      const payload: any = {
        doctorId,
        mode,
        startTime,
        endTime,
        duration,
        basePrice: parseFloat(basePrice),
        discount: hasDiscount && discount ? parseFloat(discount) : null,
        discountType: hasDiscount && discount ? discountType : null,
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

      if (data.success) {
        alert(`Se crearon ${data.count} horarios de citas.`);
        onSuccess();
        onClose();
        resetForm();
      } else {
        alert(data.error || "Error al crear horarios");
      }
    } catch (error) {
      console.error("Error creating slots:", error);
      alert("Error al crear horarios. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!basePrice || parseFloat(basePrice) <= 0) {
      alert("Por favor ingresa un precio base valido");
      return;
    }

    if (mode === "single" && !singleDate) {
      alert("Por favor selecciona una fecha");
      return;
    }

    if (mode === "recurring" && (!startDate || !endDate)) {
      alert("Por favor selecciona fechas de inicio y fin");
      return;
    }

    if (mode === "recurring" && daysOfWeek.length === 0) {
      alert("Por favor selecciona al menos un dia de la semana");
      return;
    }

    // Generate slot entries and check conflicts
    const entries = generateSlotEntries(
      mode, singleDate, startDate, endDate, daysOfWeek,
      startTime, endTime, duration, hasBreak, breakStart, breakEnd
    );

    if (entries.length === 0) {
      alert("No se generaron horarios con la configuracion actual");
      return;
    }

    // Batch conflict check
    setIsSubmitting(true);
    if (skipConflictCheck) {
      setSkipConflictCheck(false);
      await executeSlotCreation();
      return;
    }
    try {
      const conflictRes = await fetch("/api/medical-records/tasks/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      if (conflictRes.ok) {
        const conflictResult = await conflictRes.json();
        const results = conflictResult.data.results || [];
        const hasAnyConflicts = results.some(
          (r: any) => r.appointmentConflicts.length > 0 || r.taskConflicts.length > 0
        );
        const hasAnyFailures = results.some(
          (r: any) => r.appointmentCheckFailed || r.taskCheckFailed
        );

        if (hasAnyConflicts) {
          // Aggregate and deduplicate
          const allAppts: any[] = [];
          const allTasks: any[] = [];
          let hasBooked = false;
          let apptFailed = false;
          let taskFailed = false;
          for (const r of results) {
            allAppts.push(...r.appointmentConflicts);
            allTasks.push(...r.taskConflicts);
            if (r.hasBookedAppointments) hasBooked = true;
            if (r.appointmentCheckFailed) apptFailed = true;
            if (r.taskCheckFailed) taskFailed = true;
          }
          const uniqueAppts = Array.from(new Map(allAppts.map(a => [a.id, a])).values());
          const uniqueTasks = Array.from(new Map(allTasks.map(t => [t.id, t])).values());

          setConflictData({
            appointmentConflicts: uniqueAppts,
            taskConflicts: uniqueTasks,
            hasBookedAppointments: hasBooked,
            appointmentCheckFailed: apptFailed,
            taskCheckFailed: taskFailed,
          });
          setConflictDialogOpen(true);
          setIsSubmitting(false);
          return;
        }

        if (hasAnyFailures) {
          setCheckFailureWarning(true);
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // If conflict check completely fails, warn the user
      setCheckFailureWarning(true);
      setIsSubmitting(false);
      return;
    }

    // No conflicts, proceed
    await executeSlotCreation();
  };

  const handleOverride = async () => {
    if (!conflictData) return;
    setOverrideLoading(true);

    const slotIdsToBlock = conflictData.appointmentConflicts
      .filter(s => s.status === 'AVAILABLE')
      .map(s => s.id);
    const taskIdsToCancel = conflictData.taskConflicts.map(t => t.id);

    try {
      const res = await fetch("/api/medical-records/tasks/conflicts/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIdsToCancel, slotIdsToBlock }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        alert(errorData?.error || "Error al anular conflictos");
        setOverrideLoading(false);
        setConflictDialogOpen(false);
        return;
      }

      setConflictDialogOpen(false);
      setConflictData(null);

      await executeSlotCreation();
    } catch {
      alert("Error al anular conflictos");
    } finally {
      setOverrideLoading(false);
    }
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
    setBasePrice("");
    setHasDiscount(false);
    setDiscount("");
    setDiscountType("PERCENTAGE");
  };

  if (!isOpen) return null;

  const finalPrice = calculateFinalPrice();

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

          {/* Precios */}
          <div className="border-t pt-4 sm:pt-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
              <DollarSign className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Precios
            </label>

            <div className="mb-3 sm:mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                Precio Base (MXN) *
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                min="0"
                step="0.01"
                placeholder="500.00"
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                required
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <label className="flex items-center gap-2 mb-2 sm:mb-3">
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={(e) => setHasDiscount(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  Agregar descuento (opcional)
                </span>
              </label>

              {hasDiscount && (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscountType("PERCENTAGE")}
                      className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                        discountType === "PERCENTAGE"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Percent className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">Porcentaje</span>
                      <span className="sm:hidden">%</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("FIXED")}
                      className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                        discountType === "FIXED"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <DollarSign className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">Cantidad Fija</span>
                      <span className="sm:hidden">Fijo</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                      Descuento {discountType === "PERCENTAGE" ? "(%)" : "(MXN)"}
                    </label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      min="0"
                      max={discountType === "PERCENTAGE" ? "100" : undefined}
                      step={discountType === "PERCENTAGE" ? "1" : "0.01"}
                      placeholder={discountType === "PERCENTAGE" ? "10" : "50.00"}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {discount && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3">
                      <p className="text-xs sm:text-sm text-green-800">
                        <strong>Precio Final:</strong> ${finalPrice.toFixed(2)}
                        {discountType === "PERCENTAGE" && discount && (
                          <span className="ml-1 sm:ml-2 text-blue-600">
                            ({discount}% off)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
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

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
            {checkFailureWarning && (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-red-800 font-medium">
                  No se pudo verificar conflictos con el sistema de citas o pendientes.
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Si continúas, podrían crearse horarios duplicados.
                </p>
                <button
                  type="button"
                  onClick={() => { setCheckFailureWarning(false); setSkipConflictCheck(true); }}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  Entiendo, crear de todas formas
                </button>
              </div>
            )}
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
              disabled={isSubmitting || previewSlots === 0 || checkFailureWarning}
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

      {/* Conflict Dialog */}
      {conflictData && (
        <ConflictDialog
          isOpen={conflictDialogOpen}
          onClose={() => {
            setConflictDialogOpen(false);
            setConflictData(null);
          }}
          appointmentConflicts={conflictData.appointmentConflicts}
          taskConflicts={conflictData.taskConflicts}
          hasBookedAppointments={conflictData.hasBookedAppointments}
          onOverride={handleOverride}
          loading={overrideLoading}
        />
      )}
    </div>
  );
}
