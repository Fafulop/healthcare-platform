"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  MessageSquare,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "${API_URL}";

function formatDateStr(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString("es-MX", options);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
  discount: number | null;
  discountType: string | null;
  finalPrice: number;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
}

interface BookPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
  preSelectedSlot?: AppointmentSlot | null;
}

type Step = "slot" | "form" | "success";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function BookPatientModal({
  isOpen,
  onClose,
  doctorId,
  onSuccess,
  preSelectedSlot = null,
}: BookPatientModalProps) {
  const initialStep: Step = preSelectedSlot ? "form" : "slot";

  const [step, setStep] = useState<Step>(initialStep);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(preSelectedSlot);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<string | null>(null);

  // Slots data
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    patientWhatsapp: "",
    notes: "",
  });

  // Re-initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(preSelectedSlot ? "form" : "slot");
      setSelectedSlot(preSelectedSlot);
      setCalendarDate(null);
      setCurrentMonth(new Date());
      setError("");
      setConfirmationCode("");
      setFormData({ patientName: "", patientEmail: "", patientPhone: "", patientWhatsapp: "", notes: "" });
      if (!preSelectedSlot) fetchAvailableSlots();
    }
  }, [isOpen, preSelectedSlot]);

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const today = new Date();
      const todayIso = today.toISOString().split("T")[0];
      const future = new Date(today);
      future.setDate(future.getDate() + 90);
      const futureIso = future.toISOString().split("T")[0];

      const startDate = new Date(todayIso + "T00:00:00Z").toISOString();
      const endDate = new Date(futureIso + "T23:59:59Z").toISOString();

      const res = await authFetch(
        `${API_URL}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();
      if (data.success) setSlots(data.data);
    } catch (err) {
      console.error("Error fetching slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Available slots: open, not full, today or later
  const availableSlots = useMemo(() => {
    const today = todayStr();
    return slots
      .filter((s) => s.isOpen && s.currentBookings < s.maxBookings && s.date.split("T")[0] >= today)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });
  }, [slots]);

  // Group by date key
  const slotsByDate = useMemo(() => {
    const groups: Record<string, AppointmentSlot[]> = {};
    for (const slot of availableSlots) {
      const key = slot.date.split("T")[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(slot);
    }
    return groups;
  }, [availableSlots]);

  const availableDateSet = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate]);

  // Calendar grid data
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const today = todayStr();

  const slotsForCalendarDate = calendarDate ? slotsByDate[calendarDate] ?? [] : [];

  const handleDateClick = (dateKey: string) => {
    if (!availableDateSet.has(dateKey)) return;
    setCalendarDate(dateKey === calendarDate ? null : dateKey);
  };

  const handleSlotSelect = (slot: AppointmentSlot) => {
    setSelectedSlot(slot);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setError("");

    try {
      // 1. Create booking (public endpoint)
      const bookingRes = await fetch(`${API_URL}/api/appointments/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          patientName: formData.patientName,
          patientEmail: formData.patientEmail,
          patientPhone: formData.patientPhone,
          patientWhatsapp: formData.patientWhatsapp || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingData.success) {
        setError(bookingData.error || "Error al crear la cita");
        return;
      }

      const code = bookingData.data.confirmationCode;

      setConfirmationCode(code);
      setStep("success");
      onSuccess();
    } catch {
      setError("Error de conexión. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(initialStep);
    setSelectedSlot(preSelectedSlot);
    setCalendarDate(null);
    setCurrentMonth(new Date());
    setError("");
    setConfirmationCode("");
    setFormData({ patientName: "", patientEmail: "", patientPhone: "", patientWhatsapp: "", notes: "" });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Agendar Cita</h2>
            {step === "slot" && (
              <p className="text-sm text-gray-500">Selecciona una fecha y horario</p>
            )}
            {step === "form" && selectedSlot && (
              <p className="text-sm text-gray-500">
                {formatDateStr(selectedSlot.date, { weekday: "short", day: "numeric", month: "short" })}
                {" · "}{selectedSlot.startTime} – {selectedSlot.endTime}
              </p>
            )}
            {step === "success" && <p className="text-sm text-gray-500">Cita confirmada</p>}
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        {step !== "success" && (
          <div className="flex items-center gap-2 px-5 pt-3 pb-0 text-xs shrink-0">
            <span className={`font-semibold ${step === "slot" ? "text-blue-600" : "text-gray-400"}`}>
              1. Horario
            </span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className={`font-semibold ${step === "form" ? "text-blue-600" : "text-gray-400"}`}>
              2. Datos del paciente
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── STEP 1: Calendar picker ── */}
          {step === "slot" && (
            <>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span className="text-sm">Cargando horarios...</span>
                </div>
              ) : availableDateSet.size === 0 ? (
                <div className="text-center py-14 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium text-gray-700">Sin horarios disponibles</p>
                  <p className="text-sm mt-1 text-gray-500">Crea horarios abiertos para poder agendar citas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setCurrentMonth(new Date(year, month - 1));
                        setCalendarDate(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-gray-800 capitalize text-sm">
                      {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentMonth(new Date(year, month + 1));
                        setCalendarDate(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                        {d}
                      </div>
                    ))}

                    {/* Calendar cells */}
                    {calendarDays.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} />;
                      }

                      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isAvailable = availableDateSet.has(dateKey);
                      const isPast = dateKey < today;
                      const isToday = dateKey === today;
                      const isSelected = dateKey === calendarDate;

                      return (
                        <button
                          key={day}
                          disabled={!isAvailable || isPast}
                          onClick={() => handleDateClick(dateKey)}
                          className={`
                            aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all
                            ${isSelected
                              ? "bg-blue-600 text-white shadow-md"
                              : isAvailable && !isPast
                              ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                              : isToday
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "text-gray-300 cursor-not-allowed"
                            }
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
                        {formatDateStr(calendarDate, { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {slotsForCalendarDate.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotSelect(slot)}
                            className="flex flex-col items-start p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />
                              <span className="font-semibold text-gray-900 text-sm">
                                {slot.startTime}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{slot.startTime} – {slot.endTime}</span>
                            <span className="text-xs font-semibold text-gray-700 mt-1">${slot.finalPrice}</span>
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
          )}

          {/* ── STEP 2: Patient form ── */}
          {step === "form" && (
            <form id="book-patient-form" onSubmit={handleSubmit} className="space-y-4">
              {!preSelectedSlot && (
                <button
                  type="button"
                  onClick={() => setStep("slot")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  ← Cambiar horario
                </button>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.patientName}
                    onChange={(e) => setFormData((p) => ({ ...p, patientName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Juan García"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.patientEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, patientEmail: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="juan@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={formData.patientPhone}
                    onChange={(e) => setFormData((p) => ({ ...p, patientPhone: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5512345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.patientWhatsapp}
                    onChange={(e) => setFormData((p) => ({ ...p, patientWhatsapp: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5512345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Motivo de consulta, observaciones..."
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </form>
          )}

          {/* ── STEP 3: Success ── */}
          {step === "success" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Cita Confirmada</h3>
              <p className="text-sm text-gray-500 mb-6">La cita ha sido agendada y confirmada exitosamente</p>

              <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paciente</span>
                  <span className="font-semibold text-gray-900">{formData.patientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {selectedSlot && formatDateStr(selectedSlot.date, { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Horario</span>
                  <span className="font-semibold text-gray-900">
                    {selectedSlot?.startTime} – {selectedSlot?.endTime}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Precio
                  </span>
                  <span className="font-semibold text-gray-900">${selectedSlot?.finalPrice}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Código</span>
                  <code className="text-base bg-white border border-gray-200 px-3 py-1 rounded-lg font-mono font-bold tracking-widest">
                    {confirmationCode}
                  </code>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* Footer for step 2 */}
        {step === "form" && (
          <div className="p-5 border-t flex gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="book-patient-form"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                "Confirmar cita"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
