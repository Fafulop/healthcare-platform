"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Plus, CalendarPlus, Clock, CalendarCheck, AlertTriangle, Trash2, Ban, Star, Bell, BellOff, HelpCircle, SlidersHorizontal, ClipboardList } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { useCalendar } from "../_hooks/useCalendar";
import { useRanges } from "../_hooks/useRanges";
import { useBookings } from "../_hooks/useBookings";
import { useBlockedTimes } from "../_hooks/useBlockedTimes";
import { AppointmentsCalendar } from "../_components/AppointmentsCalendar";
import { DayTimelinePanel } from "../_components/DayTimelinePanel";
import { CreateRangeModal } from "../_components/CreateRangeModal";
import { BookPatientModal } from "../_components/BookPatientModal";
import { BookingsSection } from "../_components/BookingsSection";
import { DeleteRangesModal } from "../_components/DeleteRangesModal";
import { BlockTimeModal } from "../_components/BlockTimeModal";
import { PreAppointmentFormModal } from "../_components/PreAppointmentFormModal";
import { GenerateReviewLinkModal } from "../_components/GenerateReviewLinkModal";
import { StandaloneFormularioModal } from "../_components/StandaloneFormularioModal";
import { BookingFieldSettingsModal } from "../_components/BookingFieldSettingsModal";
import type { Booking } from "../_hooks/useBookings";
import type { ClinicLocation } from "../_hooks/useSlots";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AppointmentsV2RangePage() {
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const doctorId = session?.user?.doctorId as string | undefined;
  const { doctorProfile } = useDoctorProfile();

  // Hooks
  const calendar = useCalendar();
  const rangesHook = useRanges(doctorId, calendar.selectedDate);
  const bookingsHook = useBookings(doctorId);
  const blockedTimesHook = useBlockedTimes(doctorId, calendar.selectedDate);

  // Clinic locations (fetched independently since we don't use useSlots)
  const [clinicLocations, setClinicLocations] = useState<ClinicLocation[]>([]);
  useEffect(() => {
    const slug = doctorProfile?.slug;
    if (!slug) return;
    fetch(`${API_URL}/api/doctors/${slug}/locations`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setClinicLocations(d.data);
      })
      .catch(() => {});
  }, [doctorProfile?.slug]);

  // Modal state
  const [showCreateRangeModal, setShowCreateRangeModal] = useState(false);
  const [showDeleteRangesModal, setShowDeleteRangesModal] = useState(false);
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [bookPatientModalOpen, setBookPatientModalOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const rescheduleBookingRef = useRef<Booking | null>(null);
  const [formLinkModalOpen, setFormLinkModalOpen] = useState(false);
  const [formLinkBooking, setFormLinkBooking] = useState<Booking | null>(null);
  const [reviewLinkModalOpen, setReviewLinkModalOpen] = useState(false);
  const [standaloneFormModalOpen, setStandaloneFormModalOpen] = useState(false);
  const [bookingFieldSettingsOpen, setBookingFieldSettingsOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderOffset, setReminderOffset] = useState(120);
  const [togglingReminder, setTogglingReminder] = useState(false);

  // Fetch reminder setting on mount
  useEffect(() => {
    if (!doctorId) return;
    authFetch("/api/doctor/reminders")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setReminderEnabled(d.reminderEmailEnabled);
          if (d.reminderEmailOffsetMinutes) setReminderOffset(d.reminderEmailOffsetMinutes);
        }
      })
      .catch(() => {});
  }, [doctorId]);

  const handleToggleReminder = useCallback(async () => {
    setTogglingReminder(true);
    const next = !reminderEnabled;
    try {
      const res = await authFetch("/api/doctor/reminders", {
        method: "PATCH",
        body: JSON.stringify({ reminderEmailEnabled: next }),
      });
      const data = await res.json();
      if (data.success) setReminderEnabled(data.reminderEmailEnabled);
    } catch { /* keep current state */ }
    setTogglingReminder(false);
  }, [reminderEnabled]);

  const handleOffsetChange = useCallback(async (minutes: number) => {
    setReminderOffset(minutes);
    try {
      await authFetch("/api/doctor/reminders", {
        method: "PATCH",
        body: JSON.stringify({ reminderEmailOffsetMinutes: minutes }),
      });
    } catch { /* keep current state */ }
  }, []);

  const onRefresh = useCallback(async () => {
    await rangesHook.fetchRanges();
    await bookingsHook.fetchBookings();
    await blockedTimesHook.fetchBlockedTimes();
  }, [rangesHook, bookingsHook, blockedTimesHook]);

  const openBookModal = () => {
    rescheduleBookingRef.current = null;
    setRescheduleBooking(null);
    setBookPatientModalOpen(true);
  };

  const handleReschedule = useCallback((booking: Booking) => {
    rescheduleBookingRef.current = booking;
    setRescheduleBooking(booking);
    setBookPatientModalOpen(true);
  }, []);

  const handleBookInGap = (date: string, startTime: string) => {
    toast.success(`Agendar cita: ${date} a las ${startTime}`);
    setBookPatientModalOpen(true);
  };

  // Booking stats
  const nowMx = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" });
  const isExpiredBooking = (b: Booking) => {
    if (b.status !== "PENDING" && b.status !== "CONFIRMED") return false;
    const date = (b.slot?.date ?? b.date ?? "").split("T")[0];
    const endTime = b.slot?.endTime ?? b.endTime;
    if (!date || !endTime) return false;
    return `${date} ${endTime}:00` < nowMx;
  };
  const bookingStats = {
    pending: bookingsHook.bookings.filter(b => b.status === "PENDING" && !isExpiredBooking(b)).length,
    confirmed: bookingsHook.bookings.filter(b => b.status === "CONFIRMED" && !isExpiredBooking(b)).length,
    expired: bookingsHook.bookings.filter(b => isExpiredBooking(b)).length,
  };

  if (authStatus === "loading" || (authStatus === "authenticated" && rangesHook.loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando citas...</p>
        </div>
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md">
          <p className="text-red-600 font-semibold">No hay perfil de médico vinculado a tu cuenta.</p>
          <p className="text-gray-600 text-sm mt-2">Por favor contacta a un administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestión de Citas</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Crea y gestiona tu disponibilidad</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <button
            onClick={() => setReviewLinkModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Star className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Enlace Reseña</span>
            <span className="sm:hidden">Reseña</span>
          </button>
          <button
            onClick={() => setStandaloneFormModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <ClipboardList className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Formulario libre</span>
            <span className="sm:hidden">Formulario</span>
          </button>
          <button
            onClick={openBookModal}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <CalendarPlus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Agendar Cita</span>
            <span className="sm:hidden">Agendar</span>
          </button>
          <button
            onClick={() => setShowDeleteRangesModal(true)}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Eliminar Rangos</span>
            <span className="sm:hidden">Eliminar</span>
          </button>
          <button
            onClick={() => setShowBlockTimeModal(true)}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Ban className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Bloquear</span>
          </button>
          <button
            onClick={() => setShowCreateRangeModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Crear Rango
          </button>
          <button
            onClick={() => setBookingFieldSettingsOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Campos de Cita</span>
            <span className="sm:hidden">Campos</span>
          </button>
          <Link
            href="/dashboard/ayuda?tab=citas"
            title="Ver guía de Citas"
            className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium py-2 px-3 rounded-md transition-colors text-sm"
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Ayuda</span>
          </Link>
        </div>
      </div>

      {/* Reminder email toggle */}
      <div className="bg-white rounded-lg shadow px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {reminderEnabled
            ? <Bell className="w-4 h-4 text-blue-600 shrink-0" />
            : <BellOff className="w-4 h-4 text-gray-400 shrink-0" />
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Recordatorio automático por correo</p>
            <p className="text-xs text-gray-500">Envía un correo al paciente antes de su cita agendada</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {reminderEnabled && (
            <select
              value={reminderOffset}
              onChange={(e) => handleOffsetChange(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value={15}>15 min antes</option>
              <option value={30}>30 min antes</option>
              <option value={60}>1 hora antes</option>
              <option value={120}>2 horas antes</option>
              <option value={240}>4 horas antes</option>
              <option value={1440}>1 día antes</option>
            </select>
          )}
          <button
            onClick={handleToggleReminder}
            disabled={togglingReminder}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
              reminderEnabled ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              reminderEnabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Booking stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Pendientes</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{bookingStats.pending}</p>
            </div>
            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Agendadas</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{bookingStats.confirmed}</p>
            </div>
            <CalendarCheck className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Vencidas</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{bookingStats.expired}</p>
            </div>
            <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Bookings section */}
      <BookingsSection
        bookings={bookingsHook.bookings as Booking[]}
        filteredBookings={bookingsHook.filteredBookings as Booking[]}
        bookingsCollapsed={bookingsHook.bookingsCollapsed}
        setBookingsCollapsed={bookingsHook.setBookingsCollapsed}
        bookingFilterDate={bookingsHook.bookingFilterDate}
        setBookingFilterDate={bookingsHook.setBookingFilterDate}
        bookingFilterPatient={bookingsHook.bookingFilterPatient}
        setBookingFilterPatient={bookingsHook.setBookingFilterPatient}
        bookingFilterStatus={bookingsHook.bookingFilterStatus}
        setBookingFilterStatus={bookingsHook.setBookingFilterStatus}
        shiftBookingFilterDate={bookingsHook.shiftBookingFilterDate}
        onUpdateStatus={async (id, status) => {
          await bookingsHook.updateBookingStatus(id, status);
          rangesHook.fetchRanges();
        }}
        onCompleteBooking={async (id, price, formaDePago) => {
          await bookingsHook.completeBooking(id, price, formaDePago);
          rangesHook.fetchRanges();
        }}
        onUpdatePrice={bookingsHook.updateBookingPrice}
        onUpdateExtendedBlock={bookingsHook.updateExtendedBlock}
        onUpdatePatientLink={bookingsHook.updatePatientLink}
        onDeleteBooking={async (id, name) => {
          await bookingsHook.deleteBooking(id, name);
          rangesHook.fetchRanges();
        }}
        getStatusColor={bookingsHook.getStatusColor}
        sortColumn={bookingsHook.sortColumn}
        sortDirection={bookingsHook.sortDirection}
        onSort={bookingsHook.toggleSort}
        onOpenFormLinkModal={(booking) => {
          setFormLinkBooking(booking);
          setFormLinkModalOpen(true);
        }}
        onDeleteFormLink={bookingsHook.deleteFormLink}
        onSendEmail={bookingsHook.sendConfirmationEmail}
        onReschedule={handleReschedule}
      />

      {/* Calendar + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Calendar */}
        <div className="lg:order-2">
          <AppointmentsCalendar
            selectedDate={calendar.selectedDate}
            onSelectDate={calendar.setSelectedDate}
            calendarDays={calendar.calendarDays}
            year={calendar.year}
            month={calendar.month}
            datesWithSlots={rangesHook.datesWithRanges}
          />
        </div>

        {/* Day timeline panel */}
        <div className="lg:order-1">
          <DayTimelinePanel
            selectedDate={calendar.selectedDate}
            ranges={rangesHook.rangesForSelectedDate}
            bookings={bookingsHook.bookings as any}
            blockedTimes={blockedTimesHook.blockedTimesForSelectedDate}
            onDeleteRange={rangesHook.deleteRange}
            onBookInGap={handleBookInGap}
          />
        </div>
      </div>

      {/* Modals */}
      <CreateRangeModal
        isOpen={showCreateRangeModal}
        onClose={() => setShowCreateRangeModal(false)}
        doctorId={doctorId}
        clinicLocations={clinicLocations}
        defaultIntervalMinutes={30}
        onSuccess={rangesHook.fetchRanges}
      />

      <DeleteRangesModal
        isOpen={showDeleteRangesModal}
        onClose={() => setShowDeleteRangesModal(false)}
        bulkDeleteRanges={rangesHook.bulkDeleteRanges}
        onSuccess={async () => {
          await rangesHook.fetchRanges();
          await blockedTimesHook.fetchBlockedTimes();
        }}
      />

      <BlockTimeModal
        isOpen={showBlockTimeModal}
        onClose={() => setShowBlockTimeModal(false)}
        blockTime={blockedTimesHook.blockTime}
        unblockTimes={blockedTimesHook.unblockTimes}
        blockedTimes={blockedTimesHook.blockedTimes}
        onSuccess={blockedTimesHook.fetchBlockedTimes}
      />

      <BookPatientModal
        isOpen={bookPatientModalOpen}
        onClose={() => { setBookPatientModalOpen(false); rescheduleBookingRef.current = null; setRescheduleBooking(null); }}
        doctorId={doctorId}
        clinicLocations={clinicLocations}
        rangeMode
        doctorSlug={doctorProfile?.slug}
        onSuccess={async () => {
          const toCancel = rescheduleBookingRef.current;
          if (toCancel) {
            rescheduleBookingRef.current = null;
            setRescheduleBooking(null);
            try {
              const res = await authFetch(
                `${API_URL}/api/appointments/bookings/${toCancel.id}`,
                { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }
              );
              const data = await res.json();
              if (!data.success) toast.error("No se pudo cancelar la cita anterior automáticamente");
            } catch {
              toast.error("No se pudo cancelar la cita anterior automáticamente");
            }
          }
          await onRefresh();
        }}
        rescheduleBooking={rescheduleBooking}
      />
      <PreAppointmentFormModal
        booking={formLinkBooking}
        isOpen={formLinkModalOpen}
        onClose={() => { setFormLinkModalOpen(false); setFormLinkBooking(null); }}
        onSuccess={bookingsHook.fetchBookings}
      />

      <GenerateReviewLinkModal
        isOpen={reviewLinkModalOpen}
        onClose={() => setReviewLinkModalOpen(false)}
      />

      <StandaloneFormularioModal
        isOpen={standaloneFormModalOpen}
        onClose={() => setStandaloneFormModalOpen(false)}
      />

      <BookingFieldSettingsModal
        isOpen={bookingFieldSettingsOpen}
        onClose={() => setBookingFieldSettingsOpen(false)}
      />
    </div>
  );
}
