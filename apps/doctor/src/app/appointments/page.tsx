"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, DollarSign, Plus, Trash2, Lock, Unlock, Loader2, CheckSquare, Square, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Mic } from "lucide-react";
import CreateSlotsModal from "./CreateSlotsModal";
import Sidebar from "@/components/layout/Sidebar";
import { authFetch } from "@/lib/auth-fetch";
import {
  VoiceRecordingModal,
  VoiceChatSidebar,
} from '@/components/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceAppointmentSlotsData, VoiceStructuredData } from '@/types/voice-assistant';

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
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
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
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
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (doctorId) {
      fetchDoctorProfile(doctorId);
      fetchSlots();
      fetchBookings();
    }
  }, [doctorId, selectedDate]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchSlots = async () => {
    if (!doctorId) return;

    setLoading(true);
    try {
      // Fetch slots for the current month
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();

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
    if (!confirm("¿Estás seguro de que quieres eliminar este horario?")) return;

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

  const toggleBlockSlot = async (slotId: string, currentStatus: string) => {
    const newStatus = currentStatus === "BLOCKED" ? "AVAILABLE" : "BLOCKED";

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
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

  const bulkAction = async (action: "delete" | "block" | "unblock") => {
    const slotIds = Array.from(selectedSlots);

    if (slotIds.length === 0) {
      alert("Por favor selecciona horarios primero");
      return;
    }

    const actionText = action === "delete" ? "eliminar" : action === "block" ? "bloquear" : "desbloquear";
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
        alert(`${data.count} horario(s) ${actionText === "eliminar" ? "eliminados" : actionText === "bloquear" ? "bloqueados" : "desbloqueados"} exitosamente`);
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
    if (selectedSlots.size === slots.length) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(slots.map(s => s.id)));
    }
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
  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const slotsForSelectedDate = slots.filter(
    (slot) => new Date(slot.date).toISOString().split("T")[0] === selectedDateStr
  );

  // Get dates with slots for calendar highlighting
  const datesWithSlots = new Set(
    slots.map((slot) => new Date(slot.date).toISOString().split("T")[0])
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Citas</h1>
                <p className="text-gray-600 mt-1">Crea y gestiona tu disponibilidad</p>
              </div>
              <div className="flex gap-3">
                {/* Voice Assistant Button */}
                <button
                  onClick={() => setVoiceModalOpen(true)}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  <Mic className="w-5 h-5" />
                  Asistente de Voz
                </button>
                {/* Manual Create Button */}
                <button
                  onClick={() => {
                    setVoiceFormData(undefined); // Clear voice data
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Crear Horarios
                </button>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Vista de Calendario
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Vista de Lista
              </button>
            </div>
          </div>

          {/* Citas Reservadas */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Citas Reservadas
              </h2>
            <span className="text-sm font-medium text-gray-600">
              {bookings.length} total
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin reservas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha y Hora</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Paciente</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contacto</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Precio</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Código</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(booking.slot.date).toLocaleDateString("es-MX", {
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedDate.toLocaleDateString("es-MX", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedDate(
                        new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1)
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    ‹ Anterior
                  </button>
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() =>
                      setSelectedDate(
                        new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1)
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    Siguiente ›
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-gray-600 text-sm py-2"
                  >
                    {day}
                  </div>
                ))}

                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const dateStr = new Date(year, month, day).toISOString().split("T")[0];
                  const hasSlots = datesWithSlots.has(dateStr);
                  const isSelected = dateStr === selectedDateStr;
                  const isToday =
                    dateStr === new Date().toISOString().split("T")[0];

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      className={`aspect-square p-2 rounded-lg text-center transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white font-bold"
                          : isToday
                          ? "bg-blue-100 text-blue-700 font-semibold"
                          : hasSlots
                          ? "bg-blue-200 text-blue-900 font-medium hover:bg-blue-300"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <div className="text-sm">{day}</div>
                      {hasSlots && !isSelected && (
                        <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horarios para Fecha Seleccionada */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">
                {selectedDate.toLocaleDateString("es-MX", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>

              {slotsForSelectedDate.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin horarios para esta fecha</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {slotsForSelectedDate.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-lg border-2 ${
                        slot.status === "BOOKED"
                          ? "bg-blue-50 border-blue-200"
                          : slot.status === "BLOCKED"
                          ? "bg-gray-100 border-gray-300"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            slot.status === "AVAILABLE"
                              ? "bg-blue-100 text-blue-700"
                              : slot.status === "BOOKED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {slot.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">${slot.finalPrice}</span>
                        {slot.discount && (
                          <span className="text-xs text-blue-600">
                            ({slot.discountType === "PERCENTAGE" ? `${slot.discount}%` : `$${slot.discount}`} off)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => toggleBlockSlot(slot.id, slot.status)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                          title={slot.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        >
                          {slot.status === "BLOCKED" ? (
                            <Unlock className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                          disabled={slot.currentBookings > 0}
                          title={slot.currentBookings > 0 ? "No se puede eliminar - tiene reservas" : "Eliminar"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vista de Lista */}
        {viewMode === "list" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Todos los Horarios</h2>

              {/* Barra de Acciones Masivas */}
              {selectedSlots.size > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedSlots.size} seleccionados
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => bulkAction("block")}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Lock className="w-3 h-3" />
                      Bloquear
                    </button>
                    <button
                      onClick={() => bulkAction("unblock")}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Unlock className="w-3 h-3" />
                      Desbloquear
                    </button>
                    <button
                      onClick={() => bulkAction("delete")}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                    <button
                      onClick={() => setSelectedSlots(new Set())}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium transition-colors"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {slots.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Aún no se han creado horarios de citas</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Crea tus primeros horarios
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 w-12">
                        <button
                          onClick={toggleAllSlots}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={selectedSlots.size === slots.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
                        >
                          {selectedSlots.size === slots.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">Fecha</th>
                      <th className="text-left py-3 px-4">Hora</th>
                      <th className="text-left py-3 px-4">Duración</th>
                      <th className="text-left py-3 px-4">Precio</th>
                      <th className="text-left py-3 px-4">Estado</th>
                      <th className="text-left py-3 px-4">Reservas</th>
                      <th className="text-right py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
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
                        <td className="py-3 px-4">
                          {new Date(slot.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">{slot.startTime} - {slot.endTime}</td>
                        <td className="py-3 px-4">{slot.duration} min</td>
                        <td className="py-3 px-4">${slot.finalPrice}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              slot.status === "AVAILABLE"
                                ? "bg-blue-100 text-blue-700"
                                : slot.status === "BOOKED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {slot.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {slot.currentBookings}/{slot.maxBookings}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => toggleBlockSlot(slot.id, slot.status)}
                              className="p-2 hover:bg-gray-200 rounded"
                              title={slot.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                            >
                              {slot.status === "BLOCKED" ? (
                                <Unlock className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Lock className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="p-2 hover:bg-red-100 rounded"
                              disabled={slot.currentBookings > 0}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
      </main>
    </div>
  );
}
