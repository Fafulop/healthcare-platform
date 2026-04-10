"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, DollarSign, User, Mail, Phone, MessageSquare, CheckCircle, Loader2, ChevronLeft, ChevronRight, Stethoscope } from "lucide-react";
import { trackSlotSelected, trackBookingComplete } from "@/lib/analytics";
import type { Service } from "@/types/doctor";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

// Helper to format a date string without timezone shift
function formatDateString(dateStr: string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(locale, options);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
  discount: number | null;
  discountType: string | null;
  finalPrice: number;
  location: { name: string; address: string } | null;
}

interface BookingWidgetProps {
  doctorSlug: string;
  isModal?: boolean;
  onDayClick?: (dateStr: string) => void;
  initialDate?: string | null;
  googleAdsId?: string;
  services?: Service[];
  appointmentModes?: ('in_person' | 'teleconsult')[];
}

export default function BookingWidget({ doctorSlug, isModal = false, onDayClick, initialDate = null, googleAdsId, services = [], appointmentModes = ['in_person', 'teleconsult'] }: BookingWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate && typeof initialDate === 'string' && initialDate.includes('-')) {
      const [y, m] = initialDate.split('-').map(Number);
      if (y && m) {
        return new Date(y, m - 1, 1);
      }
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingStep, setBookingStep] = useState<"calendar" | "form" | "success">("calendar");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service selection
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [freshServices, setFreshServices] = useState<Service[] | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);

  // Visit context
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(true);
  const [appointmentMode, setAppointmentMode] = useState<'PRESENCIAL' | 'TELEMEDICINA' | null>('PRESENCIAL');

  // Form data
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

  // Per-doctor field requirements for the public booking flow
  const [fieldSettings, setFieldSettings] = useState({
    emailRequired: true,
    phoneRequired: true,
    whatsappRequired: true,
  });

  useEffect(() => {
    fetchAvailability();
  }, [currentMonth, doctorSlug]);

  useEffect(() => {
    fetch(`${API_URL}/api/doctors/${doctorSlug}/booking-field-settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setFieldSettings({
            emailRequired:    d.data.bookingPublicEmailRequired,
            phoneRequired:    d.data.bookingPublicPhoneRequired,
            whatsappRequired: d.data.bookingPublicWhatsappRequired,
          });
        }
      })
      .catch(() => {});
  }, [doctorSlug]);

  // Set selected date and navigate to its month when initialDate changes
  useEffect(() => {
    if (initialDate && typeof initialDate === 'string' && initialDate.includes('-')) {
      setSelectedDate(initialDate);
      const [y, m] = initialDate.split('-').map(Number);
      if (y && m) {
        setCurrentMonth(new Date(y, m - 1, 1));
      }
    }
  }, [initialDate]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const monthStr = `${year}-${month.toString().padStart(2, "0")}`;

      const response = await fetch(
        `${API_URL}/api/doctors/${doctorSlug}/availability?month=${monthStr}`
      );
      const data = await response.json();

      if (data.success) {
        setAvailableDates(data.availableDates || []);
        setSlotsByDate(data.slotsByDate || {});
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    // If onDayClick is provided (sidebar mode), pass the date and open modal
    if (onDayClick) {
      onDayClick(dateStr);
      return;
    }

    // Normal flow for modal or when no onDayClick is provided
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setBookingStep("calendar");
  };

  const handleSlotSelect = (slot: Slot) => {
    trackSlotSelected(doctorSlug, slot.date, slot.startTime, slot.finalPrice);
    setSelectedSlot(slot);
    setSelectedServiceId(null);
    setFreshServices(null);
    setLoadingServices(true);
    setBookingStep("form");
    // Re-fetch services to avoid stale data from ISR page cache
    fetch(`${API_URL}/api/doctors/${doctorSlug}/services`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setFreshServices(data.data); })
      .catch(() => { setFreshServices(services); })
      .finally(() => { setLoadingServices(false); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot) return;

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
      const response = await fetch(`${API_URL}/api/appointments/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          ...formData,
          serviceId: selectedServiceId || undefined,
          isFirstTime: isFirstTime,
          appointmentMode: appointmentMode || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        trackBookingComplete(doctorSlug, selectedSlot.date, selectedSlot.finalPrice, googleAdsId);
        setConfirmationCode(data.data.confirmationCode);
        setBookingStep("success");
        // Reset form
        setFormData({
          patientName: "",
          patientEmail: "",
          patientPhone: "",
          patientWhatsapp: "",
          notes: "",
        });
      } else {
        setBookingError(data.error || "No se pudo crear la cita. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      setBookingError("No se pudo crear la cita. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setBookingStep("calendar");
    setConfirmationCode("");
    setSelectedServiceId(null);
    setIsFirstTime(true);
    setPrivacyConsent(false);
    setAppointmentMode('PRESENCIAL');
    fetchAvailability(); // Refresh availability
  };

  // Calendar rendering
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedSlots = selectedDate ? slotsByDate[selectedDate] || [] : [];

  // Always use the freshest services available; fall back to the ISR-rendered prop
  const activeServices = freshServices ?? services;

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  // Success screen
  if (bookingStep === "success") {
    const containerStyle = isModal
      ? { width: '100%', padding: '0' }
      : {};

    return (
      <div
        className={isModal ? "" : "bg-white rounded-xl shadow-lg p-6 sticky top-6"}
        style={containerStyle}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-[var(--color-secondary)] mb-2">¡Reserva Confirmada!</h3>
          <p className="text-gray-600 mb-4">Tu cita ha sido agendada exitosamente.</p>

          {selectedSlot && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left border-2 border-blue-200">
              <p className="text-sm font-semibold text-[var(--color-secondary)] mb-3">Detalles de la Cita:</p>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900">
                  <strong>Fecha:</strong> {formatDateString(selectedSlot.date, "es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-gray-900">
                  <strong>Hora:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}
                </p>
                {!!selectedSlot.duration && (
                <p className="text-gray-900">
                  <strong>Duración:</strong> {selectedSlot.duration} minutos
                </p>
                )}
                {selectedSlot.location && (
                  <p className="text-gray-900">
                    <strong>Consultorio:</strong> {selectedSlot.location.name}{selectedSlot.location.address ? ` — ${selectedSlot.location.address}` : ""}
                  </p>
                )}
                {selectedServiceId && activeServices.find(s => s.id === selectedServiceId) && (
                  <>
                    <p className="text-gray-900">
                      <strong>Servicio:</strong> {activeServices.find(s => s.id === selectedServiceId)!.service_name}
                    </p>
                    {activeServices.find(s => s.id === selectedServiceId)!.price != null && (
                      <p className="text-gray-900">
                        <strong>Precio:</strong> ${activeServices.find(s => s.id === selectedServiceId)!.price}
                      </p>
                    )}
                  </>
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

  const containerStyle = isModal
    ? { width: '100%', padding: '0' }
    : {};

  return (
    <div
      className={isModal ? "" : "bg-white"}
      style={containerStyle}
    >
      {/* Colorful Gradient Header */}
      <div className="bg-[var(--color-secondary)] text-white px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Reserva tu Cita</h3>
            <p className="text-[10px] text-white/80 leading-tight">Selecciona fecha y hora</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="px-2 py-2">
        {/* Form Step */}
        {bookingStep === "form" && selectedSlot ? (
          <div>
          <button
            onClick={() => setBookingStep("calendar")}
            className="text-sm font-semibold text-[var(--color-secondary)] hover:text-[#195158] mb-4 flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al calendario
          </button>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
            <p className="text-xs font-medium text-[var(--color-secondary)] mb-1 opacity-80">Horario seleccionado:</p>
            <p className="text-sm font-semibold text-[var(--color-neutral-dark)]">
              {formatDateString(selectedSlot.date, "es-MX", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })} • {selectedSlot.startTime}
            </p>
            {selectedSlot.location && (
              <p className="text-xs text-gray-600 mt-1">
                📍 {selectedSlot.location.name}{selectedSlot.location.address ? ` — ${selectedSlot.location.address}` : ""}
              </p>
            )}
            {selectedServiceId && activeServices.find(s => s.id === selectedServiceId)?.price != null && (
              <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">
                ${activeServices.find(s => s.id === selectedServiceId)!.price}
              </p>
            )}
          </div>

          {/* Service Selector */}
          {loadingServices ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Stethoscope className="inline w-4 h-4 mr-1" />
                Servicio *
              </label>
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : activeServices.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Stethoscope className="inline w-4 h-4 mr-1" />
                Servicio *
              </label>
              <div className="space-y-2">
                {activeServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedServiceId === service.id
                        ? "border-[var(--color-secondary)] bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{service.service_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {!!service.duration_minutes && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.duration_minutes} min
                      </span>
                      )}
                      {service.price !== undefined && (
                        <span className="text-xs font-medium text-[var(--color-secondary)] flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {service.price}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Presencial / Telemedicina — only show relevant modes */}
          {(appointmentModes.includes('in_person') || appointmentModes.includes('teleconsult')) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Modalidad *</label>
              <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
                {appointmentModes.includes('in_person') && (
                  <button
                    type="button"
                    onClick={() => setAppointmentMode('PRESENCIAL')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      appointmentMode === 'PRESENCIAL'
                        ? "bg-[var(--color-secondary)] text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Presencial
                  </button>
                )}
                {appointmentModes.includes('teleconsult') && (
                  <button
                    type="button"
                    onClick={() => setAppointmentMode('TELEMEDICINA')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      appointmentMode === 'TELEMEDICINA'
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Algún requerimiento especial o pregunta..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Aviso de Privacidad */}
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
              disabled={isSubmitting || loadingServices || (activeServices.length > 0 && !selectedServiceId) || isFirstTime === null || (appointmentModes.length > 0 && appointmentMode === null) || !privacyConsent}
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
        // Calendar Step
        <div>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-1 bg-blue-50 px-1.5 py-1 rounded-md">
            <button
              onClick={goToPrevMonth}
              className="p-1 hover:bg-white rounded-md transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--color-secondary)]" />
            </button>
            <h4 className="font-bold text-xs text-[var(--color-secondary)]">
              {currentMonth.toLocaleDateString("es-MX", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-white rounded-md transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-[var(--color-secondary)]" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                {["D", "L", "M", "M", "J", "V", "S"].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-semibold text-gray-600 py-0.5">
                    {day}
                  </div>
                ))}

                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} />;
                  }

                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const slotsCount = slotsByDate[dateStr]?.length || 0;
                  const hasSlots = slotsCount > 0;
                  const isSelected = dateStr === selectedDate;
                  const isPast = dateStr < today;

                  return (
                    <button
                      key={day}
                      onClick={() => hasSlots && !isPast && handleDateSelect(dateStr)}
                      disabled={!hasSlots || isPast}
                      className={`relative aspect-square rounded-md text-[11px] font-medium transition-all ${
                        isSelected
                          ? "bg-[var(--color-primary)] text-[var(--color-neutral-dark)] ring-1 ring-[var(--color-primary)] scale-105 shadow-md"
                          : hasSlots && !isPast
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 ring-1 ring-[var(--color-primary)]"
                          : isPast
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <span>{day}</span>
                      {hasSlots && !isSelected && !isPast && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-primary)] text-[var(--color-neutral-dark)] rounded-full text-[8px] font-bold flex items-center justify-center shadow-sm">
                          {slotsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Available Time Slots */}
              {selectedDate && !onDayClick && (
                <div className="border-t pt-1.5 mt-1.5">
                  {selectedSlots.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">
                      Sin horarios disponibles
                    </p>
                  ) : (
                    <div>
                      <p className="text-[10px] text-gray-600 mb-0.5 font-medium uppercase tracking-wide">Horarios:</p>
                      <div className="grid grid-cols-3 gap-1">
                        {selectedSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotSelect(slot)}
                            className="flex flex-col items-center justify-center p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 rounded-md transition-all hover:scale-105"
                          >
                            <span className="text-[11px] font-bold text-gray-900 leading-tight">{slot.startTime}</span>
                            {!!slot.duration && <span className="text-[9px] text-blue-600 leading-tight">{slot.duration} min</span>}
                            {slot.location && (
                              <span className="text-[8px] text-gray-500 leading-tight truncate w-full text-center">{slot.location.name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {availableDates.length === 0 && (
                <div className="text-center py-4">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">No hay citas disponibles</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
