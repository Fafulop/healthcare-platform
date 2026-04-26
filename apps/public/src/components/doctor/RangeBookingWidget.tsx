"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, Clock, DollarSign, User, Mail, Phone, MessageSquare, CheckCircle, Loader2, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { trackSlotSelected, trackBookingComplete } from "@/lib/analytics";
import type { Service } from "@/types/doctor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateString(dateStr: string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString(locale, options);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface AvailableTime {
  startTime: string;
  endTime: string;
  rangeId: string;
  locationId?: string | null;
  locationName?: string | null;
}

interface RangeBookingWidgetProps {
  doctorSlug: string;
  isModal?: boolean;
  onDayClick?: (dateStr: string) => void;
  initialDate?: string | null;
  googleAdsId?: string;
  services?: Service[];
  appointmentModes?: ("in_person" | "teleconsult")[];
}

export default function RangeBookingWidget({
  doctorSlug,
  isModal = false,
  onDayClick,
  initialDate = null,
  googleAdsId,
  services = [],
  appointmentModes = ["in_person", "teleconsult"],
}: RangeBookingWidgetProps) {
  // Calendar (Step 1 — calendar-first flow for public)
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate && typeof initialDate === "string" && initialDate.includes("-")) {
      const [y, m] = initialDate.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialDate && typeof initialDate === "string" && initialDate.includes("-") ? initialDate.split("T")[0] : null
  );
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<Record<string, AvailableTime[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Service selection (Step 2)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [freshServices, setFreshServices] = useState<Service[] | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  // Time selection (Step 3)
  const [selectedTime, setSelectedTime] = useState<AvailableTime | null>(null);

  // Form (Step 4)
  const [bookingStep, setBookingStep] = useState<"calendar" | "form" | "success">("calendar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    patientWhatsapp: "",
    notes: "",
  });
  const [confirmationCode, setConfirmationCode] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Visit context
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(true);
  const [appointmentMode, setAppointmentMode] = useState<"PRESENCIAL" | "TELEMEDICINA" | null>(() => {
    if (appointmentModes.includes("in_person")) return "PRESENCIAL";
    if (appointmentModes.includes("teleconsult")) return "TELEMEDICINA";
    return null;
  });

  // Field settings
  const [fieldSettings, setFieldSettings] = useState({
    emailRequired: true,
    phoneRequired: true,
    whatsappRequired: true,
  });

  // Deferred loading (IntersectionObserver on mobile)
  const containerRef = useRef<HTMLDivElement>(null);
  const timeSlotsRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isModal || window.innerWidth >= 1024) {
      setIsVisible(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isModal]);

  // Fetch fresh services when visible
  useEffect(() => {
    if (!isVisible) return;
    setLoadingServices(true);
    fetch(`${API_URL}/api/doctors/${doctorSlug}/services`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setFreshServices(data.data); })
      .catch(() => { setFreshServices(services); })
      .finally(() => setLoadingServices(false));
  }, [isVisible, doctorSlug]);

  // Fetch field settings
  useEffect(() => {
    if (!isVisible) return;
    fetch(`${API_URL}/api/doctors/${doctorSlug}/booking-field-settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setFieldSettings({
            emailRequired: d.data.bookingPublicEmailRequired,
            phoneRequired: d.data.bookingPublicPhoneRequired,
            whatsappRequired: d.data.bookingPublicWhatsappRequired,
          });
        }
      })
      .catch(() => {});
  }, [isVisible, doctorSlug]);

  // Fetch available dates (no serviceId — dates-only mode for calendar display)
  useEffect(() => {
    if (!isVisible) return;

    const fetchDates = async () => {
      setLoadingAvailability(true);
      try {
        const y = currentMonth.getFullYear();
        const m = currentMonth.getMonth() + 1;
        const monthStr = `${y}-${String(m).padStart(2, "0")}`;

        const res = await fetch(
          `${API_URL}/api/doctors/${doctorSlug}/range-availability?month=${monthStr}`
        );
        const data = await res.json();
        if (data.success) {
          setAvailableDates(data.availableDates || []);
        }
      } catch (err) {
        console.error("Error fetching available dates:", err);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchDates();
  }, [isVisible, currentMonth, doctorSlug]);

  // Fetch time slots when date + service are both selected
  useEffect(() => {
    if (!isVisible || !selectedDate || !selectedServiceId) return;

    const fetchTimeSlots = async () => {
      setLoadingTimeSlots(true);
      try {
        const res = await fetch(
          `${API_URL}/api/doctors/${doctorSlug}/range-availability?serviceId=${selectedServiceId}&startDate=${selectedDate}&endDate=${selectedDate}`
        );
        const data = await res.json();
        if (data.success) {
          setTimeSlots(data.timeSlots || {});
        }
      } catch (err) {
        console.error("Error fetching time slots:", err);
      } finally {
        setLoadingTimeSlots(false);
      }
    };
    fetchTimeSlots();
  }, [isVisible, selectedDate, selectedServiceId, doctorSlug]);

  // Auto-scroll to time slots when they finish loading (so patient sees them without scrolling)
  const prevLoadingTimeSlots = useRef(false);
  useEffect(() => {
    // Only scroll when loading transitions from true → false (slots just appeared)
    if (prevLoadingTimeSlots.current && !loadingTimeSlots) {
      setTimeout(() => {
        timeSlotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
    prevLoadingTimeSlots.current = loadingTimeSlots;
  }, [loadingTimeSlots]);

  // Navigate to initial date's month and pre-select it
  useEffect(() => {
    if (initialDate && typeof initialDate === "string" && initialDate.includes("-")) {
      const dateOnly = initialDate.split("T")[0];
      const [y, m] = dateOnly.split("-").map(Number);
      if (y && m) setCurrentMonth(new Date(y, m - 1, 1));
      setSelectedDate(dateOnly);
    }
  }, [initialDate]);

  const activeServices = freshServices ?? services;
  const selectedService = activeServices.find((s) => s.id === selectedServiceId);

  // Calendar computation
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

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const selectedDateSlots = selectedDate ? timeSlots[selectedDate] || [] : [];

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === selectedServiceId) return;
    setSelectedServiceId(serviceId);
    setSelectedTime(null);
    setTimeSlots({});
  };

  const handleDateSelect = (dateStr: string) => {
    if (onDayClick) {
      onDayClick(dateStr);
      return;
    }
    if (dateStr === selectedDate) return;
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setTimeSlots({});
  };

  const handleTimeSelect = (time: AvailableTime) => {
    if (selectedService) {
      trackSlotSelected(doctorSlug, selectedDate!, time.startTime, Number(selectedService.price) || 0);
    }
    setSelectedTime(time);
    setBookingStep("form");
    setBookingError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime || !selectedDate || !selectedServiceId) return;

    if (isFirstTime === null) {
      setBookingError("Por favor selecciona el tipo de visita (Primera vez / Recurrente)");
      return;
    }
    if (appointmentModes.length > 0 && appointmentMode === null) {
      setBookingError("Por favor selecciona la modalidad (Presencial / Telemedicina)");
      return;
    }
    if (!privacyConsent) {
      setBookingError("Debes aceptar el Aviso de Privacidad para continuar");
      return;
    }

    setIsSubmitting(true);
    try {
      // Fetch doctorId from slug (the range-bookings endpoint needs it)
      const availRes = await fetch(
        `${API_URL}/api/doctors/${doctorSlug}/range-availability?serviceId=${selectedServiceId}&startDate=${selectedDate}&endDate=${selectedDate}`
      );
      const availData = await availRes.json();
      if (!availData.success || !availData.doctor?.id) {
        setBookingError("Error al obtener información del doctor. Intenta de nuevo.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/appointments/range-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: availData.doctor.id,
          date: selectedDate,
          startTime: selectedTime.startTime,
          serviceId: selectedServiceId,
          ...formData,
          isFirstTime,
          appointmentMode: appointmentMode || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (selectedService) {
          trackBookingComplete(doctorSlug, selectedDate, Number(selectedService.price) || 0, googleAdsId);
        }
        setConfirmationCode(data.data?.confirmationCode || "");
        setBookingStep("success");
        setFormData({ patientName: "", patientEmail: "", patientPhone: "", patientWhatsapp: "", notes: "" });
      } else {
        setBookingError(data.error || "No se pudo crear la cita. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error creating range booking:", error);
      setBookingError("No se pudo crear la cita. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setSelectedServiceId(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setTimeSlots({});
    setBookingStep("calendar");
    setConfirmationCode("");
    setIsFirstTime(true);
    setPrivacyConsent(false);
    setAppointmentMode(appointmentModes.includes("in_person") ? "PRESENCIAL" : appointmentModes.includes("teleconsult") ? "TELEMEDICINA" : null);
    setBookingError(null);
  };

  const containerStyle = isModal ? { width: "100%", padding: "0" } : {};

  // ── Success Step ──
  if (bookingStep === "success") {
    return (
      <div className={isModal ? "" : "bg-white rounded-xl shadow-lg p-6 sticky top-6"} style={containerStyle}>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-[var(--color-secondary)] mb-2">¡Reserva Confirmada!</h3>
          <p className="text-gray-600 mb-4">Tu cita ha sido agendada exitosamente.</p>

          {selectedTime && selectedDate && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left border-2 border-blue-200">
              <p className="text-sm font-semibold text-[var(--color-secondary)] mb-3">Detalles de la Cita:</p>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900">
                  <strong>Fecha:</strong>{" "}
                  {formatDateString(selectedDate, "es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
                <p className="text-gray-900">
                  <strong>Hora:</strong> {selectedTime.startTime} - {selectedTime.endTime}
                </p>
                {selectedService && (
                  <>
                    <p className="text-gray-900">
                      <strong>Servicio:</strong> {selectedService.service_name}
                    </p>
                    <p className="text-gray-900">
                      <strong>Duración:</strong> {selectedService.duration_minutes} minutos
                    </p>
                    {selectedService.price != null && (
                      <p className="text-gray-900">
                        <strong>Precio:</strong> ${formatPrice(selectedService.price!)}
                      </p>
                    )}
                  </>
                )}
                {selectedTime.locationName && (
                  <p className="text-gray-900">
                    <strong>Consultorio:</strong> {selectedTime.locationName}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-4">
            Tu solicitud ha sido enviada. Recibirás la confirmación del doctor por SMS y correo electrónico.
          </p>

          <button
            onClick={resetBooking}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold py-3 rounded-lg transition-all shadow-md"
          >
            Agendar Otra Cita
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={isModal ? "" : "bg-white"} style={containerStyle}>
      {/* Header */}
      <div className="bg-[var(--color-secondary)] text-white px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Reserva tu Cita</h3>
            <p className="text-[10px] text-white/80 leading-tight">Selecciona fecha, servicio y hora</p>
          </div>
        </div>
      </div>

      <div className="px-2 py-2">
        {/* ── Form Step ── */}
        {bookingStep === "form" && selectedTime && selectedDate ? (
          <div>
            <button
              onClick={() => setBookingStep("calendar")}
              className="text-sm font-semibold text-[var(--color-secondary)] hover:text-[#195158] mb-4 flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al calendario
            </button>

            {/* Selected summary */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
              <p className="text-xs font-medium text-[var(--color-secondary)] mb-1 opacity-80">Horario seleccionado:</p>
              <p className="text-sm font-semibold text-[var(--color-neutral-dark)]">
                {formatDateString(selectedDate, "es-MX", { weekday: "long", month: "long", day: "numeric" })} • {selectedTime.startTime}
              </p>
              {selectedService && (
                <p className="text-xs text-gray-600 mt-1">
                  {selectedService.service_name} ({selectedService.duration_minutes} min)
                </p>
              )}
              {selectedTime.locationName && (
                <p className="text-xs text-gray-600 mt-0.5">
                  <MapPin className="inline w-3 h-3 mr-0.5" />
                  {selectedTime.locationName}
                </p>
              )}
              {selectedService?.price != null && (
                <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">
                  ${formatPrice(selectedService.price!)}
                </p>
              )}
            </div>

            {/* Primera vez / Recurrente */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de visita *</label>
              <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
                {([{ val: true, label: "Primera vez" }, { val: false, label: "Recurrente" }] as const).map(({ val, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setIsFirstTime(val)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      isFirstTime === val
                        ? "bg-[var(--color-secondary)] text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Presencial / Telemedicina */}
            {(appointmentModes.includes("in_person") || appointmentModes.includes("teleconsult")) && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Modalidad *</label>
                <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
                  {appointmentModes.includes("in_person") && (
                    <button
                      type="button"
                      onClick={() => setAppointmentMode("PRESENCIAL")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        appointmentMode === "PRESENCIAL"
                          ? "bg-[var(--color-secondary)] text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Presencial
                    </button>
                  )}
                  {appointmentModes.includes("teleconsult") && (
                    <button
                      type="button"
                      onClick={() => setAppointmentMode("TELEMEDICINA")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                        appointmentMode === "TELEMEDICINA"
                          ? "bg-[var(--color-secondary)] text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Telemedicina
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline w-4 h-4 mr-1" />
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline w-4 h-4 mr-1" />
                  Correo Electrónico {fieldSettings.emailRequired ? "*" : "(opcional)"}
                </label>
                <input
                  type="email"
                  value={formData.patientEmail}
                  onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
                  placeholder="juan@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={fieldSettings.emailRequired}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="inline w-4 h-4 mr-1" />
                  Número de Teléfono {fieldSettings.phoneRequired ? "*" : "(opcional)"}
                </label>
                <input
                  type="tel"
                  value={formData.patientPhone}
                  onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                  placeholder="+52 33 1234 5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={fieldSettings.phoneRequired}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="inline w-4 h-4 mr-1" />
                  WhatsApp {fieldSettings.whatsappRequired ? "*" : "(opcional)"}
                </label>
                <input
                  type="tel"
                  value={formData.patientWhatsapp}
                  onChange={(e) => setFormData({ ...formData, patientWhatsapp: e.target.value })}
                  placeholder="+52 33 1234 5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={fieldSettings.whatsappRequired}
                />
                <p className="text-xs text-gray-500 mt-1">Para confirmación de cita</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Algún requerimiento especial o pregunta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Privacy consent */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => { setPrivacyConsent(e.target.checked); setBookingError(null); }}
                    className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 rounded"
                  />
                  <span className="text-xs text-gray-600 leading-snug">
                    He leído y acepto el{" "}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                      Aviso de Privacidad
                    </a>
                    {" "}y consiento el tratamiento de mis datos personales para gestionar mi cita médica. *
                  </span>
                </label>
              </div>

              {bookingError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {bookingError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isFirstTime === null || (appointmentModes.length > 0 && appointmentMode === null) || !privacyConsent}
                onClick={() => setBookingError(null)}
                className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Reservando...
                  </>
                ) : (
                  "Confirmar Reserva"
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ── Calendar + Service + Time Steps ── */
          <div>
            {/* Step 1: Calendar (always visible) */}
            <div className="mb-2">
              <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-1">
                1. Selecciona fecha
              </p>

              {/* Month nav */}
              <div className="flex items-center justify-between mb-1 bg-blue-50 px-1.5 py-1 rounded-md">
                <button
                  onClick={() => { setCurrentMonth(new Date(year, month - 1)); setSelectedDate(null); setSelectedServiceId(null); setSelectedTime(null); setTimeSlots({}); }}
                  className="p-1 hover:bg-white rounded-md transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--color-secondary)]" />
                </button>
                <h4 className="font-bold text-xs text-[var(--color-secondary)] capitalize">
                  {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                </h4>
                <button
                  onClick={() => { setCurrentMonth(new Date(year, month + 1)); setSelectedDate(null); setSelectedServiceId(null); setSelectedTime(null); setTimeSlots({}); }}
                  className="p-1 hover:bg-white rounded-md transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-[var(--color-secondary)]" />
                </button>
              </div>

              {loadingAvailability ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                    {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] font-semibold text-gray-600 py-0.5">
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
                          onClick={() => hasAvail && !isPast && handleDateSelect(dateStr)}
                          disabled={!hasAvail || isPast}
                          className={`relative aspect-square rounded-md text-[11px] font-medium transition-all ${
                            isSelected
                              ? "bg-[var(--color-primary)] text-[var(--color-neutral-dark)] ring-1 ring-[var(--color-primary)] scale-105 shadow-md"
                              : hasAvail && !isPast
                              ? "bg-blue-50 text-blue-700 hover:bg-blue-100 ring-1 ring-[var(--color-primary)]"
                              : isPast
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {availableDates.length === 0 && (
                    <div className="text-center py-3">
                      <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">No hay citas disponibles este mes</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 2: Service selection (after date selected) */}
            {selectedDate && !onDayClick && (
              <div className="border-t pt-2 mb-2">
                <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-1">
                  2. Selecciona servicio
                </p>
                {loadingServices ? (
                  <div className="space-y-1.5">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : activeServices.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin servicios disponibles</p>
                ) : (
                  <div className="space-y-1">
                    {activeServices.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => handleServiceSelect(svc.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border-2 transition-all ${
                          selectedServiceId === svc.id
                            ? "border-[var(--color-secondary)] bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 bg-white"
                        }`}
                      >
                        <p className="text-xs font-semibold text-gray-900">{svc.service_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {!!svc.duration_minutes && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {svc.duration_minutes} min
                            </span>
                          )}
                          {svc.price !== undefined && (
                            <span className="text-[10px] font-medium text-[var(--color-secondary)] flex items-center gap-0.5">
                              <DollarSign className="w-2.5 h-2.5" />
                              {formatPrice(svc.price!)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Time selection (after date + service selected) */}
            {selectedDate && selectedServiceId && !onDayClick && (
              <div ref={timeSlotsRef} className="border-t pt-1.5 mt-1.5">
                <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-0.5">
                  3. Selecciona hora
                </p>
                {loadingTimeSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : selectedDateSlots.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Sin horarios disponibles</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {selectedDateSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        onClick={() => handleTimeSelect(slot)}
                        className="flex flex-col items-center justify-center p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 rounded-md transition-all hover:scale-105"
                      >
                        <span className="text-[11px] font-bold text-gray-900 leading-tight">{slot.startTime}</span>
                        <span className="text-[9px] text-blue-600 leading-tight">{slot.endTime}</span>
                        {slot.locationName && (
                          <span className="text-[8px] text-gray-500 leading-tight truncate w-full text-center">{slot.locationName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
