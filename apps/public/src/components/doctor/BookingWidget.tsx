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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
          <p className="text-gray-600 mb-4">Your appointment has been successfully booked.</p>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 mb-1">Confirmation Code</p>
            <p className="text-2xl font-bold text-green-900 tracking-wider">{confirmationCode}</p>
          </div>

          {selectedSlot && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-2">Appointment Details:</p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-900">
                  <strong>Date:</strong> {new Date(selectedSlot.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-gray-900">
                  <strong>Time:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}
                </p>
                <p className="text-gray-900">
                  <strong>Duration:</strong> {selectedSlot.duration} minutes
                </p>
                <p className="text-gray-900">
                  <strong>Price:</strong> ${selectedSlot.finalPrice}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-4">
            You will receive a WhatsApp confirmation shortly.
          </p>

          <button
            onClick={resetBooking}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Book Another Appointment
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
      className={isModal ? "" : "bg-white rounded-xl shadow-lg p-6 sticky top-6"}
      style={containerStyle}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-blue-600" />
        Book Appointment
      </h3>

      {/* Form Step */}
      {bookingStep === "form" && selectedSlot ? (
        <div>
          <button
            onClick={() => setBookingStep("calendar")}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1"
          >
            ← Back to calendar
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-1">Selected Time:</p>
            <p className="text-sm text-blue-800">
              {new Date(selectedSlot.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })} at {selectedSlot.startTime}
            </p>
            <p className="text-lg font-bold text-blue-900 mt-2">
              ${selectedSlot.finalPrice}
              {selectedSlot.discount && (
                <span className="text-sm text-green-600 ml-2">
                  ({selectedSlot.discountType === "PERCENTAGE" ? `${selectedSlot.discount}%` : `$${selectedSlot.discount}`} off)
                </span>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline w-4 h-4 mr-1" />
                Full Name *
              </label>
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline w-4 h-4 mr-1" />
                Email *
              </label>
              <input
                type="email"
                value={formData.patientEmail}
                onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline w-4 h-4 mr-1" />
                Phone Number *
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
                WhatsApp (optional)
              </label>
              <input
                type="tel"
                value={formData.patientWhatsapp}
                onChange={(e) => setFormData({ ...formData, patientWhatsapp: e.target.value })}
                placeholder="+52 33 1234 5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">For appointment confirmation</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special requirements or questions..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </button>
          </form>
        </div>
      ) : (
        // Calendar Step
        <div>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h4 className="font-semibold text-gray-900">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-gray-600 py-1">
                    {day}
                  </div>
                ))}

                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} />;
                  }

                  const dateStr = new Date(year, month, day).toISOString().split("T")[0];
                  const isAvailable = availableDates.includes(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isPast = dateStr < today;

                  return (
                    <button
                      key={day}
                      onClick={() => isAvailable && !isPast && handleDateSelect(dateStr)}
                      disabled={!isAvailable || isPast}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : isAvailable && !isPast
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
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

              {/* Available Time Slots */}
              {selectedDate && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {new Date(selectedDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>

                  {selectedSlots.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No available slots for this date
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedSlots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => handleSlotSelect(slot)}
                          className="w-full text-left p-3 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-600" />
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="font-bold text-blue-700 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {slot.finalPrice}
                            </span>
                          </div>
                          {slot.discount && (
                            <p className="text-xs text-green-600">
                              {slot.discountType === "PERCENTAGE" ? `${slot.discount}% off` : `$${slot.discount} off`}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">{slot.duration} minutes</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availableDates.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No available appointments this month</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
