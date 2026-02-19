"use client";

import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, DollarSign, Plus, Trash2, Lock, Unlock, Loader2, CheckSquare, Square, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Mic, ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import CreateSlotsModal from "./CreateSlotsModal";
import BookPatientModal from "./BookPatientModal";
import { authFetch } from "@/lib/auth-fetch";
import {
  VoiceRecordingModal,
  VoiceChatSidebar,
} from '@/components/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceAppointmentSlotsData, VoiceStructuredData } from '@/types/voice-assistant';

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

// Helper function to get local date string (fixes timezone issues)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format date string for display (fixes timezone issues)
function formatDateString(dateStr: string, locale: string = 'es-MX', options?: Intl.DateTimeFormatOptions): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString(locale, options);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
  discount: number | null;
  discountType: string | null;
  finalPrice: number;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
}

interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string | null;
  status: string;
  finalPrice: number;
  confirmationCode: string;
  createdAt: string;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export default function AppointmentsPage() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [bookingDate, setBookingDate] = useState<string>(getLocalDateString(new Date()));
  const [listDate, setListDate] = useState<string>(getLocalDateString(new Date()));
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [showAllBookings, setShowAllBookings] = useState(false);

  // Book patient modal state
  const [bookPatientModalOpen, setBookPatientModalOpen] = useState(false);
  const [bookPatientPreSlot, setBookPatientPreSlot] = useState<AppointmentSlot | null>(null);

  const openBookModal = () => {
    setBookPatientPreSlot(null);
    setBookPatientModalOpen(true);
  };

  const openBookModalWithSlot = (slot: AppointmentSlot) => {
    setBookPatientPreSlot(slot);
    setBookPatientModalOpen(true);
  };

  // Voice assistant state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);
  const [voiceFormData, setVoiceFormData] = useState<any | undefined>(undefined);

  // Get doctor ID from session
  const doctorId = session?.user?.doctorId;

  // Helper to map voice data to CreateSlotsModal form data
  const mapVoiceToFormData = useCallback((voiceData: VoiceAppointmentSlotsData) => {
    return {
      startDate: voiceData.startDate || '',
      endDate: voiceData.endDate || '',
      daysOfWeek: voiceData.daysOfWeek || [1, 2, 3, 4, 5], // Default Mon-Fri
      startTime: voiceData.startTime || '09:00',
      endTime: voiceData.endTime || '17:00',
      duration: voiceData.duration || 60,
      breakStart: voiceData.breakStart || '12:00',
      breakEnd: voiceData.breakEnd || '13:00',
      hasBreak: Boolean(voiceData.breakStart && voiceData.breakEnd),
      basePrice: voiceData.basePrice?.toString() || '',
      discount: voiceData.discount?.toString() || '',
      discountType: voiceData.discountType || 'PERCENTAGE',
      hasDiscount: Boolean(voiceData.discount),
    };
  }, []);

  // Handle voice recording modal completion - transition to sidebar
  const handleVoiceModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoiceAppointmentSlotsData;

    // Calculate extracted fields
    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceAppointmentSlotsData] != null &&
           voiceData[k as keyof VoiceAppointmentSlotsData] !== '' &&
           !(Array.isArray(voiceData[k as keyof VoiceAppointmentSlotsData]) &&
             (voiceData[k as keyof VoiceAppointmentSlotsData] as any[]).length === 0)
    );

    // Prepare initial data for sidebar
    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    // Close modal, set initial data, and open sidebar
    setVoiceModalOpen(false);
    setSidebarInitialData(initialData);
    setVoiceSidebarOpen(true);
  }, []);

  // Handle voice chat confirm - populate CreateSlotsModal
  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    const voiceData = data as VoiceAppointmentSlotsData;

    // Map voice data to form data
    const mappedData = mapVoiceToFormData(voiceData);
    setVoiceFormData(mappedData);

    // Close sidebar and open CreateSlotsModal with pre-filled data
    setVoiceSidebarOpen(false);
    setSidebarInitialData(undefined);
    setShowCreateModal(true);
  }, [mapVoiceToFormData]);

  // Load voice data from sessionStorage (hub widget flow)
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceAppointmentData');
      if (stored) {
        try {
          const { data } = JSON.parse(stored);
          const voiceData = data as VoiceAppointmentSlotsData;
          const mappedData = mapVoiceToFormData(voiceData);
          setVoiceFormData(mappedData);
          setShowCreateModal(true);
          sessionStorage.removeItem('voiceAppointmentData');
        } catch (e) {
          console.error('Error parsing voice appointment data:', e);
        }
      }
    }
  }, [searchParams, mapVoiceToFormData]);

  useEffect(() => {
    if (doctorId) {
      fetchSlots();
      fetchBookings();
    }
  }, [doctorId, selectedDate]);

  const fetchSlots = async () => {
    if (!doctorId) return;

    setLoading(true);
    try {
      // Fetch slots for the current month
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const startDate = new Date(startStr + 'T00:00:00Z').toISOString();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const endDate = new Date(endStr + 'T23:59:59Z').toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setSlots(data.data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!doctorId) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings?doctorId=${doctorId}`
      );
      const data = await response.json();

      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const deleteSlot = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    const activeBookings = bookings.filter(
      b => b.slot && slots.find(s => s.id === slotId) &&
        b.status !== "CANCELLED" && b.status !== "COMPLETED" && b.status !== "NO_SHOW"
    ).filter(b => {
      // Match bookings to this slot by date+time
      const slotData = slots.find(s => s.id === slotId);
      if (!slotData) return false;
      return b.slot.date.split('T')[0] === slotData.date.split('T')[0] &&
        b.slot.startTime === slotData.startTime &&
        b.slot.endTime === slotData.endTime;
    });

    if (slot && slot.currentBookings > 0) {
      if (!confirm(`Este horario tiene ${slot.currentBookings} cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?`)) return;

      // Cancel all active bookings first
      for (const booking of activeBookings) {
        try {
          await authFetch(
            `${API_URL}/api/appointments/bookings/${booking.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({ status: "CANCELLED" }),
            }
          );
        } catch (error) {
          console.error("Error cancelling booking:", error);
        }
      }
    } else {
      if (!confirm("¿Estás seguro de que quieres eliminar este horario?")) return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        alert("Horario eliminado exitosamente");
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || "Error al eliminar horario");
      }
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("Error al eliminar horario");
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    if (newStatus === "CANCELLED" && !confirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await response.json();

      if (data.success) {
        alert(data.message || "Estado actualizado exitosamente");
        fetchBookings();
        fetchSlots();
      } else {
        alert(data.error || "Error al actualizar estado");
      }
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Error al actualizar estado");
    }
  };

  const toggleOpenSlot = async (slotId: string, currentIsOpen: boolean) => {
    const slot = slots.find(s => s.id === slotId);
    const newIsOpen = !currentIsOpen;

    // Prevent closing slots with active bookings
    if (slot && !newIsOpen && slot.currentBookings > 0) {
      alert(`No se puede cerrar este horario porque tiene ${slot.currentBookings} reserva(s) activa(s). Por favor cancela las reservas primero.`);
      return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isOpen: newIsOpen }),
        }
      );
      const data = await response.json();

      if (data.success) {
        alert(data.message);
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || "Error al actualizar horario");
      }
    } catch (error) {
      console.error("Error updating slot:", error);
      alert("Error al actualizar horario");
    }
  };

  const bulkAction = async (action: "delete" | "close" | "open") => {
    const slotIds = Array.from(selectedSlots);

    if (slotIds.length === 0) {
      alert("Por favor selecciona horarios primero");
      return;
    }

    // Check if trying to close slots with bookings
    if (action === "close") {
      const selectedSlotsData = slots.filter(s => slotIds.includes(s.id));
      const slotsWithBookings = selectedSlotsData.filter(s => s.currentBookings > 0);

      if (slotsWithBookings.length > 0) {
        alert(`No se pueden cerrar ${slotsWithBookings.length} horario(s) porque tienen reservas activas. Por favor cancela las reservas primero o deselecciona esos horarios.`);
        return;
      }
    }

    const actionText = action === "delete" ? "eliminar" : action === "close" ? "cerrar" : "abrir";
    if (!confirm(`¿Estás seguro de que quieres ${actionText} ${slotIds.length} horario(s)?`)) {
      return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ slotIds, action }),
        }
      );
      const data = await response.json();

      if (data.success) {
        alert(`${data.count} horario(s) ${actionText === "eliminar" ? "eliminados" : actionText === "cerrar" ? "cerrados" : "abiertos"} exitosamente`);
        setSelectedSlots(new Set());
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || `Error al ${actionText} horarios`);
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      alert(`Error al ${actionText} horarios`);
    }
  };

  const toggleSlotSelection = (slotId: string) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId);
    } else {
      newSelected.add(slotId);
    }
    setSelectedSlots(newSelected);
  };

  const toggleAllSlots = () => {
    const visibleSlots = viewMode === "list" ? visibleListSlots : slots;
    const allSelected = visibleSlots.every(s => selectedSlots.has(s.id));
    if (allSelected) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(visibleSlots.map(s => s.id)));
    }
  };

  // Helper to get slot status display
  const getSlotStatus = (slot: AppointmentSlot): { label: string; color: string } => {
    const isFull = slot.currentBookings >= slot.maxBookings;

    if (!slot.isOpen) {
      return { label: "Cerrado", color: "bg-gray-200 text-gray-700" };
    }

    if (isFull) {
      return { label: "Lleno", color: "bg-blue-100 text-blue-700" };
    }

    return { label: "Disponible", color: "bg-green-100 text-green-700" };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border-red-200";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <CheckCircle className="w-4 h-4" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />;
      case "PENDING":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Get slots for selected date
  const selectedDateStr = getLocalDateString(selectedDate);
  const slotsForSelectedDate = slots.filter(
    (slot) => slot.date.split('T')[0] === selectedDateStr
  );

  // Filter bookings by selected booking date
  const bookingsForDate = bookings.filter((booking) => {
    const slotDate = booking.slot.date.split('T')[0];
    return slotDate === bookingDate;
  });
  const filteredBookings = showAllBookings ? bookings : bookingsForDate;

  // Filter slots for list view by selected list date
  const slotsForListDate = slots.filter(
    (slot) => slot.date.split('T')[0] === listDate
  );
  const visibleListSlots = showAllSlots ? slots : slotsForListDate;

  // Get dates with slots for calendar highlighting
  const datesWithSlots = new Set(
    slots.map((slot) => slot.date.split('T')[0])
  );

  // Calendar days for current month
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  if (status === "loading" || loading) {
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
            {/* Voice Assistant Button */}
            <button
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Chat IA</span>
              <span className="sm:hidden">Chat IA</span>
            </button>
            {/* Book Patient Button */}
            <button
              onClick={openBookModal}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Agendar Cita</span>
              <span className="sm:hidden">Agendar</span>
            </button>
            {/* Manual Create Button */}
            <button
              onClick={() => {
                setVoiceFormData(undefined); // Clear voice data
                setShowCreateModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Crear Horarios</span>
              <span className="sm:hidden">Crear</span>
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-sm sm:text-base ${
              viewMode === "calendar"
                ? "bg-blue-50 text-blue-700"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="hidden sm:inline">Vista de </span>Calendario
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-sm sm:text-base ${
              viewMode === "list"
                ? "bg-blue-50 text-blue-700"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="hidden sm:inline">Vista de </span>Lista
          </button>
        </div>
      </div>

      {/* Citas Reservadas */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            {showAllBookings ? "Todas las Citas" : "Citas Reservadas"}
          </h2>
          <div className="flex items-center gap-2">
            {!showAllBookings && (
              <>
                <button
                  onClick={() => {
                    const d = new Date(bookingDate + 'T12:00:00');
                    d.setDate(d.getDate() - 1);
                    setBookingDate(getLocalDateString(d));
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    const d = new Date(bookingDate + 'T12:00:00');
                    d.setDate(d.getDate() + 1);
                    setBookingDate(getLocalDateString(d));
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {bookingDate !== getLocalDateString(new Date()) && (
                  <button
                    onClick={() => setBookingDate(getLocalDateString(new Date()))}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    Hoy
                  </button>
                )}
              </>
            )}
            <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
              {filteredBookings.length} cita{filteredBookings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowAllBookings(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showAllBookings
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {showAllBookings ? "Por dia" : "Ver todos"}
            </button>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{showAllBookings ? "No hay citas reservadas" : `Sin citas para ${formatDateString(bookingDate, "es-MX", { weekday: "long", day: "numeric", month: "long" })}`}</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block sm:hidden space-y-3">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{booking.patientName}</p>
                      <p className="text-xs text-gray-600">
                        {formatDateString(booking.slot.date, "es-MX", {
                          month: "short",
                          day: "numeric",
                        })} · {booking.slot.startTime}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {getStatusIcon(booking.status)}
                      {booking.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {booking.patientPhone}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-gray-900">
                      <DollarSign className="w-3 h-3" />
                      {booking.finalPrice}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                      {booking.confirmationCode}
                    </code>
                    <div className="flex gap-1">
                      {booking.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "CONFIRMED")}
                            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] font-medium"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "CANCELLED")}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-medium"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      {booking.status === "CONFIRMED" && (
                        <>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "COMPLETED")}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-medium"
                          >
                            Completada
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "NO_SHOW")}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-medium"
                          >
                            No asistió
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "CANCELLED")}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-medium"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha y Hora</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Paciente</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contacto</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Precio</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Código</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatDateString(booking.slot.date, "es-MX", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-gray-600">
                              {booking.slot.startTime} - {booking.slot.endTime}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{booking.patientName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {booking.patientEmail}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {booking.patientPhone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {getStatusIcon(booking.status)}
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 font-semibold text-gray-900">
                          <DollarSign className="w-4 h-4" />
                          {booking.finalPrice}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {booking.confirmationCode}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {booking.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateBookingStatus(booking.id, "CONFIRMED")}
                                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, "CANCELLED")}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {booking.status === "CONFIRMED" && (
                            <>
                              <button
                                onClick={() => updateBookingStatus(booking.id, "COMPLETED")}
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium"
                              >
                                Completada
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, "NO_SHOW")}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                              >
                                No asistió
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, "CANCELLED")}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 capitalize">
                {selectedDate.toLocaleDateString("es-MX", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1)
                    )
                  }
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
                >
                  <span className="hidden sm:inline">‹ </span>Ant.
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
                >
                  Hoy
                </button>
                <button
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1)
                    )
                  }
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
                >
                  Sig.<span className="hidden sm:inline"> ›</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => (
                <div
                  key={`${day}-${idx}`}
                  className="text-center font-semibold text-gray-600 text-xs sm:text-sm py-1 sm:py-2"
                >
                  <span className="sm:hidden">{day}</span>
                  <span className="hidden sm:inline">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][idx]}</span>
                </div>
              ))}

              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dateStr = getLocalDateString(new Date(year, month, day));
                const hasSlots = datesWithSlots.has(dateStr);
                const isSelected = dateStr === selectedDateStr;
                const isToday =
                  dateStr === getLocalDateString(new Date());

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`aspect-square p-1 sm:p-2 rounded-lg text-center transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white font-bold"
                        : isToday
                        ? "bg-blue-100 text-blue-700 font-semibold"
                        : hasSlots
                        ? "bg-blue-200 text-blue-900 font-medium hover:bg-blue-300"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-xs sm:text-sm">{day}</div>
                    {hasSlots && !isSelected && (
                      <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-0.5 sm:mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horarios para Fecha Seleccionada */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm sm:text-base capitalize">
              {selectedDate.toLocaleDateString("es-MX", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>

            {slotsForSelectedDate.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Sin horarios para esta fecha</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-72 sm:max-h-96 overflow-y-auto">
                {slotsForSelectedDate.map((slot) => {
                  const slotStatus = getSlotStatus(slot);
                  return (
                  <div
                    key={slot.id}
                    className={`p-2 sm:p-3 rounded-lg border-2 ${
                      !slot.isOpen
                        ? "bg-gray-100 border-gray-300"
                        : slot.currentBookings >= slot.maxBookings
                        ? "bg-blue-50 border-blue-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium ${slotStatus.color}`}>
                        {slotStatus.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                      <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="font-medium">${slot.finalPrice}</span>
                      {slot.discount && (
                        <span className="text-[10px] sm:text-xs text-blue-600">
                          ({slot.discountType === "PERCENTAGE" ? `${slot.discount}%` : `$${slot.discount}`} off)
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1 sm:gap-2 mt-1 sm:mt-2">
                      {slot.isOpen && slot.currentBookings < slot.maxBookings && (
                        <button
                          onClick={() => openBookModalWithSlot(slot)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] sm:text-xs"
                          title="Agendar cita para paciente"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          <span className="hidden sm:inline">Agendar</span>
                        </button>
                      )}
                      <button
                        onClick={() => toggleOpenSlot(slot.id, slot.isOpen)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] sm:text-xs"
                        title={slot.isOpen ? "Cerrar para Reservas" : "Abrir para Reservas"}
                      >
                        {slot.isOpen ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] sm:text-xs"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vista de Lista */}
      {viewMode === "list" && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Header with day navigator */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {showAllSlots ? "Todos los Horarios" : "Horarios del Dia"}
              </h2>
              <div className="flex items-center gap-1.5">
                {!showAllSlots && (
                  <>
                    <button
                      onClick={() => {
                        setListDate(prev => {
                          const d = new Date(prev + 'T12:00:00');
                          d.setDate(d.getDate() - 1);
                          return getLocalDateString(d);
                        });
                        setSelectedSlots(new Set());
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="date"
                      value={listDate}
                      onChange={(e) => {
                        setListDate(e.target.value);
                        setSelectedSlots(new Set());
                      }}
                      className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
                    />
                    <button
                      onClick={() => {
                        setListDate(prev => {
                          const d = new Date(prev + 'T12:00:00');
                          d.setDate(d.getDate() + 1);
                          return getLocalDateString(d);
                        });
                        setSelectedSlots(new Set());
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {listDate !== getLocalDateString(new Date()) && (
                      <button
                        onClick={() => {
                          setListDate(getLocalDateString(new Date()));
                          setSelectedSlots(new Set());
                        }}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Hoy
                      </button>
                    )}
                  </>
                )}
                <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
                  {visibleListSlots.length} horario{visibleListSlots.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    setShowAllSlots(prev => !prev);
                    setSelectedSlots(new Set());
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    showAllSlots
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {showAllSlots ? "Por dia" : "Ver todos"}
                </button>
              </div>
            </div>

            {!showAllSlots && (
              <p className="text-sm text-gray-500 capitalize">
                {formatDateString(listDate, "es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}

            {/* Barra de Acciones Masivas */}
            {selectedSlots.size > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-blue-50 border border-blue-200 rounded-lg p-2 sm:px-4 sm:py-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700 text-center sm:text-left">
                  {selectedSlots.size} seleccionados
                </span>
                <div className="flex gap-1 sm:gap-2 flex-wrap justify-center sm:justify-start">
                  <button
                    onClick={() => bulkAction("close")}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    <span className="hidden sm:inline">Cerrar</span>
                  </button>
                  <button
                    onClick={() => bulkAction("open")}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Unlock className="w-3 h-3" />
                    <span className="hidden sm:inline">Abrir</span>
                  </button>
                  <button
                    onClick={() => bulkAction("delete")}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                  <button
                    onClick={() => setSelectedSlots(new Set())}
                    className="px-2 sm:px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs sm:text-sm font-medium transition-colors"
                  >
                    <span className="sm:hidden">×</span>
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {visibleListSlots.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">{showAllSlots ? "No hay horarios creados" : "No hay horarios para este día"}</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 sm:mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base"
              >
                Crear horarios
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block sm:hidden space-y-2">
                {/* Select All Button */}
                <button
                  onClick={toggleAllSlots}
                  className="flex items-center gap-2 mb-3 text-sm text-gray-600"
                >
                  {visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                  {visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>

                {visibleListSlots.map((slot) => {
                  const slotStatus = getSlotStatus(slot);
                  return (
                  <div
                    key={slot.id}
                    className={`border rounded-lg p-3 ${
                      selectedSlots.has(slot.id) ? "border-blue-400 bg-blue-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={() => toggleSlotSelection(slot.id)}
                        className="p-1 -ml-1"
                      >
                        {selectedSlots.has(slot.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${slotStatus.color}`}>
                        {slotStatus.label}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm">
                      {showAllSlots && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha:</span>
                          <span className="font-medium">{formatDateString(slot.date)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hora:</span>
                        <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio:</span>
                        <span className="font-medium">${slot.finalPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reservas:</span>
                        <span className="font-medium">{slot.currentBookings}/{slot.maxBookings}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                      {slot.isOpen && slot.currentBookings < slot.maxBookings && (
                        <button
                          onClick={() => openBookModalWithSlot(slot)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          Agendar
                        </button>
                      )}
                      <button
                        onClick={() => toggleOpenSlot(slot.id, slot.isOpen)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                      >
                        {slot.isOpen ? (
                          <>
                            <Lock className="w-3 h-3" />
                            Cerrar
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            Abrir
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 w-12">
                        <button
                          onClick={toggleAllSlots}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? "Deseleccionar Todo" : "Seleccionar Todo"}
                        >
                          {visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      {showAllSlots && <th className="text-left py-3 px-4">Fecha</th>}
                      <th className="text-left py-3 px-4">Hora</th>
                      <th className="text-left py-3 px-4">Duración</th>
                      <th className="text-left py-3 px-4">Precio</th>
                      <th className="text-left py-3 px-4">Estado</th>
                      <th className="text-left py-3 px-4">Reservas</th>
                      <th className="text-right py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleListSlots.map((slot) => {
                      const slotStatus = getSlotStatus(slot);
                      return (
                      <tr key={slot.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSlotSelection(slot.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {selectedSlots.has(slot.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        {showAllSlots && <td className="py-3 px-4">{formatDateString(slot.date)}</td>}
                        <td className="py-3 px-4">{slot.startTime} - {slot.endTime}</td>
                        <td className="py-3 px-4">{slot.duration} min</td>
                        <td className="py-3 px-4">${slot.finalPrice}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${slotStatus.color}`}>
                            {slotStatus.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {slot.currentBookings}/{slot.maxBookings}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            {slot.isOpen && slot.currentBookings < slot.maxBookings && (
                              <button
                                onClick={() => openBookModalWithSlot(slot)}
                                className="p-2 hover:bg-green-100 rounded"
                                title="Agendar cita para paciente"
                              >
                                <CalendarPlus className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                            <button
                              onClick={() => toggleOpenSlot(slot.id, slot.isOpen)}
                              className="p-2 hover:bg-gray-200 rounded"
                              title={slot.isOpen ? "Cerrar para Reservas" : "Abrir para Reservas"}
                            >
                              {slot.isOpen ? (
                                <Lock className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Unlock className="w-4 h-4 text-green-600" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="p-2 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Book Patient Modal */}
      {doctorId && (
        <BookPatientModal
          isOpen={bookPatientModalOpen}
          onClose={() => {
            setBookPatientModalOpen(false);
            setBookPatientPreSlot(null);
          }}
          doctorId={doctorId}
          onSuccess={() => {
            fetchBookings();
            fetchSlots();
          }}
          preSelectedSlot={bookPatientPreSlot}
        />
      )}

      {/* Create Slots Modal */}
      {doctorId && (
        <CreateSlotsModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setVoiceFormData(undefined); // Clear voice data on close
          }}
          doctorId={doctorId}
          onSuccess={() => {
            fetchSlots();
            fetchBookings();
            setVoiceFormData(undefined); // Clear voice data after success
          }}
          initialData={voiceFormData} // Pass voice data to pre-fill form
        />
      )}

      {/* Voice Recording Modal */}
      {doctorId && (
        <VoiceRecordingModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          sessionType="CREATE_APPOINTMENT_SLOTS"
          context={{
            patientId: undefined,
            doctorId: doctorId,
          }}
          onComplete={handleVoiceModalComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {doctorId && (
        <VoiceChatSidebar
          isOpen={voiceSidebarOpen}
          onClose={() => {
            setVoiceSidebarOpen(false);
            setSidebarInitialData(undefined);
          }}
          sessionType="CREATE_APPOINTMENT_SLOTS"
          patientId="appointments" // Use a special ID for appointments context
          doctorId={doctorId}
          onConfirm={handleVoiceConfirm}
          initialData={sidebarInitialData}
        />
      )}
    </div>
  );
}
