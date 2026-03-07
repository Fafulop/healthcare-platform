"use client";

import { Calendar, Clock, DollarSign, Plus, Trash2, Lock, Unlock, Loader2, CheckSquare, Square, User, Phone, Mail, CheckCircle, XCircle, AlertCircle, Sparkles, ChevronLeft, ChevronRight, ChevronDown, CalendarPlus } from "lucide-react";
import CreateSlotsModal from "./CreateSlotsModal";
import BookPatientModal from "./BookPatientModal";
import {
  VoiceRecordingModal,
  VoiceChatSidebar,
} from '@/components/voice-assistant';
import { getLocalDateString, formatLocalDate as formatDateString } from '@/lib/dates';
import { useAppointmentsPage } from './useAppointmentsPage';

const getStatusIcon = (status: string) => {
  switch (status) {
    case "CONFIRMED": return <CheckCircle className="w-4 h-4" />;
    case "CANCELLED": return <XCircle className="w-4 h-4" />;
    case "PENDING": return <AlertCircle className="w-4 h-4" />;
    default: return null;
  }
};

export default function AppointmentsPage() {
  const {
    authStatus,
    doctorId,
    slots,
    bookings,
    loading,
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
    bookPatientModalOpen, setBookPatientModalOpen,
    bookPatientPreSlot, setBookPatientPreSlot,
    openBookModal,
    openBookModalWithSlot,
    voiceModalOpen, setVoiceModalOpen,
    voiceSidebarOpen, setVoiceSidebarOpen,
    sidebarInitialData, setSidebarInitialData,
    voiceFormData, setVoiceFormData,
    handleVoiceModalComplete,
    handleVoiceConfirm,
    fetchSlots,
    fetchBookings,
    deleteSlot,
    updateBookingStatus,
    deleteBooking,
    shiftBookingFilterDate,
    toggleOpenSlot,
    bulkAction,
    toggleSlotSelection,
    toggleAllSlots,
    selectedDateStr,
    slotsForSelectedDate,
    filteredBookings,
    visibleListSlots,
    datesWithSlots,
    calendarDays,
    year,
    month,
    getSlotStatus,
    getStatusColor,
  } = useAppointmentsPage();

  if (authStatus === "loading" || loading) {
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
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Chat IA</span>
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
              onClick={() => {
                setVoiceFormData(undefined);
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

      {/* Todas las Citas */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Todas las Citas
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
              {filteredBookings.length} cita{filteredBookings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setBookingsCollapsed(prev => !prev)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${bookingsCollapsed ? "-rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        {!bookingsCollapsed && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftBookingFilterDate(-1)}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Día anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={bookingFilterDate}
                  onChange={(e) => setBookingFilterDate(e.target.value)}
                  className="text-xs sm:text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => shiftBookingFilterDate(1)}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Día siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {bookingFilterDate && (
                  <button
                    onClick={() => setBookingFilterDate("")}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                  >
                    Todas
                  </button>
                )}
              </div>
              <div className="flex-1 relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar paciente..."
                  value={bookingFilterPatient}
                  onChange={(e) => setBookingFilterPatient(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-gray-200 rounded pl-7 pr-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <select
                value={bookingFilterStatus}
                onChange={(e) => setBookingFilterStatus(e.target.value)}
                className="text-xs sm:text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="CONFIRMED">Confirmada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="COMPLETED">Completada</option>
                <option value="NO_SHOW">No asistió</option>
              </select>
              {(bookingFilterDate || bookingFilterPatient || bookingFilterStatus) && (
                <button
                  onClick={() => { setBookingFilterDate(""); setBookingFilterPatient(""); setBookingFilterStatus(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  Limpiar
                </button>
              )}
            </div>

            {filteredBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{bookings.length === 0 ? "No hay citas reservadas" : "Sin resultados para los filtros aplicados"}</p>
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
                            {formatDateString(booking.slot.date, { month: "short", day: "numeric" })} · {booking.slot.startTime}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
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
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{booking.confirmationCode}</code>
                        <div className="flex gap-1 items-center">
                          {booking.status === "PENDING" && (
                            <>
                              <button onClick={() => updateBookingStatus(booking.id, "CONFIRMED")} className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] font-medium">Confirmar</button>
                              <button onClick={() => updateBookingStatus(booking.id, "CANCELLED")} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-medium">Cancelar</button>
                            </>
                          )}
                          {booking.status === "CONFIRMED" && (
                            <>
                              <button onClick={() => updateBookingStatus(booking.id, "COMPLETED")} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-medium">Completada</button>
                              <button onClick={() => updateBookingStatus(booking.id, "NO_SHOW")} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-medium">No asistió</button>
                              <button onClick={() => updateBookingStatus(booking.id, "CANCELLED")} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-medium">Cancelar</button>
                            </>
                          )}
                          <button onClick={() => deleteBooking(booking.id, booking.patientName)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar cita y horario">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                                <p className="font-medium text-gray-900">{formatDateString(booking.slot.date, { month: "short", day: "numeric", year: "numeric" })}</p>
                                <p className="text-sm text-gray-600">{booking.slot.startTime} - {booking.slot.endTime}</p>
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
                              <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-3 h-3" />{booking.patientEmail}</div>
                              <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-3 h-3" />{booking.patientPhone}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1 font-semibold text-gray-900"><DollarSign className="w-4 h-4" />{booking.finalPrice}</span>
                          </td>
                          <td className="py-3 px-4">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{booking.confirmationCode}</code>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 items-center">
                              {booking.status === "PENDING" && (
                                <>
                                  <button onClick={() => updateBookingStatus(booking.id, "CONFIRMED")} className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium">Confirmar</button>
                                  <button onClick={() => updateBookingStatus(booking.id, "CANCELLED")} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium">Cancelar</button>
                                </>
                              )}
                              {booking.status === "CONFIRMED" && (
                                <>
                                  <button onClick={() => updateBookingStatus(booking.id, "COMPLETED")} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium">Completada</button>
                                  <button onClick={() => updateBookingStatus(booking.id, "NO_SHOW")} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium">No asistió</button>
                                  <button onClick={() => updateBookingStatus(booking.id, "CANCELLED")} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium">Cancelar</button>
                                </>
                              )}
                              <button onClick={() => deleteBooking(booking.id, booking.patientName)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar cita y horario">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                {selectedDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              </h2>
              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
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
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
                >
                  Sig.<span className="hidden sm:inline"> ›</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => (
                <div key={`${day}-${idx}`} className="text-center font-semibold text-gray-600 text-xs sm:text-sm py-1 sm:py-2">
                  <span className="sm:hidden">{day}</span>
                  <span className="hidden sm:inline">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][idx]}</span>
                </div>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;
                const dateStr = getLocalDateString(new Date(year, month, day));
                const hasSlots = datesWithSlots.has(dateStr);
                const isSelected = dateStr === selectedDateStr;
                const isToday = dateStr === getLocalDateString(new Date());
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`aspect-square p-1 sm:p-2 rounded-lg text-center transition-all ${
                      isSelected ? "bg-blue-600 text-white font-bold"
                      : isToday ? "bg-blue-100 text-blue-700 font-semibold"
                      : hasSlots ? "bg-blue-200 text-blue-900 font-medium hover:bg-blue-300"
                      : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-xs sm:text-sm">{day}</div>
                    {hasSlots && !isSelected && <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-0.5 sm:mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horarios para Fecha Seleccionada */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm sm:text-base capitalize">
              {selectedDate.toLocaleDateString("es-MX", { weekday: "long", month: "short", day: "numeric" })}
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
                        !slot.isOpen ? "bg-gray-100 border-gray-300"
                        : slot.currentBookings >= slot.maxBookings ? "bg-blue-50 border-blue-200"
                        : "bg-green-50 border-green-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                          <span className="font-semibold text-gray-900 text-xs sm:text-sm">{slot.startTime} - {slot.endTime}</span>
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
                          <button onClick={() => openBookModalWithSlot(slot)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] sm:text-xs" title="Agendar cita para paciente">
                            <CalendarPlus className="w-3 h-3" />
                            <span className="hidden sm:inline">Agendar</span>
                          </button>
                        )}
                        <button onClick={() => toggleOpenSlot(slot.id, slot.isOpen)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] sm:text-xs" title={slot.isOpen ? "Cerrar para Reservas" : "Abrir para Reservas"}>
                          {slot.isOpen ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        <button onClick={() => deleteSlot(slot.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] sm:text-xs" title="Eliminar">
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
                      onChange={(e) => { setListDate(e.target.value); setSelectedSlots(new Set()); }}
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
                        onClick={() => { setListDate(getLocalDateString(new Date())); setSelectedSlots(new Set()); }}
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
                  onClick={() => { setShowAllSlots(prev => !prev); setSelectedSlots(new Set()); }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${showAllSlots ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {showAllSlots ? "Por dia" : "Ver todos"}
                </button>
              </div>
            </div>

            {!showAllSlots && (
              <p className="text-sm text-gray-500 capitalize">
                {formatDateString(listDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}

            {/* Barra de Acciones Masivas */}
            {selectedSlots.size > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-blue-50 border border-blue-200 rounded-lg p-2 sm:px-4 sm:py-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700 text-center sm:text-left">{selectedSlots.size} seleccionados</span>
                <div className="flex gap-1 sm:gap-2 flex-wrap justify-center sm:justify-start">
                  <button onClick={() => bulkAction("close")} className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs sm:text-sm font-medium transition-colors">
                    <Lock className="w-3 h-3" /><span className="hidden sm:inline">Cerrar</span>
                  </button>
                  <button onClick={() => bulkAction("open")} className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs sm:text-sm font-medium transition-colors">
                    <Unlock className="w-3 h-3" /><span className="hidden sm:inline">Abrir</span>
                  </button>
                  <button onClick={() => bulkAction("delete")} className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs sm:text-sm font-medium transition-colors">
                    <Trash2 className="w-3 h-3" /><span className="hidden sm:inline">Eliminar</span>
                  </button>
                  <button onClick={() => setSelectedSlots(new Set())} className="px-2 sm:px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs sm:text-sm font-medium transition-colors">
                    <span className="sm:hidden">×</span><span className="hidden sm:inline">Limpiar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {visibleListSlots.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">{showAllSlots ? "No hay horarios creados" : "No hay horarios para este día"}</p>
              <button onClick={() => setShowCreateModal(true)} className="mt-3 sm:mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base">
                Crear horarios
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block sm:hidden space-y-2">
                <button onClick={toggleAllSlots} className="flex items-center gap-2 mb-3 text-sm text-gray-600">
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
                    <div key={slot.id} className={`border rounded-lg p-3 ${selectedSlots.has(slot.id) ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                      <div className="flex items-start justify-between mb-2">
                        <button onClick={() => toggleSlotSelection(slot.id)} className="p-1 -ml-1">
                          {selectedSlots.has(slot.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${slotStatus.color}`}>{slotStatus.label}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {showAllSlots && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha:</span>
                            <span className="font-medium">{formatDateString(slot.date)}</span>
                          </div>
                        )}
                        <div className="flex justify-between"><span className="text-gray-600">Hora:</span><span className="font-medium">{slot.startTime} - {slot.endTime}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Precio:</span><span className="font-medium">${slot.finalPrice}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Reservas:</span><span className="font-medium">{slot.currentBookings}/{slot.maxBookings}</span></div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                        {slot.isOpen && slot.currentBookings < slot.maxBookings && (
                          <button onClick={() => openBookModalWithSlot(slot)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium">
                            <CalendarPlus className="w-3 h-3" />Agendar
                          </button>
                        )}
                        <button onClick={() => toggleOpenSlot(slot.id, slot.isOpen)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          {slot.isOpen ? <><Lock className="w-3 h-3" />Cerrar</> : <><Unlock className="w-3 h-3" />Abrir</>}
                        </button>
                        <button onClick={() => deleteSlot(slot.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium">
                          <Trash2 className="w-3 h-3" />Eliminar
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
                        <button onClick={toggleAllSlots} className="p-1 hover:bg-gray-100 rounded" title={visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? "Deseleccionar Todo" : "Seleccionar Todo"}>
                          {visibleListSlots.length > 0 && visibleListSlots.every(s => selectedSlots.has(s.id)) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
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
                            <button onClick={() => toggleSlotSelection(slot.id)} className="p-1 hover:bg-gray-100 rounded">
                              {selectedSlots.has(slot.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                            </button>
                          </td>
                          {showAllSlots && <td className="py-3 px-4">{formatDateString(slot.date)}</td>}
                          <td className="py-3 px-4">{slot.startTime} - {slot.endTime}</td>
                          <td className="py-3 px-4">{slot.duration} min</td>
                          <td className="py-3 px-4">${slot.finalPrice}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${slotStatus.color}`}>{slotStatus.label}</span>
                          </td>
                          <td className="py-3 px-4">{slot.currentBookings}/{slot.maxBookings}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-end">
                              {slot.isOpen && slot.currentBookings < slot.maxBookings && (
                                <button onClick={() => openBookModalWithSlot(slot)} className="p-2 hover:bg-green-100 rounded" title="Agendar cita para paciente">
                                  <CalendarPlus className="w-4 h-4 text-green-600" />
                                </button>
                              )}
                              <button onClick={() => toggleOpenSlot(slot.id, slot.isOpen)} className="p-2 hover:bg-gray-200 rounded" title={slot.isOpen ? "Cerrar para Reservas" : "Abrir para Reservas"}>
                                {slot.isOpen ? <Lock className="w-4 h-4 text-gray-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
                              </button>
                              <button onClick={() => deleteSlot(slot.id)} className="p-2 hover:bg-red-100 rounded">
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
          onClose={() => { setBookPatientModalOpen(false); setBookPatientPreSlot(null); }}
          doctorId={doctorId}
          onSuccess={() => { fetchBookings(); fetchSlots(); }}
          preSelectedSlot={bookPatientPreSlot}
        />
      )}

      {/* Create Slots Modal */}
      {doctorId && (
        <CreateSlotsModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setVoiceFormData(undefined); }}
          doctorId={doctorId}
          onSuccess={() => { fetchSlots(); fetchBookings(); setVoiceFormData(undefined); }}
          initialData={voiceFormData}
        />
      )}

      {/* Voice Recording Modal */}
      {doctorId && (
        <VoiceRecordingModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          sessionType="CREATE_APPOINTMENT_SLOTS"
          context={{ patientId: undefined, doctorId }}
          onComplete={handleVoiceModalComplete}
        />
      )}

      {/* Voice Chat Sidebar */}
      {doctorId && (
        <VoiceChatSidebar
          isOpen={voiceSidebarOpen}
          onClose={() => { setVoiceSidebarOpen(false); setSidebarInitialData(undefined); }}
          sessionType="CREATE_APPOINTMENT_SLOTS"
          patientId="appointments"
          doctorId={doctorId}
          onConfirm={handleVoiceConfirm}
          initialData={sidebarInitialData}
        />
      )}
    </div>
  );
}
