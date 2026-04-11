import { Calendar, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, Mail, DollarSign, ChevronsUpDown, CheckCircle, Send, Loader2, CalendarClock, Video, Clock, UserSquare2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { InlinePatientSearch } from "./InlinePatientSearch";
import { CreatePatientFromBookingModal } from "./CreatePatientFromBookingModal";
import { formatLocalDate, getLocalDateString } from "@/lib/dates";
import { BookingStatusBadge } from "./BookingStatusBadge";
import type { Booking, SortColumn, SortDirection } from "../_hooks/useBookings";

interface Props {
  bookings: Booking[];
  filteredBookings: Booking[];
  bookingsCollapsed: boolean;
  setBookingsCollapsed: (v: boolean) => void;
  bookingFilterDate: string;
  setBookingFilterDate: (v: string) => void;
  bookingFilterPatient: string;
  setBookingFilterPatient: (v: string) => void;
  bookingFilterStatus: string;
  setBookingFilterStatus: (v: string) => void;
  shiftBookingFilterDate: (days: number) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateExtendedBlock: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  getStatusColor: (status: string, endTime?: string, date?: string) => string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}

function SortIcon({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn; sortDirection: SortDirection }) {
  if (column !== sortColumn) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
  return sortDirection === "asc"
    ? <ChevronUp className="w-3 h-3" />
    : <ChevronDown className="w-3 h-3" />;
}

export function BookingsSection({
  bookings,
  filteredBookings,
  bookingsCollapsed,
  setBookingsCollapsed,
  bookingFilterDate,
  setBookingFilterDate,
  bookingFilterPatient,
  setBookingFilterPatient,
  bookingFilterStatus,
  setBookingFilterStatus,
  shiftBookingFilterDate,
  onUpdateStatus,
  onUpdateExtendedBlock,
  onUpdatePatientLink,
  onDeleteBooking,
  onOpenFormLinkModal,
  onSendEmail,
  onReschedule,
  getStatusColor,
  sortColumn,
  sortDirection,
  onSort,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          Todas las Citas
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
            {filteredBookings.length} cita{filteredBookings.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setBookingsCollapsed(!bookingsCollapsed)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${bookingsCollapsed ? "-rotate-90" : ""}`}
            />
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
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
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
                className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setBookingFilterDate("");
                  setBookingFilterStatus("ACTIVE");
                  setBookingFilterPatient("");
                }}
                className={`text-sm font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  !bookingFilterDate && bookingFilterStatus === "ACTIVE" && !bookingFilterPatient
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                Todas
              </button>
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
              <option value="ACTIVE">Activas</option>
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="CONFIRMED">Agendada</option>
              <option value="COMPLETED">Completada</option>
              <option value="NO_SHOW">No asistió</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            {(bookingFilterDate !== getLocalDateString(new Date()) || bookingFilterPatient || bookingFilterStatus !== "ACTIVE") && (
              <button
                onClick={() => {
                  setBookingFilterDate(getLocalDateString(new Date()));
                  setBookingFilterPatient("");
                  setBookingFilterStatus("ACTIVE");
                }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {bookings.length === 0
                  ? "No hay citas reservadas"
                  : "Sin resultados para los filtros aplicados"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block sm:hidden space-y-3">
                {filteredBookings.map((booking) => {
                  const bookingDate = booking.slot?.date ?? booking.date ?? "";
                  const endTime = booking.slot?.endTime ?? booking.endTime ?? undefined;
                  const colorClass = getStatusColor(booking.status, endTime, bookingDate);

                  const startTime = booking.slot?.startTime ?? booking.startTime ?? "";

                  return (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-3">
                      {/* Row 1: name + status */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="font-medium text-gray-900 text-sm">{booking.patientName}</p>
                        <BookingStatusBadge
                          status={booking.status}
                          colorClass={colorClass}
                          slotEndTime={endTime}
                          slotDate={bookingDate}
                        />
                      </div>

                      {/* Row 2: date + time range */}
                      <p className="text-xs text-gray-600 mb-1">
                        {formatLocalDate(bookingDate, { month: "short", day: "numeric", year: "numeric" })}
                        {startTime && ` · ${startTime}`}
                        {endTime && `–${endTime}`}
                      </p>

                      {/* Row 3: service + badges */}
                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {booking.serviceName && (
                          <span className="text-xs text-blue-600 font-medium">{booking.serviceName}</span>
                        )}
                        {booking.appointmentMode === "TELEMEDICINA" && (
                          <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Telemedicina</span>
                        )}
                        {booking.isFirstTime === true && (
                          <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Primera vez</span>
                        )}
                        {booking.isFirstTime === false && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Recurrente</span>
                        )}
                      </div>

                      {/* Row 4: contact */}
                      <div className="flex flex-col gap-0.5 text-xs text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          {booking.patientPhone}
                        </span>
                        {booking.patientEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 shrink-0" />
                            {booking.patientEmail}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          ${Number(booking.finalPrice).toLocaleString()}
                        </span>
                      </div>

                      {/* Row 5: expediente */}
                      <div className="mb-2">
                        <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
                      </div>

                      <StatusActions
                        booking={booking}
                        onUpdateStatus={onUpdateStatus}
                        onUpdateExtendedBlock={onUpdateExtendedBlock}
                        onDeleteBooking={onDeleteBooking}
                        onOpenFormLinkModal={onOpenFormLinkModal}
                        onSendEmail={onSendEmail}
                        onReschedule={onReschedule}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">
                        <button
                          onClick={() => onSort("patient")}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          PACIENTE <SortIcon column="patient" sortColumn={sortColumn} sortDirection={sortDirection} />
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">
                        <button
                          onClick={() => onSort("date")}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          FECHA Y HORA <SortIcon column="date" sortColumn={sortColumn} sortDirection={sortDirection} />
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">SERVICIO</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">EXPEDIENTE</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">CONTACTO</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">PRECIO</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">
                        <button
                          onClick={() => onSort("status")}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          ESTADO <SortIcon column="status" sortColumn={sortColumn} sortDirection={sortDirection} />
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredBookings.map((booking) => {
                      const bookingDate = booking.slot?.date ?? booking.date ?? "";
                      const endTime = booking.slot?.endTime ?? booking.endTime ?? undefined;
                      const colorClass = getStatusColor(booking.status, endTime, bookingDate);

                      return (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <p className="font-medium text-gray-900">{booking.patientName}</p>
                            {booking.isFirstTime === true && (
                              <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">Primera vez</span>
                            )}
                            {booking.isFirstTime === false && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">Recurrente</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            <p>{formatLocalDate(bookingDate, { month: "short", day: "numeric", year: "numeric" })}</p>
                            <p className="text-xs">{booking.slot?.startTime ?? booking.startTime ?? ""}</p>
                          </td>
                          <td className="py-3 px-3">
                            {booking.serviceName
                              ? <span className="text-sm text-gray-800">{booking.serviceName}</span>
                              : <span className="text-xs text-gray-400">—</span>
                            }
                          </td>
                          <td className="py-3 px-3">
                            <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
                          </td>
                          <td className="py-3 px-3">
                            <p className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone className="w-3 h-3" /> {booking.patientPhone}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Mail className="w-3 h-3" /> {booking.patientEmail}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            ${Number(booking.finalPrice).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <BookingStatusBadge
                              status={booking.status}
                              colorClass={colorClass}
                              slotEndTime={endTime}
                              slotDate={bookingDate}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <StatusActions
                              booking={booking}
                              onUpdateStatus={onUpdateStatus}
                              onUpdateExtendedBlock={onUpdateExtendedBlock}
                              onDeleteBooking={onDeleteBooking}
                              onOpenFormLinkModal={onOpenFormLinkModal}
                              onSendEmail={onSendEmail}
                              onReschedule={onReschedule}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function minsToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function ExtendedBlockControl({
  booking,
  onUpdate,
}: {
  booking: Booking;
  onUpdate: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
}) {
  const rawStartTime = booking.slot?.startTime ?? booking.startTime ?? null;
  if (!rawStartTime) return null;
  const startTime = rawStartTime;
  const slotDuration = booking.slot?.duration ?? booking.duration ?? 60;
  const startMin = timeToMins(startTime);
  const currentBlockMins = booking.extendedBlockMinutes ?? slotDuration;
  const blockEndTime = minsToTime(startMin + currentBlockMins);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(blockEndTime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(minsToTime(startMin + (booking.extendedBlockMinutes ?? slotDuration)));
  }, [booking.extendedBlockMinutes, startMin, slotDuration]);

  const handleSave = async () => {
    const endMin = timeToMins(value);
    if (endMin <= startMin) return;
    setSaving(true);
    await onUpdate(booking.id, endMin - startMin);
    setSaving(false);
    setEditing(false);
  };

  const isCustom = booking.extendedBlockMinutes != null && booking.extendedBlockMinutes !== slotDuration;

  return (
    <div className="flex items-center gap-1 mt-1.5 w-full flex-wrap">
      <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
      {editing ? (
        <>
          <span className="text-xs text-gray-500">Bloquear hasta:</span>
          <input
            type="time"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "..." : "OK"}
          </button>
          <button
            onClick={() => { setEditing(false); setValue(blockEndTime); }}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="text-xs text-gray-400">Bloqueo:</span>
          <span className={`text-xs font-medium ${isCustom ? "text-indigo-600" : "text-gray-500"}`}>
            {startTime}–{blockEndTime}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-1.5 py-0.5 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
          >
            Editar
          </button>
        </>
      )}
    </div>
  );
}

function ExpedienteCell({
  booking,
  onUpdatePatientLink,
}: {
  booking: Booking;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (booking.patientId && booking.patient) {
    return (
      <Link
        href={`/dashboard/medical-records/patients/${booking.patientId}`}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        <UserSquare2 className="w-3 h-3 shrink-0" />
        {booking.patient.firstName} {booking.patient.lastName}
      </Link>
    );
  }

  if (booking.isFirstTime === true) {
    return (
      <>
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap"
        >
          + Crear expediente
        </button>
        {showCreateModal && (
          <CreatePatientFromBookingModal
            booking={booking}
            onClose={() => setShowCreateModal(false)}
            onLinked={(patient) => {
              onUpdatePatientLink(booking.id, patient.id, patient);
              setShowCreateModal(false);
            }}
          />
        )}
      </>
    );
  }

  if (booking.isFirstTime === false) {
    return (
      <InlinePatientSearch
        onSelect={(patient) => onUpdatePatientLink(booking.id, patient.id, patient)}
      />
    );
  }

  return <span className="text-xs text-gray-400">—</span>;
}

function StatusActions({
  booking,
  onUpdateStatus,
  onUpdateExtendedBlock,
  onDeleteBooking,
  onOpenFormLinkModal,
  onSendEmail,
  onReschedule,
}: {
  booking: Booking;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateExtendedBlock: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
}) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const isTerminal = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status);

  const bookingDate = (booking.slot?.date ?? booking.date ?? "").split("T")[0];
  const endTime = booking.slot?.endTime ?? booking.endTime;
  const nowMx = new Date().toLocaleString("sv-SE", { timeZone: "America/Mexico_City" });
  const isVencida =
    (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
    !!bookingDate && !!endTime &&
    `${bookingDate} ${endTime}:00` < nowMx;
  const canReschedule = booking.status === "CONFIRMED" || isVencida;

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    await onSendEmail(booking.id);
    setIsSendingEmail(false);
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {booking.status === "PENDING" && (
        <button
          onClick={() => onUpdateStatus(booking.id, "CONFIRMED")}
          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
        >
          Confirmar
        </button>
      )}
      {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
        <>
          <button
            onClick={() => onUpdateStatus(booking.id, "COMPLETED")}
            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
          >
            Completar
          </button>
          <button
            onClick={() => onUpdateStatus(booking.id, "NO_SHOW")}
            className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
          >
            No asistió
          </button>
          <button
            onClick={() => onUpdateStatus(booking.id, "CANCELLED")}
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
          >
            Cancelar
          </button>
        </>
      )}
      {canReschedule && (
        <button
          onClick={() => onReschedule(booking)}
          className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1"
        >
          <CalendarClock className="w-3 h-3" />
          Reagendar
        </button>
      )}
      {booking.status === "CONFIRMED" && (
        <>
          <button
            onClick={() => onOpenFormLinkModal(booking)}
            className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
          >
            Formulario
          </button>
          {booking.appointmentMode === "TELEMEDICINA" ? (
            <button
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              title={
                booking.meetLink
                  ? `Meet creado · ${booking.confirmationEmailSentAt ? `Último envío: ${new Date(booking.confirmationEmailSentAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Enviar correo con enlace Google Meet al paciente"}`
                  : "Crear Google Meet y enviar correo al paciente"
              }
              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSendingEmail ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : booking.meetLink ? (
                <CheckCircle className="w-3 h-3 text-blue-600" />
              ) : (
                <Video className="w-3 h-3" />
              )}
              {isSendingEmail ? "Enviando..." : booking.meetLink ? "Reenviar Meet" : "Enviar Meet"}
            </button>
          ) : (
            <button
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              title={
                booking.confirmationEmailSentAt
                  ? `Último envío: ${new Date(booking.confirmationEmailSentAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Enviar correo de confirmación al paciente"
              }
              className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSendingEmail ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : booking.confirmationEmailSentAt ? (
                <CheckCircle className="w-3 h-3 text-teal-600" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {isSendingEmail ? "Enviando..." : booking.confirmationEmailSentAt ? "Reenviar" : "Correo"}
            </button>
          )}
        </>
      )}
      {booking.formLink?.status === "SUBMITTED" && (
        <Link
          href={`/dashboard/medical-records/formularios/${booking.formLink.id}`}
          className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 hover:bg-green-200"
        >
          <CheckCircle className="w-3 h-3" /> Recibido
        </Link>
      )}
      {isTerminal && (
        <button
          onClick={() => onDeleteBooking(booking.id, booking.patientName)}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Eliminar
        </button>
      )}
      {booking.status === "CONFIRMED" && (
        <ExtendedBlockControl booking={booking} onUpdate={onUpdateExtendedBlock} />
      )}
    </div>
  );
}
