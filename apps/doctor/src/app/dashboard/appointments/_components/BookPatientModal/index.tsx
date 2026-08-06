"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { getLocalDateString, getClinicDateString, formatLocalDate, formatTimeOfDay } from "@/lib/dates";
import type { AppointmentSlot, ClinicLocation } from "../../_hooks/useSlots";
import type { Booking } from "../../_hooks/useBookings";
import { SlotPickerStep } from "./SlotPickerStep";
import type { NewSlotForm } from "./SlotPickerStep";
import { RangeTimePickerStep } from "../RangeTimePickerStep";
import { PatientFormStep } from "./PatientFormStep";
import type { PatientFormData, PatientFieldSettings } from "./PatientFormStep";
import { partirNombreDeCita, nombreCompleto } from "@/lib/patient-name";
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
  return getClinicDateString();
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
  /** When true, uses RangeTimePickerStep instead of SlotPickerStep */
  rangeMode?: boolean;
  /** Required when rangeMode is true — doctor's URL slug for range-availability API */
  doctorSlug?: string;
  /**
   * Hueco clicado en el calendario (`YYYY-MM-DD` + `HH:MM`). Sólo se atiende en `rangeMode`:
   * precarga el picker en esa fecha y escribe esa hora en el campo.
   *
   * ⚠️ Precarga, NO confirma. La hora se valida contra la lista del servidor igual que si la
   * hubiera escrito el doctor —puede salir ocupada, pasada o fuera de rejilla— y confirmar
   * sigue siendo un acto aparte. Pasar de esto a "agendar al clicar" sería dar por libre una
   * hora que el cliente no puede decidir (regla 0).
   */
  preselectedDate?: string;
  preselectedTime?: string;
}

export function BookPatientModal({
  isOpen,
  onClose,
  doctorId,
  clinicLocations,
  onSuccess,
  preSelectedSlot = null,
  rescheduleBooking = null,
  rangeMode = false,
  doctorSlug,
  preselectedDate,
  preselectedTime,
}: Props) {
  const initialStep: Step = preSelectedSlot ? "form" : "slot";

  const [step, setStep] = useState<Step>(initialStep);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  useEffect(() => { cuerpoRef.current?.scrollTo({ top: 0 }); }, [step]);
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
    patientFirstName: "",
    patientLastName: "",
    patientEmail: "",
    patientPhone: "",
    patientWhatsapp: "",
    notes: "",
  });

  // Patient link (for Recurrente bookings)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  // Contacto tal como estaba en el expediente al seleccionarlo. Sirve para dos cosas:
  // precargar los campos (antes se quedaban vacíos y el doctor re-tecleaba o no ponía
  // nada — de ahí salían las citas sin correo de pacientes que SÍ lo tenían) y detectar
  // si el doctor lo EDITÓ, para escribirlo de vuelta al expediente.
  const [patientContactAlSeleccionar, setPatientContactAlSeleccionar] = useState<{ firstName: string; lastName: string; email: string; phone: string } | null>(null);

  // Tracks whether this booking was a reschedule (captured at submit, stable for SuccessStep)
  const [wasRescheduled, setWasRescheduled] = useState(false);

  // Booking field settings per flow
  const [horariosSettings, setHorariosSettings] = useState<PatientFieldSettings>(DEFAULT_FIELD_SETTINGS);
  const [instantSettings, setInstantSettings] = useState<PatientFieldSettings>(DEFAULT_FIELD_SETTINGS);

  // Range mode selection (when rangeMode=true)
  const [rangeSelection, setRangeSelection] = useState<{
    date: string; startTime: string; endTime: string;
    serviceId: string; serviceName: string; duration: number; price: number;
    locationName?: string | null;
  } | null>(null);

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
    // REAGENDAR conserva el expediente. Reagendar crea una cita NUEVA y cancela la vieja
    // (appointments/page.tsx), y aquí se reseteaba selectedPatientId a null ⇒ el submit
    // mandaba `patientId: undefined` y la cita nueva nacía HUÉRFANA. Medido en prod: 7%
    // de las reagendadas conservan expediente contra 16% de las normales, aunque TODAS
    // vienen de una cita que ya existía. Una cita sin expediente no se puede facturar, no
    // acepta link de pago, su ingreso queda suelto en el ledger y desaparece del historial
    // del paciente — o sea que reagendar degradaba la cita en silencio.
    // El AGENTE ya lo hacía bien (proposals.ts: `...(b.patientId ? { patientId } : {})`);
    // era la UI la que se quedaba atrás.
    const rp = rescheduleBooking?.patient ?? null;
    const rpNombre = rp ? `${rp.firstName} ${rp.lastName}`.trim() : "";
    // Sin expediente vinculado, el nombre sale de la CITA: sus campos separados si los tiene, y
    // si no (cita vieja, del widget o del agente) el split de siempre.
    const deLaCita = rescheduleBooking
      ? partirNombreDeCita(rescheduleBooking)
      : { firstName: "", lastName: "" };
    setFormData(rescheduleBooking ? {
      // Con expediente vinculado gana el dato VIVO; la copia de la cita es de cuando se
      // agendó. Si el expediente no lo trae, se cae a esa copia.
      patientFirstName: rp?.firstName || deLaCita.firstName,
      patientLastName: rp?.lastName || deLaCita.lastName,
      patientEmail: rp?.email || rescheduleBooking.patientEmail,
      patientPhone: rp?.phone || rescheduleBooking.patientPhone,
      patientWhatsapp: rescheduleBooking.patientWhatsapp ?? "",
      notes: "",
    } : { patientFirstName: "", patientLastName: "", patientEmail: "", patientPhone: "", patientWhatsapp: "", notes: "" });
    setWasRescheduled(false);
    setSelectedPatientId(rescheduleBooking?.patientId ?? null);
    setSelectedPatientName(rpNombre);
    setPatientContactAlSeleccionar(
      rp ? { firstName: rp.firstName ?? "", lastName: rp.lastName ?? "", email: rp.email ?? "", phone: rp.phone ?? "" } : null
    );
    setRangeSelection(null);
    setSlotMode("existing");
    setNewSlotForm({ date: todayStr(), startTime: "09:00", duration: 60, locationId: clinicLocations[0]?.id ?? "" });
  }, [preSelectedSlot, clinicLocations, rescheduleBooking]);

  useEffect(() => {
    if (isOpen) {
      reset();
      if (!preSelectedSlot && !rangeMode) fetchAvailableSlots();
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
      .filter((s) => s.isOpen && s.currentBookings < s.maxBookings && !s.isBlockedByBooking && s.date.split("T")[0] >= today)
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
  const displaySlot = rangeSelection
    ? { date: rangeSelection.date, startTime: rangeSelection.startTime, endTime: rangeSelection.endTime }
    : selectedSlot
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

  /**
   * Si el doctor EDITÓ el contacto precargado de un paciente existente, el expediente se
   * actualiza: es la fuente viva del dato. Sin esto, corregir el correo al agendar lo
   * dejaría solo en la cita —que nadie vuelve a leer— y el expediente seguiría con el
   * viejo, que es justo cómo se acumulan dos correos para la misma persona.
   *
   * Se llama SOLO cuando la cita ya se creó: si se hiciera antes, un conflicto de horario
   * dejaría el expediente actualizado sin cita. La corrección no se pierde en ese caso —
   * sigue en el formulario para el reintento.
   *
   * No se espera (`await`) a propósito: es secundario y no debe retrasar la pantalla de
   * éxito. Un fallo avisa, no rompe.
   */
  const sincronizarContactoConExpediente = () => {
    if (!selectedPatientId || !patientContactAlSeleccionar) return;
    const email = formData.patientEmail.trim();
    const phone = formData.patientPhone.trim();
    const cambios: Record<string, string> = {};
    if (email && email !== patientContactAlSeleccionar.email) cambios.email = email;
    if (phone && phone !== patientContactAlSeleccionar.phone) cambios.phone = phone;
    if (Object.keys(cambios).length === 0) return;

    fetch(`/api/medical-records/patients/${selectedPatientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    })
      .then((r) => { if (!r.ok) throw new Error("patch falló"); })
      .catch(() => {
        toast.error("La cita se agendó, pero no se pudo actualizar el contacto en el expediente");
      });
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
      // Range-mode booking: use range-bookings/instant endpoint
      if (rangeMode && rangeSelection) {
        const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
          method: "POST",
          body: JSON.stringify({
            doctorId,
            date: rangeSelection.date,
            startTime: rangeSelection.startTime,
            serviceId: rangeSelection.serviceId,
            // `patientName` sigue siendo la concatenación — es lo que leen los correos, el
            // agente, la fila y el link de pago. Los dos campos separados van ADEMÁS, para
            // poder crear el expediente después sin adivinar dónde parte el nombre.
            patientName: nombreCompleto(formData),
            patientFirstName: formData.patientFirstName,
            patientLastName: formData.patientLastName,
            patientEmail: formData.patientEmail,
            patientPhone: formData.patientPhone,
            patientWhatsapp: formData.patientWhatsapp || undefined,
            notes: formData.notes || undefined,
            isFirstTime,
            appointmentMode: appointmentMode || undefined,
            patientId: selectedPatientId || undefined,
            // Faltaba SOLO en esta rama (las otras dos sí lo mandaban), y el endpoint
            // siempre lo aceptó (range-bookings/instant lo lee y lo guarda). Sin él,
            // reagendar por rangos producía una cita marcada como NUEVA: el correo al
            // paciente salía como "nueva cita" en vez de "reagendada" (gmail.ts usa este
            // flag para el asunto y el encabezado) y el dato quedaba mal en la BD.
            isRescheduled: !!rescheduleBooking,
          }),
        });
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Error al crear la cita");
          return;
        }

        sincronizarContactoConExpediente();
        // Estaba fijo en false: la pantalla de éxito decía "cita creada" aunque el doctor
        // acabara de reagendar por rangos.
        setWasRescheduled(!!rescheduleBooking);
        setStep("success");
        onSuccess(data.data.id);
        return;
      }

      if (slotMode === "new") {
        const res = await authFetch(`${API_URL}/api/appointments/bookings/instant`, {
          method: "POST",
          body: JSON.stringify({
            doctorId,
            date: newSlotForm.date,
            startTime: newSlotForm.startTime,
            duration: newSlotForm.duration,
            basePrice: 0,
            patientName: nombreCompleto(formData),
            patientEmail: formData.patientEmail,
            patientPhone: formData.patientPhone,
            patientWhatsapp: formData.patientWhatsapp || undefined,
            notes: formData.notes || undefined,
            serviceId: selectedServiceId || undefined,
            isFirstTime,
            appointmentMode: appointmentMode || undefined,
            isRescheduled: !!rescheduleBooking,
            patientId: selectedPatientId || undefined,
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

        sincronizarContactoConExpediente();
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
          patientName: nombreCompleto(formData),
          patientEmail: formData.patientEmail,
          patientPhone: formData.patientPhone,
          patientWhatsapp: formData.patientWhatsapp || undefined,
          notes: formData.notes || undefined,
          serviceId: selectedServiceId || undefined,
          isFirstTime,
          appointmentMode: appointmentMode || undefined,
          isRescheduled: !!rescheduleBooking,
          patientId: selectedPatientId || undefined,
        }),
      });
      const bookingData = await bookingRes.json();

      if (!bookingData.success) {
        setError(bookingData.error || "Error al crear la cita");
        return;
      }

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
                {" · "}{formatTimeOfDay(displaySlot.startTime)} – {formatTimeOfDay(displaySlot.endTime)}
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

        {/* Scrollable content.
            El scroll se reinicia al cambiar de paso: este contenedor conserva su
            scrollTop entre pasos, así que si el doctor bajó eligiendo horario, al pasar a
            los datos del paciente aterrizaba a media forma (sobre "Nombre completo") en vez
            de arriba, en Servicio / Tipo de visita. Quitar el autoFocus del nombre no
            bastaba: eran dos causas distintas del mismo síntoma. */}
        <div ref={cuerpoRef} className="overflow-y-auto flex-1 p-5">

          {step === "slot" && rangeMode && (
            doctorSlug ? (
              <RangeTimePickerStep
                doctorId={doctorId}
                doctorSlug={doctorSlug}
                selectedServiceId={null}
                // Lo YA elegido gana sobre el hueco del calendario. Este árbol se desmonta al
                // pasar al paso 2 y se vuelve a montar con "← Cambiar horario", así que sin
                // esto el regreso reponía en silencio el 16:15 del clic original y tiraba las
                // 17:30 que el doctor acababa de elegir.
                initialDate={rangeSelection?.date ?? preselectedDate}
                initialTime={rangeSelection?.startTime ?? preselectedTime}
                onSelectTime={(sel) => {
                  setRangeSelection(sel);
                  setSelectedServiceId(sel.serviceId);
                  setStep("form");
                }}
              />
            ) : (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            )
          )}

          {step === "slot" && !rangeMode && (
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
                serviceReadOnly={!!rangeSelection}
                isFirstTime={isFirstTime}
                setIsFirstTime={(v) => {
                  setIsFirstTime(v);
                  // Clear patient link when switching away from Recurrente
                  if (v !== false) { setSelectedPatientId(null); setSelectedPatientName(""); }
                }}
                appointmentMode={appointmentMode}
                setAppointmentMode={setAppointmentMode}
                formData={formData}
                setFormData={setFormData}
                error={error}
                fieldSettings={rangeMode || slotMode === "new" ? instantSettings : horariosSettings}
                selectedPatientId={selectedPatientId}
                selectedPatientName={selectedPatientName}
                datosDelExpediente={patientContactAlSeleccionar}
                onSelectPatient={(p) => {
                  setSelectedPatientId(p?.id ?? null);
                  setSelectedPatientName(p ? `${p.firstName} ${p.lastName}` : "");
                  if (p) {
                    const firstName = p.firstName ?? "";
                    const lastName = p.lastName ?? "";
                    const email = p.email ?? "";
                    const phone = p.phone ?? "";
                    setPatientContactAlSeleccionar({ firstName, lastName, email, phone });
                    // Solo se precarga lo que el expediente TIENE: si viene vacío no se
                    // pisa lo que el doctor ya hubiera escrito a mano.
                    setFormData((f) => ({
                      ...f,
                      patientFirstName: firstName || f.patientFirstName,
                      patientLastName: lastName || f.patientLastName,
                      patientEmail: email || f.patientEmail,
                      patientPhone: phone || f.patientPhone,
                    }));
                  } else {
                    // Desvincular = "este NO es ese paciente": se borran nombre y contacto.
                    // Si no, se agendaría con los datos de esa persona pero SIN expediente
                    // ligado — justo la cita huérfana con datos ajenos que este trabajo
                    // intenta dejar de crear.
                    // Borrón parejo a propósito: una versión anterior conservaba lo que el
                    // doctor hubiera editado, y eso hacía que darle a la ✕ dejara campos
                    // llenos. La ✕ tiene que significar lo mismo siempre.
                    // Notas NO se borra: es de la CITA (p. ej. "trae estudios previos"),
                    // no del paciente, y sobrevive a cambiar de persona.
                    setFormData((f) => ({
                      ...f,
                      patientFirstName: "",
                      patientLastName: "",
                      patientEmail: "",
                      patientPhone: "",
                      patientWhatsapp: "",
                    }));
                    setPatientContactAlSeleccionar(null);
                  }
                }}
              />
            </form>
          )}

          {step === "success" && (
            <SuccessStep
              patientName={nombreCompleto(formData)}
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
