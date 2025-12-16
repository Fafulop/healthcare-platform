"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, DollarSign, User, Mail, Phone, MessageSquare, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

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
}

interface BookingWidgetProps {
  doctorSlug: string;
  isModal?: boolean;
}

export default function BookingWidget({ doctorSlug, isModal = false }: BookingWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingStep, setBookingStep] = useState<"calendar" | "form" | "success">("calendar");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    patientWhatsapp: "",
    notes: "",
  });

  const [confirmationCode, setConfirmationCode] = useState("");

  useEffect(() => {
    fetchAvailability();
  }, [currentMonth, doctorSlug]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const monthStr = `${year}-${month.toString().padStart(2, "0")}`;

      const response = await fetch(
        `http://localhost:3003/api/doctors/${doctorSlug}/availability?month=${monthStr}`
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
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setBookingStep("calendar");
  };

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setBookingStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:3003/api/appointments/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          ...formData,
        }),
      });

      const data = await response.json();

      if (data.success) {
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
        alert(data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Failed to create booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setBookingStep("calendar");
    setConfirmationCode("");
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

  const today = new Date().toISOString().split("T")[0];
  const selectedSlots = selectedDate ? slotsByDate[selectedDate] || [] : [];

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
          <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-[var(--color-secondary)] mb-2">¡Reserva Confirmada!</h3>
          <p className="text-gray-600 mb-4">Tu cita ha sido agendada exitosamente.</p>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-6 shadow-sm">
            <p className="text-sm text-green-800 mb-1 font-medium">Código de Confirmación</p>
            <p className="text-2xl font-bold text-green-900 tracking-wider">{confirmationCode}</p>
          </div>

          {selectedSlot && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 text-left border-2 border-blue-200">
              <p className="text-sm font-semibold text-[var(--color-secondary)] mb-3">Detalles de la Cita:</p>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900">
                  <strong>Fecha:</strong> {new Date(selectedSlot.date).toLocaleDateString("es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-gray-900">
                  <strong>Hora:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}
                </p>
                <p className="text-gray-900">
                  <strong>Duración:</strong> {selectedSlot.duration} minutos
                </p>
                <p className="text-gray-900">
                  <strong>Precio:</strong> ${selectedSlot.finalPrice}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-4">
            Recibirás una confirmación por WhatsApp en breve.
          </p>

          <button
            onClick={resetBooking}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md"
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
      <div className="bg-gradient-to-br from-[var(--color-secondary)] via-[#1D5B63] to-[#195158] text-white px-2 py-1.5">
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

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
            <p className="text-xs font-medium text-[var(--color-secondary)] mb-1 opacity-80">Horario seleccionado:</p>
            <p className="text-sm font-semibold text-[var(--color-neutral-dark)]">
              {new Date(selectedSlot.date).toLocaleDateString("es-MX", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })} • {selectedSlot.startTime}
            </p>
            <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">
              ${selectedSlot.finalPrice}
              {selectedSlot.discount && (
                <span className="text-sm text-green-600 ml-2 font-semibold">
                  ({selectedSlot.discountType === "PERCENTAGE" ? `-${selectedSlot.discount}%` : `-$${selectedSlot.discount}`})
                </span>
              )}
            </p>
          </div>

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
                Correo Electrónico *
              </label>
              <input
                type="email"
                value={formData.patientEmail}
                onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
                placeholder="juan@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline w-4 h-4 mr-1" />
                Número de Teléfono *
              </label>
              <input
                type="tel"
                value={formData.patientPhone}
                onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                placeholder="+52 33 1234 5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MessageSquare className="inline w-4 h-4 mr-1" />
                WhatsApp (opcional)
              </label>
              <input
                type="tel"
                value={formData.patientWhatsapp}
                onChange={(e) => setFormData({ ...formData, patientWhatsapp: e.target.value })}
                placeholder="+52 33 1234 5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[var(--color-secondary)] to-[#195158] hover:from-[#195158] hover:to-[var(--color-secondary)] text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
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
          <div className="flex items-center justify-between mb-1 bg-gradient-to-r from-blue-50 to-indigo-50 px-1.5 py-1 rounded-md">
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

                  const dateStr = new Date(year, month, day).toISOString().split("T")[0];
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
                          ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-[var(--color-neutral-dark)] ring-1 ring-[var(--color-primary)] scale-105 shadow-md"
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
              {selectedDate && (
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
                            className="flex flex-col items-center justify-center p-1 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 hover:border-blue-400 rounded-md transition-all hover:scale-105"
                          >
                            <span className="text-[11px] font-bold text-gray-900 leading-tight">{slot.startTime}</span>
                            <span className="text-[9px] text-blue-700 font-semibold leading-tight">${slot.finalPrice}</span>
                            {slot.discount && (
                              <span className="text-[8px] text-green-600 font-medium leading-tight">
                                -{slot.discountType === "PERCENTAGE" ? `${slot.discount}%` : `$${slot.discount}`}
                              </span>
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
