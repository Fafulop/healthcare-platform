"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Plus, CalendarPlus, Clock, CalendarCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { useCalendar } from "../_hooks/useCalendar";
import { useRanges } from "../_hooks/useRanges";
import { useBookings } from "../_hooks/useBookings";
import { AppointmentsCalendar } from "../_components/AppointmentsCalendar";
import { DayTimelinePanel } from "../_components/DayTimelinePanel";
import { CreateRangeModal } from "../_components/CreateRangeModal";
import { BookPatientModal } from "../_components/BookPatientModal";
import { BookingsSection } from "../_components/BookingsSection";
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
  const [bookPatientModalOpen, setBookPatientModalOpen] = useState(false);

  const onRefresh = useCallback(async () => {
    await rangesHook.fetchRanges();
    await bookingsHook.fetchBookings();
  }, [rangesHook, bookingsHook]);

  const openBookModal = () => {
    setBookPatientModalOpen(true);
  };

  const handleBookInGap = (date: string, startTime: string) => {
    // Open the book patient modal — the doctor can fill details from there
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
          <p className="mt-4 text-gray-600 font-medium">Cargando citas (v2)...</p>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Gestión de Citas <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2">v2 Rangos</span>
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Disponibilidad basada en rangos de horarios</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link
            href="/appointments"
            className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            ← Vista clásica
          </Link>
          <button
            onClick={openBookModal}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <CalendarPlus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Agendar Cita</span>
            <span className="sm:hidden">Agendar</span>
          </button>
          <button
            onClick={() => setShowCreateRangeModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Crear Rango
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
        }}
        onUpdatePrice={bookingsHook.updateBookingPrice}
        onUpdateExtendedBlock={bookingsHook.updateExtendedBlock}
        onUpdatePatientLink={bookingsHook.updatePatientLink}
        onDeleteBooking={async (id, name) => {
          await bookingsHook.deleteBooking(id, name);
        }}
        getStatusColor={bookingsHook.getStatusColor}
        sortColumn={bookingsHook.sortColumn}
        sortDirection={bookingsHook.sortDirection}
        onSort={bookingsHook.toggleSort}
        onOpenFormLinkModal={() => {}}
        onDeleteFormLink={bookingsHook.deleteFormLink}
        onSendEmail={bookingsHook.sendConfirmationEmail}
        onReschedule={() => {}}
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

      <BookPatientModal
        isOpen={bookPatientModalOpen}
        onClose={() => setBookPatientModalOpen(false)}
        doctorId={doctorId}
        clinicLocations={clinicLocations}
        onSuccess={async () => {
          await onRefresh();
        }}
      />
    </div>
  );
}
