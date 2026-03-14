"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Plus, CalendarPlus, Sparkles, Star } from "lucide-react";
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
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [reviewLinkModalOpen, setReviewLinkModalOpen] = useState(false);

  const onRefresh = useCallback(async () => {
    await slotsHook.fetchSlots();
    await bookingsHook.fetchBookings();
  }, [slotsHook, bookingsHook]);

  const openBookModal = () => {
    setBookPatientPreSlot(null);
    setBookPatientModalOpen(true);
  };

  const openBookModalWithSlot = (slot: AppointmentSlot) => {
    setBookPatientPreSlot(slot);
    setBookPatientModalOpen(true);
  };

  // deleteSlot needs bookings for active booking check
  const handleDeleteSlot = (slotId: string) => {
    slotsHook.deleteSlot(slotId, bookingsHook.bookings as any);
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
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestión de Citas</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Crea y gestiona tu disponibilidad</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => setReviewLinkModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Star className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Enlace Reseña</span>
              <span className="sm:hidden">Reseña</span>
            </button>
            <button
              onClick={() => setChatPanelOpen(true)}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Chat IA Citas</span>
            </button>
            <button
              onClick={openBookModal}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Agendar Cita</span>
              <span className="sm:hidden">Agendar</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Crear Horarios</span>
              <span className="sm:hidden">Crear</span>
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-2">
          {(["calendar", "list"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => calendar.setViewMode(mode)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-sm sm:text-base ${
                calendar.viewMode === mode
                  ? "bg-blue-50 text-blue-700"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="hidden sm:inline">Vista de </span>
              {mode === "calendar" ? "Calendario" : "Lista"}
            </button>
          ))}
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
        onDeleteBooking={async (id, name) => {
          await bookingsHook.deleteBooking(id, name);
          slotsHook.fetchSlots();
        }}
        getStatusColor={bookingsHook.getStatusColor}
      />

      {/* Calendar or list view */}
      <div className="mt-6">
        {calendar.viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            <AppointmentsCalendar
              selectedDate={calendar.selectedDate}
              onSelectDate={calendar.setSelectedDate}
              calendarDays={calendar.calendarDays}
              year={calendar.year}
              month={calendar.month}
              datesWithSlots={slotsHook.datesWithSlots}
            />
            <DaySlotPanel
              selectedDate={calendar.selectedDate}
              slots={slotsHook.slotsForSelectedDate}
              selectedSlots={slotsHook.selectedSlots}
              onToggleSelection={slotsHook.toggleSlotSelection}
              onToggleAllSlots={slotsHook.toggleAllSlots}
              onToggleOpen={slotsHook.toggleOpenSlot}
              onDelete={handleDeleteSlot}
              onBookWithSlot={openBookModalWithSlot}
              getSlotStatus={slotsHook.getSlotStatus}
            />
          </div>
        ) : (
          <SlotListView
            slots={slotsHook.slots}
            listDate={calendar.listDate}
            setListDate={calendar.setListDate}
            showAllSlots={calendar.showAllSlots}
            setShowAllSlots={calendar.setShowAllSlots}
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
        onClose={() => setBookPatientModalOpen(false)}
        doctorId={doctorId}
        clinicLocations={slotsHook.clinicLocations}
        onSuccess={onRefresh}
        preSelectedSlot={bookPatientPreSlot}
      />

      <GenerateReviewLinkModal
        isOpen={reviewLinkModalOpen}
        onClose={() => setReviewLinkModalOpen(false)}
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
