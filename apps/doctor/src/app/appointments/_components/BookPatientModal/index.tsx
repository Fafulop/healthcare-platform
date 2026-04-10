"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { getLocalDateString, formatLocalDate } from "@/lib/dates";
import type { AppointmentSlot, ClinicLocation } from "../../_hooks/useSlots";
import type { Booking } from "../../_hooks/useBookings";
import { SlotPickerStep } from "./SlotPickerStep";
import type { NewSlotForm } from "./SlotPickerStep";
import { PatientFormStep } from "./PatientFormStep";
import type { PatientFormData, PatientFieldSettings } from "./PatientFormStep";
import { SuccessStep } from "./SuccessStep";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const DEFAULT_FIELD_SETTINGS: PatientFieldSettings = { emailRequired: true, phoneRequired: true, whatsappRequired: true };

interface DoctorService {
  id: string;
  serviceName: string;
  durationMinutes: number;
  price: number | null;
}

function calcEndTime(startTime: string, duration: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const endMins = h * 60 + m + duration;
  return `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
}

function todayStr(): string {
  return getLocalDateString(new Date());
}

type Step = "slot" | "form" | "success";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  clinicLocations: ClinicLocation[];
  onSuccess: (newBookingId: string) => void;
  preSelectedSlot?: AppointmentSlot | null;
  rescheduleBooking?: Booking | null;
}

export function BookPatientModal({
  isOpen,
  onClose,
  doctorId,
  clinicLocations,
  onSuccess,
  preSelectedSlot = null,
  rescheduleBooking = null,
}: Props) {
  const initialStep: Step = preSelectedSlot ? "form" : "slot";

  const [step, setStep] = useState<Step>(initialStep);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(preSelectedSlot);

  // Calendar state (for existing slot picker)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<string | null>(null);

  // Slots data
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Services
  const [services, setServices] = useState<DoctorService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Visit context
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(true);
  const [appointmentMode, setAppointmentMode] = useState<"PRESENCIAL" | "TELEMEDICINA" | null>("PRESENCIAL");

  // Patient form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PatientFormData>({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    patientWhatsapp: "",
    notes: "",
  });

  // Tracks whether this booking was a reschedule (captured at submit, stable for SuccessStep)
  const [wasRescheduled, setWasRescheduled] = useState(false);

  // Booking field settings per flow
  const [horariosSettings, setHorariosSettings] = useState<PatientFieldSettings>(DEFAULT_FIELD_SETTINGS);
  const [instantSettings, setInstantSettings] = useState<PatientFieldSettings>(DEFAULT_FIELD_SETTINGS);

  // "Nuevo horario" mode
  const [slotMode, setSlotMode] = useState<"existing" | "new">("existing");
  const [newSlotForm, setNewSlotForm] = useState<NewSlotForm>({
    date: todayStr(),
    startTime: "09:00",
    duration: 60,
    locationId: clinicLocations[0]?.id ?? "",
  });

  const fetchAvailableSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const today = todayStr();
      const future = new Date();
      future.setDate(future.getDate() + 90);
      const futureIso = getLocalDateString(future);

      const startDate = new Date(today + "T00:00:00Z").toISOString();
      const endDate = new Date(futureIso + "T23:59:59Z").toISOString();

      const res = await authFetch(
        `${API_URL}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();
      if (data.success) setSlots(data.data);
    } catch {
      console.error("Error fetching slots");
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId]);

  const reset = useCallback(() => {
    setStep(preSelectedSlot ? "form" : "slot");
    setSelectedSlot(preSelectedSlot);
    setCalendarDate(null);
    setCurrentMonth(new Date());
    setError("");
    setConflictError(null);
    setSelectedServiceId(null);
    setIsFirstTime(rescheduleBooking?.isFirstTime ?? true);
    setAppointmentMode((rescheduleBooking?.appointmentMode as "PRESENCIAL" | "TELEMEDICINA" | null) ?? "PRESENCIAL");
    setFormData(rescheduleBooking ? {
      patientName: rescheduleBooking.patientName,
      patientEmail: rescheduleBooking.patientEmail,
      patientPhone: rescheduleBooking.patientPhone,
      patientWhatsapp: rescheduleBooking.patientWhatsapp ?? "",
      notes: "",
    } : { patientName: "", patientEmail: "", patientPhone: "", patientWhatsapp: "", notes: "" });
    setWasRescheduled(false);
    setSlotMode("existing");
    setNewSlotForm({ date: todayStr(), startTime: "09:00", duration: 60, locationId: clinicLocations[0]?.id ?? "" });
  }, [preSelectedSlot, clinicLocations, rescheduleBooking]);

  useEffect(() => {
    if (isOpen) {
      reset();
      if (!preSelectedSlot) fetchAvailableSlots();
      authFetch("/api/doctor/services")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setServices(d.data);
            if (rescheduleBooking?.serviceName) {
              const match = (d.data as DoctorService[]).find(
                (s) => s.serviceName === rescheduleBooking.serviceName
              );
              if (match) setSelectedServiceId(match.id);
            }
          }
        })
        .catch(() => {});
      authFetch("/api/doctor/booking-field-settings")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            const raw = d.data;
            setHorariosSettings({
              emailRequired:    raw.bookingHorariosEmailRequired,
              phoneRequired:    raw.bookingHorariosPhoneRequired,
              whatsappRequired: raw.bookingHorariosWhatsappRequired,
            });
            setInstantSettings({
              emailRequired:    raw.bookingInstantEmailRequired,
              phoneRequired:    raw.bookingInstantPhoneRequired,
              whatsappRequired: raw.bookingInstantWhatsappRequired,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // When new location is first loaded, default newSlotForm.locationId
  useEffect(() => {
    if (clinicLocations.length > 0 && !newSlotForm.locationId) {
      setNewSlotForm((f) => ({ ...f, locationId: clinicLocations[0].id }));
    }
  }, [clinicLocations]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableSlots = useMemo(() => {
    const today = todayStr();
    return slots
      .filter((s) => s.isOpen && s.currentBookings < s.maxBookings && s.date.split("T")[0] >= today)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });
  }, [slots]);

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

  // Slot info for header and success screen
  const displaySlot = selectedSlot
    ? { date: selectedSlot.date, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime }
    : slotMode === "new" && newSlotForm.date && newSlotForm.startTime
    ? {
        date: newSlotForm.date,
        startTime: newSlotForm.startTime,
        endTime: calcEndTime(newSlotForm.startTime, newSlotForm.duration),
      }
    : null;

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const handleNewSlotContinue = () => {
    if (!newSlotForm.date || !newSlotForm.startTime) {
      setError("Selecciona una fecha y hora");
      return;
    }
    setError("");
    setConflictError(null);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setConflictError(null);

    if (isFirstTime === null) {
      setError("Por favor selecciona el tipo de visita (Primera vez / Recurrente)");
      setIsSubmitting(false);
      return;
    }
    if (appointmentMode === null) {
      setError("Por favor selecciona la modalidad (Presencial / Telemedicina)");
      setIsSubmitting(false);
      return;
    }

    try {
      if (slotMode === "new") {
        const res = await authFetch(`${API_URL}/api/appointments/bookings/instant`, {
          method: "POST",
          body: JSON.stringify({
            doctorId,
            date: newSlotForm.date,
            startTime: newSlotForm.startTime,
            duration: newSlotForm.duration,
            basePrice: 0,
            patientName: formData.patientName,
            patientEmail: formData.patientEmail,
            patientPhone: formData.patientPhone,
            patientWhatsapp: formData.patientWhatsapp || undefined,
            notes: formData.notes || undefined,
            serviceId: selectedServiceId || undefined,
            isFirstTime,
            appointmentMode: appointmentMode || undefined,
            isRescheduled: !!rescheduleBooking,
            ...(newSlotForm.locationId ? { locationId: newSlotForm.locationId } : {}),
          }),
        });
        const data = await res.json();

        // 409 = a public slot already exists at this time
        if (res.status === 409) {
          setConflictError(
            data.error ||
              'Ya existe un horario público en este mismo tiempo. Usa "Horarios disponibles" para seleccionarlo, o elige otra hora.'
          );
          setStep("slot");
          return;
        }

        if (!data.success) {
          setError(data.error || "Error al crear la cita");
          return;
        }

        setWasRescheduled(!!rescheduleBooking);
        setStep("success");
        onSuccess(data.data.id);
        return;
      }

      // Existing slot mode
      if (!selectedSlot) return;
      const bookingRes = await authFetch(`${API_URL}/api/appointments/bookings`, {
        method: "POST",
        body: JSON.stringify({
          slotId: selectedSlot.id,
          patientName: formData.patientName,
          patientEmail: formData.patientEmail,
          patientPhone: formData.patientPhone,
          patientWhatsapp: formData.patientWhatsapp || undefined,
          notes: formData.notes || undefined,
          serviceId: selectedServiceId || undefined,
          isFirstTime,
          appointmentMode: appointmentMode || undefined,
          isRescheduled: !!rescheduleBooking,
        }),
      });
      const bookingData = await bookingRes.json();

      if (!bookingData.success) {
        setError(bookingData.error || "Error al crear la cita");
        return;
      }

      setConfirmationCode(bookingData.data.confirmationCode);
      setWasRescheduled(!!rescheduleBooking);
      setStep("success");
      onSuccess(bookingData.data.id);
    } catch {
      setError("Error de conexión. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {rescheduleBooking ? "Reagendar Cita" : "Agendar Cita"}
            </h2>
            {rescheduleBooking && step === "slot" && (
              <p className="text-sm text-amber-600 font-medium">Paciente: {rescheduleBooking.patientName}</p>
            )}
            {step === "slot" && !rescheduleBooking && (
              <p className="text-sm text-gray-500">Selecciona una fecha y horario</p>
            )}
            {step === "form" && displaySlot && (
              <p className="text-sm text-gray-500">
                {formatLocalDate(displaySlot.date, { weekday: "short", day: "numeric", month: "short" })}
                {" · "}{displaySlot.startTime} – {displaySlot.endTime}
              </p>
            )}
            {step === "success" && <p className="text-sm text-gray-500">Cita confirmada</p>}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
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

          {step === "slot" && (
            <SlotPickerStep
              slotMode={slotMode}
              setSlotMode={(m) => { setSlotMode(m); setError(""); setConflictError(null); }}
              availableSlots={availableSlots}
              slotsByDate={slotsByDate}
              availableDateSet={availableDateSet}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              onSlotSelect={(slot) => { setSelectedSlot(slot); setStep("form"); }}
              loadingSlots={loadingSlots}
              newSlotForm={newSlotForm}
              setNewSlotForm={setNewSlotForm}
              clinicLocations={clinicLocations}
              onNewSlotContinue={handleNewSlotContinue}
              conflictError={conflictError}
              error={error}
            />
          )}

          {step === "form" && (
            <form id="book-patient-form" onSubmit={handleSubmit}>
              {!preSelectedSlot && (
                <button
                  type="button"
                  onClick={() => setStep("slot")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-4 block"
                >
                  ← Cambiar horario
                </button>
              )}
              <PatientFormStep
                services={services}
                selectedServiceId={selectedServiceId}
                onSelectService={(id) => setSelectedServiceId(selectedServiceId === id ? null : id)}
                isFirstTime={isFirstTime}
                setIsFirstTime={setIsFirstTime}
                appointmentMode={appointmentMode}
                setAppointmentMode={setAppointmentMode}
                formData={formData}
                setFormData={setFormData}
                error={error}
                fieldSettings={slotMode === "new" ? instantSettings : horariosSettings}
              />
            </form>
          )}

          {step === "success" && (
            <SuccessStep
              patientName={formData.patientName}
              displaySlot={displaySlot}
              selectedService={selectedService}
              onClose={handleClose}
              isRescheduled={wasRescheduled}
            />
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
              disabled={isSubmitting || (services.length > 0 && !selectedServiceId) || isFirstTime === null || appointmentMode === null}
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
