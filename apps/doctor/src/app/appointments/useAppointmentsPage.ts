import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import { getLocalDateString } from '@/lib/dates';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceAppointmentSlotsData, VoiceStructuredData } from '@/types/voice-assistant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface AppointmentSlot {
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

export interface Booking {
  id: string;
  slotId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string | null;
  status: string;
  finalPrice: number;
  confirmationCode: string;
  createdAt: string;
  serviceName?: string | null;
  isFirstTime?: boolean | null;
  appointmentMode?: string | null;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export function useAppointmentsPage() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const doctorId = session?.user?.doctorId;

  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [listDate, setListDate] = useState<string>(getLocalDateString(new Date()));
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [bookingsCollapsed, setBookingsCollapsed] = useState(false);
  const [bookingFilterDate, setBookingFilterDate] = useState<string>(getLocalDateString(new Date()));
  const [bookingFilterPatient, setBookingFilterPatient] = useState<string>("");
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>("");

  const [bookPatientModalOpen, setBookPatientModalOpen] = useState(false);
  const [bookPatientPreSlot, setBookPatientPreSlot] = useState<AppointmentSlot | null>(null);

  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);
  const [voiceFormData, setVoiceFormData] = useState<any | undefined>(undefined);

  const openBookModal = () => {
    setBookPatientPreSlot(null);
    setBookPatientModalOpen(true);
  };

  const openBookModalWithSlot = (slot: AppointmentSlot) => {
    setBookPatientPreSlot(slot);
    setBookPatientModalOpen(true);
  };

  const mapVoiceToFormData = useCallback((voiceData: VoiceAppointmentSlotsData) => {
    return {
      startDate: voiceData.startDate || '',
      endDate: voiceData.endDate || '',
      daysOfWeek: voiceData.daysOfWeek || [1, 2, 3, 4, 5],
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

  const handleVoiceModalComplete = useCallback((
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const voiceData = data as VoiceAppointmentSlotsData;

    const allFields = Object.keys(voiceData);
    const extracted = allFields.filter(
      k => voiceData[k as keyof VoiceAppointmentSlotsData] != null &&
           voiceData[k as keyof VoiceAppointmentSlotsData] !== '' &&
           !(Array.isArray(voiceData[k as keyof VoiceAppointmentSlotsData]) &&
             (voiceData[k as keyof VoiceAppointmentSlotsData] as any[]).length === 0)
    );

    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      transcriptId,
      sessionId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    setVoiceModalOpen(false);
    setSidebarInitialData(initialData);
    setVoiceSidebarOpen(true);
  }, []);

  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    const voiceData = data as VoiceAppointmentSlotsData;
    const mappedData = mapVoiceToFormData(voiceData);
    setVoiceFormData(mappedData);
    setVoiceSidebarOpen(false);
    setSidebarInitialData(undefined);
    setShowCreateModal(true);
  }, [mapVoiceToFormData]);

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

  const fetchSlots = useCallback(async () => {
    if (!doctorId) return;

    if (!hasLoadedOnce.current) setLoading(true);
    try {
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
      toast.error("Error al cargar los horarios");
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [doctorId, selectedDate]);

  const fetchBookings = useCallback(async () => {
    if (!doctorId) return;

    try {
      // Fetch all bookings without date restriction — the table uses client-side filtering.
      // Scoping to the calendar month caused April bookings to be invisible when viewing March.
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings?doctorId=${doctorId}`
      );
      const data = await response.json();

      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Error al cargar las citas");
    }
  }, [doctorId]);

  const onRefresh = useCallback(async () => {
    await fetchSlots();
    await fetchBookings();
  }, [fetchSlots, fetchBookings]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const deleteSlot = async (slotId: string) => {
    const activeBookings = bookings.filter(
      b => b.slotId === slotId &&
        b.status !== "CANCELLED" && b.status !== "COMPLETED" && b.status !== "NO_SHOW"
    );

    if (activeBookings.length > 0) {
      if (!await practiceConfirm(`Este horario tiene ${activeBookings.length} cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?`)) return;

      for (const booking of activeBookings) {
        try {
          const cancelRes = await authFetch(
            `${API_URL}/api/appointments/bookings/${booking.id}`,
            { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }
          );
          const cancelData = await cancelRes.json();
          if (!cancelData.success) {
            toast.error(`Error al cancelar la cita de ${booking.patientName}. El horario no fue eliminado.`);
            return;
          }
        } catch (error) {
          console.error("Error cancelling booking:", error);
          toast.error("Error al cancelar una cita. El horario no fue eliminado.");
          return;
        }
      }
    } else {
      if (!await practiceConfirm("¿Estás seguro de que quieres eliminar este horario?")) return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      // 404 = slot was already deleted (e.g. instant slot removed when its booking was cancelled above)
      if (data.success || response.status === 404) {
        toast.success("Horario eliminado exitosamente");
        fetchSlots();
        fetchBookings();
      } else {
        toast.error(data.error || "Error al eliminar horario");
      }
    } catch (error) {
      console.error("Error deleting slot:", error);
      toast.error("Error al eliminar horario");
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    if (newStatus === "CANCELLED" && !await practiceConfirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "PATCH", body: JSON.stringify({ status: newStatus }) }
      );
      const data = await response.json();

      if (data.success) {
        toast.success(data.message || "Estado actualizado exitosamente");
        fetchBookings();
        fetchSlots();
      } else {
        toast.error(data.error || "Error al actualizar estado");
      }
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Error al actualizar estado");
    }
  };

  const deleteBooking = async (bookingId: string, patientName: string) => {
    if (!await practiceConfirm(`¿Eliminar el registro de la cita de ${patientName}? Esta acción no se puede deshacer.`)) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings/${bookingId}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        toast.success("Cita eliminada exitosamente");
        fetchBookings();
        fetchSlots();
      } else {
        toast.error(data.error || "Error al eliminar la cita");
      }
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("Error al eliminar la cita");
    }
  };

  const shiftBookingFilterDate = (days: number) => {
    const base = bookingFilterDate ? new Date(bookingFilterDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    setBookingFilterDate(getLocalDateString(base));
  };

  const toggleOpenSlot = async (slotId: string, currentIsOpen: boolean) => {
    const slot = slots.find(s => s.id === slotId);
    const newIsOpen = !currentIsOpen;

    if (slot && !newIsOpen && slot.currentBookings > 0) {
      toast.error(`No se puede cerrar este horario porque tiene ${slot.currentBookings} reserva(s) activa(s). Por favor cancela las reservas primero.`);
      return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        { method: "PATCH", body: JSON.stringify({ isOpen: newIsOpen }) }
      );
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchSlots();
        fetchBookings();
      } else {
        toast.error(data.error || "Error al actualizar horario");
      }
    } catch (error) {
      console.error("Error updating slot:", error);
      toast.error("Error al actualizar horario");
    }
  };

  const bulkAction = async (action: "delete" | "close" | "open") => {
    const slotIds = Array.from(selectedSlots);

    if (slotIds.length === 0) {
      toast.error("Por favor selecciona horarios primero");
      return;
    }

    if (action === "close") {
      const selectedSlotsData = slots.filter(s => slotIds.includes(s.id));
      const slotsWithBookings = selectedSlotsData.filter(s => s.currentBookings > 0);

      if (slotsWithBookings.length > 0) {
        toast.error(`No se pueden cerrar ${slotsWithBookings.length} horario(s) porque tienen reservas activas. Por favor cancela las reservas primero o deselecciona esos horarios.`);
        return;
      }
    }

    const actionText = action === "delete" ? "eliminar" : action === "close" ? "cerrar" : "abrir";
    if (!await practiceConfirm(`¿Estás seguro de que quieres ${actionText} ${slotIds.length} horario(s)?`)) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/bulk`,
        { method: "POST", body: JSON.stringify({ slotIds, action }) }
      );
      const data = await response.json();

      if (data.success) {
        toast.success(`${data.count} horario(s) ${actionText === "eliminar" ? "eliminados" : actionText === "cerrar" ? "cerrados" : "abiertos"} exitosamente`);
        setSelectedSlots(new Set());
        fetchSlots();
        fetchBookings();
      } else {
        toast.error(data.error || `Error al ${actionText} horarios`);
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(`Error al ${actionText} horarios`);
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

  // Derived values
  const selectedDateStr = getLocalDateString(selectedDate);
  const slotsForSelectedDate = slots.filter(slot => slot.date.split('T')[0] === selectedDateStr);

  const filteredBookings = bookings.filter((booking) => {
    if (bookingFilterDate && booking.slot.date.split('T')[0] !== bookingFilterDate) return false;
    if (bookingFilterPatient) {
      const search = bookingFilterPatient.toLowerCase();
      if (!booking.patientName.toLowerCase().includes(search) &&
          !booking.patientEmail.toLowerCase().includes(search)) return false;
    }
    if (bookingFilterStatus && booking.status !== bookingFilterStatus) return false;
    return true;
  });

  const slotsForListDate = slots.filter(slot => slot.date.split('T')[0] === listDate);
  const visibleListSlots = showAllSlots ? slots : slotsForListDate;
  const datesWithSlots = new Set(slots.map(slot => slot.date.split('T')[0]));

  // Calendar grid data
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const toggleAllSlots = () => {
    const visibleSlots = viewMode === "list" ? visibleListSlots : slots;
    const allSelected = visibleSlots.every(s => selectedSlots.has(s.id));
    if (allSelected) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(visibleSlots.map(s => s.id)));
    }
  };

  const getSlotStatus = (slot: AppointmentSlot): { label: string; color: string } => {
    const isFull = slot.currentBookings >= slot.maxBookings;
    if (!slot.isOpen) return { label: "Cerrado", color: "bg-gray-200 text-gray-700" };
    if (isFull) return { label: "Lleno", color: "bg-blue-100 text-blue-700" };
    return { label: "Disponible", color: "bg-green-100 text-green-700" };
  };

  const getStatusColor = (status: string, slotEndTime?: string, slotDate?: string) => {
    // VENCIDA: was active (PENDING/CONFIRMED) but slot end time has already passed
    if ((status === 'PENDING' || status === 'CONFIRMED') && slotEndTime && slotDate) {
      const now = new Date();
      const nowLocal = now.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
      const slotEndStr = `${slotDate.split('T')[0]} ${slotEndTime}:00`;
      if (slotEndStr < nowLocal) {
        return "bg-red-100 text-red-800 border-red-300";
      }
    }
    switch (status) {
      case "CONFIRMED": return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENDING": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "CANCELLED": return "bg-red-100 text-red-700 border-red-200";
      case "COMPLETED": return "bg-green-100 text-green-700 border-green-200";
      case "NO_SHOW": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return {
    // Auth
    authStatus: status,
    doctorId,
    // Data
    slots,
    bookings,
    loading,
    // View state
    selectedDate, setSelectedDate,
    showCreateModal, setShowCreateModal,
    viewMode, setViewMode,
    selectedSlots, setSelectedSlots,
    listDate, setListDate,
    showAllSlots, setShowAllSlots,
    bookingsCollapsed, setBookingsCollapsed,
    bookingFilterDate, setBookingFilterDate,
    bookingFilterPatient, setBookingFilterPatient,
    bookingFilterStatus, setBookingFilterStatus,
    // Chat IA panel
    chatPanelOpen, setChatPanelOpen,
    onRefresh,
    // Book modal
    bookPatientModalOpen, setBookPatientModalOpen,
    bookPatientPreSlot, setBookPatientPreSlot,
    openBookModal,
    openBookModalWithSlot,
    // Voice
    voiceModalOpen, setVoiceModalOpen,
    voiceSidebarOpen, setVoiceSidebarOpen,
    sidebarInitialData, setSidebarInitialData,
    voiceFormData, setVoiceFormData,
    handleVoiceModalComplete,
    handleVoiceConfirm,
    // Data fetchers (exposed for modal onSuccess callbacks)
    fetchSlots,
    fetchBookings,
    // Handlers
    deleteSlot,
    updateBookingStatus,
    deleteBooking,
    shiftBookingFilterDate,
    toggleOpenSlot,
    bulkAction,
    toggleSlotSelection,
    toggleAllSlots,
    // Derived values
    selectedDateStr,
    slotsForSelectedDate,
    filteredBookings,
    visibleListSlots,
    datesWithSlots,
    calendarDays,
    year,
    month,
    // Display helpers
    getSlotStatus,
    getStatusColor,
  };
}
