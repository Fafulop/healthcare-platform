"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Plus, CalendarPlus, Sparkles, Star, Ban, Clock, CalendarCheck, AlertTriangle, Bell, BellOff, HelpCircle, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { useCalendar } from "./_hooks/useCalendar";
import { useSlots } from "./_hooks/useSlots";
import { useBookings } from "./_hooks/useBookings";
import { AppointmentsCalendar } from "./_components/AppointmentsCalendar";
import { DaySlotPanel } from "./_components/DaySlotPanel";
import { SlotListView } from "./_components/SlotListView";
import { BookingsSection } from "./_components/BookingsSection";
import { CreateSlotsModal } from "./_components/CreateSlotsModal";
import { BookPatientModal } from "./_components/BookPatientModal";
import { AppointmentChatPanel } from "./_components/AppointmentChatPanel";
import { GenerateReviewLinkModal } from "./_components/GenerateReviewLinkModal";
import { PreAppointmentFormModal } from "./_components/PreAppointmentFormModal";
import { BlockRangeModal } from "./_components/BlockRangeModal";
import { BookingFieldSettingsModal } from "./_components/BookingFieldSettingsModal";
import { SlotFiltersBar, type SlotStatusFilter } from "./_components/SlotFiltersBar";
import type { AppointmentSlot } from "./_hooks/useSlots";
import type { Booking } from "./_hooks/useBookings";

export default function AppointmentsV2Page() {
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const doctorId = session?.user?.doctorId as string | undefined;

  // Hooks
  const calendar = useCalendar();
  const slotsHook = useSlots(doctorId, calendar.selectedDate);
  const bookingsHook = useBookings(doctorId);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bookPatientModalOpen, setBookPatientModalOpen] = useState(false);
  const [bookPatientPreSlot, setBookPatientPreSlot] = useState<AppointmentSlot | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const rescheduleBookingRef = useRef<Booking | null>(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [reviewLinkModalOpen, setReviewLinkModalOpen] = useState(false);
  const [blockRangeModalOpen, setBlockRangeModalOpen] = useState(false);
  const [bookingFieldSettingsOpen, setBookingFieldSettingsOpen] = useState(false);
  const [formLinkModalOpen, setFormLinkModalOpen] = useState(false);
  const [formLinkBooking, setFormLinkBooking] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] = useState<SlotStatusFilter>("all");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderOffset, setReminderOffset] = useState(120);
  const [togglingReminder, setTogglingReminder] = useState(false);

  const onRefresh = useCallback(async () => {
    await slotsHook.fetchSlots();
    await bookingsHook.fetchBookings();
  }, [slotsHook, bookingsHook]);

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

  const openBookModal = () => {
    rescheduleBookingRef.current = null;
    setRescheduleBooking(null);
    setBookPatientPreSlot(null);
    setBookPatientModalOpen(true);
  };

  const handleReschedule = useCallback((booking: Booking) => {
    rescheduleBookingRef.current = booking;
    setRescheduleBooking(booking);
    setBookPatientPreSlot(null);
    setBookPatientModalOpen(true);
  }, []);

  const openBookModalWithSlot = (slot: AppointmentSlot) => {
    rescheduleBookingRef.current = null;
    setRescheduleBooking(null);
    setBookPatientPreSlot(slot);
    setBookPatientModalOpen(true);
  };

  // deleteSlot needs bookings for active booking check
  const handleDeleteSlot = (slotId: string) => {
    slotsHook.deleteSlot(slotId, bookingsHook.bookings as any);
  };

  // Booking stats — computed from all bookings (not filtered by date)
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

  if (authStatus === "loading" || (authStatus === "authenticated" && slotsHook.loading)) {
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
            disabled
            title="Próximamente"
            className="flex items-center justify-center gap-2 bg-indigo-300 text-white font-semibold py-2 px-3 sm:px-4 rounded-md text-sm cursor-not-allowed opacity-60"
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>Chat IA</span>
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
            onClick={() => setBlockRangeModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Ban className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Bloquear Periodo</span>
            <span className="sm:hidden">Bloquear</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Crear Horarios
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
            <p className="text-xs text-gray-500">
              {reminderEnabled
                ? "Envía un correo al paciente antes de su cita agendada"
                : "Envía un correo al paciente antes de su cita agendada"}
            </p>
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

      {/* Bulk actions bar (shown when slots selected) */}
      {slotsHook.selectedSlots.size > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
          <span className="text-sm font-medium text-blue-800">
            {slotsHook.selectedSlots.size} horario(s) seleccionado(s)
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => slotsHook.bulkAction("open")}
              className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
            >
              Abrir
            </button>
            <button
              onClick={() => slotsHook.bulkAction("close")}
              className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
            >
              Cerrar
            </button>
            <button
              onClick={() => slotsHook.bulkAction("delete")}
              className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
            >
              Eliminar
            </button>
            <button
              onClick={() => slotsHook.setSelectedSlots(new Set())}
              className="text-xs px-3 py-1.5 rounded bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Bookings section (always visible) */}
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
          slotsHook.fetchSlots();
        }}
        onUpdateExtendedBlock={bookingsHook.updateExtendedBlock}
        onDeleteBooking={async (id, name) => {
          await bookingsHook.deleteBooking(id, name);
          slotsHook.fetchSlots();
        }}
        getStatusColor={bookingsHook.getStatusColor}
        sortColumn={bookingsHook.sortColumn}
        sortDirection={bookingsHook.sortDirection}
        onSort={bookingsHook.toggleSort}
        onOpenFormLinkModal={(booking) => {
          setFormLinkBooking(booking);
          setFormLinkModalOpen(true);
        }}
        onSendEmail={bookingsHook.sendConfirmationEmail}
        onReschedule={handleReschedule}
      />

      {/* Controls card: view toggle + slot filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mt-6 mb-4">
        {/* View toggle */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => calendar.setViewMode("calendar")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              calendar.viewMode === "calendar"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Calendario
          </button>
          <button
            onClick={() => calendar.setViewMode("list")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              calendar.viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Lista
          </button>
        </div>
        {/* Slot status filter — always shown for both views */}
        <div className="pt-3 border-t border-gray-100">
          <SlotFiltersBar value={statusFilter} onChange={setStatusFilter} />
        </div>
      </div>

      {/* Calendar or list view */}
      <div>
        {calendar.viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar — top on mobile, right on desktop */}
            <div className="lg:order-2">
              <AppointmentsCalendar
                selectedDate={calendar.selectedDate}
                onSelectDate={calendar.setSelectedDate}
                calendarDays={calendar.calendarDays}
                year={calendar.year}
                month={calendar.month}
                datesWithSlots={slotsHook.datesWithSlots}
              />
            </div>
            {/* Day panel — bottom on mobile, left on desktop */}
            <div className="lg:order-1">
              <DaySlotPanel
                selectedDate={calendar.selectedDate}
                slots={slotsHook.slotsForSelectedDate}
                statusFilter={statusFilter}
                selectedSlots={slotsHook.selectedSlots}
                onToggleSelection={slotsHook.toggleSlotSelection}
                onToggleAllSlots={slotsHook.toggleAllSlots}
                onToggleOpen={slotsHook.toggleOpenSlot}
                onDelete={handleDeleteSlot}
                onBookWithSlot={openBookModalWithSlot}
                getSlotStatus={slotsHook.getSlotStatus}
              />
            </div>
          </div>
        ) : (
          <SlotListView
            slots={slotsHook.slots}
            listDate={calendar.listDate}
            setListDate={calendar.setListDate}
            showAllSlots={calendar.showAllSlots}
            setShowAllSlots={calendar.setShowAllSlots}
            statusFilter={statusFilter}
            selectedSlots={slotsHook.selectedSlots}
            onToggleSelection={slotsHook.toggleSlotSelection}
            onToggleAllSlots={slotsHook.toggleAllSlots}
            onToggleOpen={slotsHook.toggleOpenSlot}
            onDelete={handleDeleteSlot}
            onBookWithSlot={openBookModalWithSlot}
            onBulkAction={slotsHook.bulkAction}
            getSlotStatus={slotsHook.getSlotStatus}
          />
        )}
      </div>

      {/* Modals */}
      <CreateSlotsModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        doctorId={doctorId}
        clinicLocations={slotsHook.clinicLocations}
        onSuccess={slotsHook.fetchSlots}
      />

      <BookPatientModal
        isOpen={bookPatientModalOpen}
        onClose={() => { setBookPatientModalOpen(false); rescheduleBookingRef.current = null; setRescheduleBooking(null); }}
        doctorId={doctorId}
        clinicLocations={slotsHook.clinicLocations}
        onSuccess={async (newBookingId: string) => {
          const toCancel = rescheduleBookingRef.current;
          if (toCancel) {
            rescheduleBookingRef.current = null;
            setRescheduleBooking(null);
            try {
              const res = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || ""}/api/appointments/bookings/${toCancel.id}`,
                { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }
              );
              const data = await res.json();
              if (!data.success) toast.error("No se pudo cancelar la cita anterior automáticamente");
            } catch {
              toast.error("No se pudo cancelar la cita anterior automáticamente");
            }
            // Confirmation email is sent automatically by the API (sendBookingConfirmationEmail in .finally())
          }
          await onRefresh();
        }}
        preSelectedSlot={bookPatientPreSlot}
        rescheduleBooking={rescheduleBooking}
      />

      <GenerateReviewLinkModal
        isOpen={reviewLinkModalOpen}
        onClose={() => setReviewLinkModalOpen(false)}
      />

      <BlockRangeModal
        isOpen={blockRangeModalOpen}
        onClose={() => setBlockRangeModalOpen(false)}
        doctorId={doctorId}
        onSuccess={slotsHook.fetchSlots}
      />

      <PreAppointmentFormModal
        booking={formLinkBooking}
        isOpen={formLinkModalOpen}
        onClose={() => { setFormLinkModalOpen(false); setFormLinkBooking(null); }}
        onSuccess={bookingsHook.fetchBookings}
      />

      <BookingFieldSettingsModal
        isOpen={bookingFieldSettingsOpen}
        onClose={() => setBookingFieldSettingsOpen(false)}
      />

      <AppointmentChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        onRefresh={onRefresh}
        slots={slotsHook.slots as any}
        bookings={bookingsHook.bookings as any}
      />
    </div>
  );
}
