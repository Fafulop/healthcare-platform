import { Calendar, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, Mail, DollarSign, ChevronsUpDown, CheckCircle, Send, Loader2, CalendarClock, Video, Clock, UserSquare2, X, Pencil, ExternalLink, AlertCircle, MessageCircle } from "lucide-react";
import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { InlinePatientSearch } from "./InlinePatientSearch";
import { CreatePatientFromBookingModal } from "./CreatePatientFromBookingModal";
import { FormularioStatusButton } from "./FormularioStatusButton";
import { FiscalFormButton } from "./FiscalFormButton";
import { PaymentLinkButton } from "@/components/payments/PaymentLinkButton";
import { CompleteBookingModal } from "./CompleteBookingModal";
import { formatLocalDate, getLocalDateString } from "@/lib/dates";
import { waNumber } from "@/lib/whatsapp";
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
  onUpdateFacturaSolicitada: (id: string, facturaSolicitada: boolean) => void;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onDeleteFormLink: (bookingId: string) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  onCompleteBooking: (id: string, price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
  onEmitCfdi?: (params: import("./CompleteBookingModal").CfdiParams) => Promise<{ success: boolean; error?: string }>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  getStatusColor: (status: string, endTime?: string, date?: string) => string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}

/**
 * Contacto efectivo de una cita: la copia de la CITA primero, el EXPEDIENTE de respaldo.
 * Mismo orden que resuelven los dos endpoints de envío — la fila no debe mostrar "sin
 * correo" mientras el botón de Confirmación manda feliz al correo del expediente.
 * La cita guarda lo que se escribió al agendar y nadie la actualiza después.
 */
function resolverContacto(booking: Booking) {
  return {
    email: booking.patientEmail?.trim() || booking.patient?.email?.trim() || "",
    phone: booking.patientPhone?.trim() || booking.patient?.phone?.trim() || "",
  };
}

/** Estados con botón propio en la barra de filtros — se excluyen del desplegable. */
const STATUS_BUTTONS = ["ACTIVE", "COMPLETED"];
/** Valor centinela del desplegable cuando el estado lo controla un botón. */
const BUTTON_OWNED = "__button__";

/**
 * Envuelve los controles que viven en la fila COLAPSADA (precio, expediente) para
 * que su clic no burbujee al toggle de la fila. Sin esto, editar un precio o buscar
 * un paciente abriría/cerraría la cita al mismo tiempo.
 */
function StopClick({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

/**
 * Casilla "¿Necesita factura?" — intención POR CITA (`bookings.factura_solicitada`).
 * Desmarcada (null o false) = todo se comporta como siempre. Marcada = aparece el botón
 * de Facturación en el grupo Documentos para pedirle los datos fiscales al paciente.
 * Vive en el RESUMEN (fila colapsada) para poder marcarla sin abrir la cita, así que va
 * envuelta en StopClick: sin eso, marcarla también abriría/cerraría la fila.
 */
function FacturaCheckbox({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (id: string, value: boolean) => void;
}) {
  const checked = !!booking.facturaSolicitada;
  return (
    <StopClick className="inline-flex">
      <label
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer transition-colors whitespace-nowrap ${
          checked
            ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
        }`}
        title="Marca si esta cita necesita factura"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(booking.id, e.target.checked)}
          className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
        />
        Factura
      </label>
    </StopClick>
  );
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
  onUpdateFacturaSolicitada,
  onUpdatePatientLink,
  onDeleteBooking,
  onOpenFormLinkModal,
  onDeleteFormLink,
  onSendEmail,
  onReschedule,
  onCompleteBooking,
  onEmitCfdi,
  onUpdatePrice,
  getStatusColor,
  sortColumn,
  sortDirection,
  onSort,
}: Props) {
  // Filas abiertas. Colapsado por defecto: la fila solo muestra el resumen
  // (paciente · servicio · fecha/hora · expediente · precio · estado) y los 6
  // grupos de acciones aparecen al hacer clic. Varias filas pueden estar abiertas.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
            aria-label={bookingsCollapsed ? "Expandir todas las citas" : "Contraer todas las citas"}
            aria-expanded={!bookingsCollapsed}
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {/* flex-wrap en los grupos: en móvil el contenedor es flex-col, así que
                cada grupo ocupa el ancho del teléfono. ‹ + fecha + › + "Todas las
                fechas" (etiqueta más larga que la anterior "Todas") no cabe en 360px
                sin envolver, y lo mismo el trío Activas/Completada/desplegable. */}
            <div className="flex items-center flex-wrap gap-1">
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
              {/* Limpia SOLO la fecha. Antes también reseteaba estado y paciente,
                  pero con "Activas"/"Completada" al lado eso rompería la consulta
                  más útil: completadas + todas las fechas. */}
              <button
                onClick={() => setBookingFilterDate("")}
                aria-pressed={!bookingFilterDate}
                className={`text-sm font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  !bookingFilterDate
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                Todas las fechas
              </button>
            </div>
            <div className="relative w-full sm:w-44">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={bookingFilterPatient}
                onChange={(e) => setBookingFilterPatient(e.target.value)}
                className="w-full text-xs sm:text-sm border border-gray-200 rounded pl-7 pr-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => setBookingFilterStatus("ACTIVE")}
                aria-pressed={bookingFilterStatus === "ACTIVE"}
                className={`text-sm font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  bookingFilterStatus === "ACTIVE"
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                Activas
              </button>
              <button
                onClick={() => setBookingFilterStatus("COMPLETED")}
                aria-pressed={bookingFilterStatus === "COMPLETED"}
                className={`text-sm font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  bookingFilterStatus === "COMPLETED"
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                Completada
              </button>
              {/* ACTIVE y COMPLETED ya no son opciones: viven en los botones de
                  arriba. Un <select> cuyo value no existe entre sus <option>
                  muestra el PRIMERO, así que sin este placeholder el desplegable
                  diría "Todos los estados" mientras el filtro real es Activas. */}
              <select
                value={STATUS_BUTTONS.includes(bookingFilterStatus) ? BUTTON_OWNED : bookingFilterStatus}
                onChange={(e) => setBookingFilterStatus(e.target.value)}
                className="text-xs sm:text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value={BUTTON_OWNED} disabled>Más estados…</option>
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="CONFIRMED">Agendada</option>
                <option value="NO_SHOW">No asistió</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
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
                  const isExpanded = expandedIds.has(booking.id);
                  const contacto = resolverContacto(booking);

                  return (
                    <div
                      key={booking.id}
                      onClick={() => toggleExpanded(booking.id)}
                      className={`border border-gray-200 rounded-lg p-3 cursor-pointer ${isExpanded ? "bg-gray-50" : ""}`}
                    >
                      {/* Row 1: name + status */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="font-medium text-gray-900 text-sm">{booking.patientName}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <BookingStatusBadge
                            status={booking.status}
                            colorClass={colorClass}
                            slotEndTime={endTime}
                            slotDate={bookingDate}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(booking.id); }}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Ocultar acciones de ${booking.patientName}` : `Ver acciones de ${booking.patientName}`}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: date + time range (+ el bloqueo, que es del mismo concepto) */}
                      <p className="text-xs text-gray-600 mb-1">
                        {formatLocalDate(bookingDate, { month: "short", day: "numeric", year: "numeric" })}
                        {startTime && ` · ${startTime}`}
                        {endTime && `–${endTime}`}
                      </p>
                      {isExpanded && booking.status === "CONFIRMED" && (
                        <StopClick className="mb-2">
                          <ExtendedBlockControl booking={booking} onUpdate={onUpdateExtendedBlock} />
                        </StopClick>
                      )}

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
                        <FacturaCheckbox booking={booking} onChange={onUpdateFacturaSolicitada} />
                      </div>

                      {/* Row 4: contact */}
                      <div className="flex flex-col gap-0.5 text-xs text-gray-500 mb-2">
                        {contacto.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 shrink-0" />
                            {contacto.phone}
                          </span>
                        )}
                        {contacto.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 shrink-0" />
                            {contacto.email}
                          </span>
                        )}
                        {/* div, not span: PriceCell renders a <div> while editing, and a
                            <div> inside a <span> is invalid nesting (validateDOMNesting) */}
                        <StopClick className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <PriceCell booking={booking} onUpdatePrice={onUpdatePrice} />
                        </StopClick>
                      </div>

                      {/* Row 5: expediente */}
                      <StopClick className="mb-2">
                        <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
                      </StopClick>

                      {isExpanded && (
                        /* StopClick obligatorio: la tarjeta entera es el toggle, y
                           StatusActions rinde el CompleteBookingModal AQUÍ DENTRO. Sin
                           esto, cualquier clic en el modal burbujea, colapsa la tarjeta
                           y desmonta el modal a media captura. */
                        <StopClick className="border-t border-gray-200 pt-2">
                          <StatusActions
                            booking={booking}
                            onUpdateStatus={onUpdateStatus}
                            onDeleteBooking={onDeleteBooking}
                            onOpenFormLinkModal={onOpenFormLinkModal}
                            onDeleteFormLink={onDeleteFormLink}
                            onSendEmail={onSendEmail}
                            onReschedule={onReschedule}
                            onCompleteBooking={onCompleteBooking}
                            onEmitCfdi={onEmitCfdi}
                          />
                        </StopClick>
                      )}
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
                          PACIENTE · SERVICIO <SortIcon column="patient" sortColumn={sortColumn} sortDirection={sortDirection} />
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
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">EXPEDIENTE · CONTACTO</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">PRECIO</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">
                        <button
                          onClick={() => onSort("status")}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          ESTADO <SortIcon column="status" sortColumn={sortColumn} sortDirection={sortDirection} />
                        </button>
                      </th>
                      {/* Las acciones ya no son columnas: viven en la fila que se
                          despliega al hacer clic. Esta última columna es el chevron. */}
                      <th className="w-8 py-2 px-3" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredBookings.map((booking) => {
                      const bookingDate = booking.slot?.date ?? booking.date ?? "";
                      const endTime = booking.slot?.endTime ?? booking.endTime ?? undefined;
                      const colorClass = getStatusColor(booking.status, endTime, bookingDate);
                      const isExpanded = expandedIds.has(booking.id);
                      const contacto = resolverContacto(booking);

                      return (
                        <Fragment key={booking.id}>
                        <tr
                          onClick={() => toggleExpanded(booking.id)}
                          className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? "bg-gray-50" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <p className="font-medium text-gray-900">{booking.patientName}</p>
                            {booking.serviceName && (
                              <p className="text-xs text-gray-600 mt-0.5">{booking.serviceName}</p>
                            )}
                            {booking.isFirstTime === true && (
                              <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">Primera vez</span>
                            )}
                            {booking.isFirstTime === false && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">Recurrente</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-600 align-top">
                            <p>{formatLocalDate(bookingDate, { month: "short", day: "numeric", year: "numeric" })}</p>
                            <p className="text-xs">{booking.slot?.startTime ?? booking.startTime ?? ""}</p>
                            {/* El bloqueo es un hecho de TIEMPO: vive bajo la fecha/hora que
                                modifica, no en un grupo de acciones aparte. Solo al expandir,
                                para no volver a llenar la fila colapsada. StopClick porque la
                                fila entera es el toggle. */}
                            {isExpanded && booking.status === "CONFIRMED" && (
                              <StopClick className="mt-1.5">
                                <ExtendedBlockControl booking={booking} onUpdate={onUpdateExtendedBlock} />
                              </StopClick>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <StopClick>
                              <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
                            </StopClick>
                            {contacto.phone && (
                              <p className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                                <Phone className="w-3 h-3" /> {contacto.phone}
                              </p>
                            )}
                            {/* Guarded like the mobile card: patientEmail is NOT NULL in the
                                schema but empty when the doctor doesn't require it (see
                                emailRequired in bookings/instant) — ~40% of rows in prod.
                                Unguarded, those render a mail icon pointing at nothing.
                                break-all: a long email is one unbreakable word and would
                                dictate the merged column's min width otherwise */}
                            {contacto.email && (
                              <p className="flex items-start gap-1 text-xs text-gray-500 mt-0.5">
                                <Mail className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="break-all">{contacto.email}</span>
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <StopClick>
                              <PriceCell booking={booking} onUpdatePrice={onUpdatePrice} />
                            </StopClick>
                            <div className="mt-1.5">
                              <FacturaCheckbox booking={booking} onChange={onUpdateFacturaSolicitada} />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <BookingStatusBadge
                              status={booking.status}
                              colorClass={colorClass}
                              slotEndTime={endTime}
                              slotDate={bookingDate}
                            />
                          </td>
                          <td className="py-3 px-3 align-middle">
                            {/* Botón real (no solo el clic de la fila) para que el
                                teclado y los lectores de pantalla puedan abrirla.
                                stopPropagation: si no, el clic dispara el toggle del
                                botón Y el de la fila, y se cancelan entre sí. */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(booking.id); }}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Ocultar acciones de ${booking.patientName}` : `Ver acciones de ${booking.patientName}`}
                              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="px-3 pb-3 pt-0">
                              <StatusActions
                                booking={booking}
                                layout="expanded"
                                onUpdateStatus={onUpdateStatus}
                                onDeleteBooking={onDeleteBooking}
                                onOpenFormLinkModal={onOpenFormLinkModal}
                                onDeleteFormLink={onDeleteFormLink}
                                onSendEmail={onSendEmail}
                                onReschedule={onReschedule}
                                onCompleteBooking={onCompleteBooking}
                                onEmitCfdi={onEmitCfdi}
                              />
                            </td>
                          </tr>
                        )}
                        </Fragment>
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

function PriceCell({
  booking,
  onUpdatePrice,
}: {
  booking: Booking;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(booking.finalPrice)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setValue(String(Number(booking.finalPrice)));
  }, [booking.finalPrice, editing]);

  const handleSave = async () => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) { setEditing(false); return; }
    setSaving(true);
    await onUpdatePrice(booking.id, price);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditing(false); setValue(String(Number(booking.finalPrice))); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          step="0.01"
          min="0"
          className="w-20 px-1.5 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click para editar precio"
      className="group flex items-center gap-1 text-sm text-gray-700 hover:text-blue-600 transition-colors"
    >
      ${Number(booking.finalPrice).toLocaleString()}
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
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
  // Hooks must run before the "no start time" bail-out below. A component that
  // returns null on one render and calls hooks on the next throws "Rendered more
  // hooks than during the previous render", and with no error.tsx anywhere in this
  // app that blanks the whole page, not one row.
  // Today it cannot fire: this only renders for CONFIRMED bookings, and the 21
  // prod rows with slot_id + start_time both null are all terminal
  // (CANCELLED/NO_SHOW/COMPLETED). But those 21 prove nothing enforces
  // "freeform => start_time is set", so the guard stays and the hooks stay above it.
  const rawStartTime = booking.slot?.startTime ?? booking.startTime ?? null;
  const slotDuration = booking.slot?.duration ?? booking.duration ?? 60;
  const startMin = rawStartTime ? timeToMins(rawStartTime) : 0;
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
    // NaN guard: an emptied <input type="time"> yields NaN, and `NaN <= startMin`
    // is false — it would slip through and PATCH extendedBlockMinutes as null,
    // silently wiping the doctor's custom block instead of rejecting the input.
    if (!Number.isFinite(endMin) || endMin <= startMin) return;
    setSaving(true);
    await onUpdate(booking.id, endMin - startMin);
    setSaving(false);
    setEditing(false);
  };

  // Bail-out moved below the hooks — see the note above.
  if (!rawStartTime) return null;
  const startTime = rawStartTime;

  const isCustom = booking.extendedBlockMinutes != null && booking.extendedBlockMinutes !== slotDuration;

  // Mismo criterio que handleSave, pero expuesto en el botón: rechazar en silencio
  // se lee como "la app no me deja hacer clic" (pasó en la prueba en vivo). El guard
  // de handleSave se queda igual — esto es la versión visible, no el reemplazo.
  const draftEndMin = timeToMins(value);
  const isDraftValid = Number.isFinite(draftEndMin) && draftEndMin > startMin;

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
          {/* El title va en el wrapper, no en el <button>: un control deshabilitado
              no dispara eventos de mouse en Chrome/Safari, así que su tooltip nativo
              nunca aparecería — justo la explicación que hace falta. */}
          <span
            className="inline-flex"
            title={!isDraftValid ? `La hora de fin debe ser posterior a ${startTime}` : undefined}
          >
            <button
              onClick={handleSave}
              disabled={saving || !isDraftValid}
              className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "..." : "OK"}
            </button>
          </span>
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
    const hasSubmittedForm = booking.formLink?.status === 'SUBMITTED';
    return (
      <div className="flex items-center gap-1">
        <Link
          href={`/dashboard/medical-records/patients/${booking.patientId}`}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <UserSquare2 className="w-3 h-3 shrink-0" />
          {booking.patient.firstName} {booking.patient.lastName}
        </Link>
        <button
          title={hasSubmittedForm ? "Desvincular el formulario recibido primero" : "Desvincular expediente"}
          onClick={() => !hasSubmittedForm && onUpdatePatientLink(booking.id, null, null)}
          disabled={hasSubmittedForm}
          className={`p-0.5 rounded ${hasSubmittedForm ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // No expediente linked — ALWAYS offer both search-existing and create-new. isFirstTime is
  // only a hint for ordering: it used to gate which option appeared, and citas created by the
  // agent (isFirstTime null) rendered a dead "—" with no way to link or create.
  const searchFirst = booking.isFirstTime === false;
  const searchEl = (
    <InlinePatientSearch
      onSelect={(patient) => onUpdatePatientLink(booking.id, patient.id, patient)}
    />
  );
  const createEl = (
    <button
      onClick={() => setShowCreateModal(true)}
      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap"
    >
      + Crear expediente
    </button>
  );
  return (
    <div className="flex flex-col items-start gap-1">
      {searchFirst ? searchEl : createEl}
      {searchFirst ? createEl : searchEl}
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
    </div>
  );
}

function StatusActions({
  booking,
  onUpdateStatus,
  onDeleteBooking,
  onOpenFormLinkModal,
  onDeleteFormLink,
  onSendEmail,
  onReschedule,
  onCompleteBooking,
  onEmitCfdi,
  layout = "card",
}: {
  booking: Booking;
  /**
   * "table" renders TWO <td> cells (gestión · comunicación/cobro) — ya no se usa en
   * la tabla, que ahora despliega las acciones en su propia fila con "expanded";
   * se conserva porque el contrato de dos <td> sigue siendo válido.
   * "expanded" = los 6 grupos en rejilla. "card" = apilados (móvil).
   */
  layout?: "card" | "table" | "expanded";
  onUpdateStatus: (id: string, status: string) => void;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onDeleteFormLink: (bookingId: string) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  onCompleteBooking: (id: string, price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
  onEmitCfdi?: (params: import("./CompleteBookingModal").CfdiParams) => Promise<{ success: boolean; error?: string }>;
}) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
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

  // COMPLETADA significa "el doctor ya vio al paciente", no "el asunto se cerró": el dinero y
  // el papeleo siguen abiertos. Por eso Cobro y Documentos sobreviven a completar, y Estado /
  // Comunicación / Horario no (estado terminal sin vuelta atrás, no hay confirmación que
  // reenviar, no hay agenda futura que bloquear).
  //
  // Además el prompt del agente YA daba esto por hecho en dos sitios, y no era cierto:
  //   · facturas.ts get_payment_links → "el flujo recomendado es crearlos desde la cita
  //     (botón Cobro)" — el botón desaparecía justo al completar.
  //   · agenda.ts AGENDA_CITAS_RULES → "la factura se emite desde la tabla de citas" — para eso
  //     hace falta el botón de Datos fiscales, que vivía en Documentos y también desaparecía.
  // Misma familia que bitácora #26/#27 (prosa que enruta a algo inalcanzable) pero en el eje de
  // ESTADO, que `gate:prosa` no mira: ese gate razona por scope, no por estado de la cita.
  const isCompleted = booking.status === "COMPLETED";
  const showStatusGroup = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const showCommsGroup = booking.status === "CONFIRMED";

  // El formulario es PREVIO a la consulta: en una cita ya completada "Crear formulario"
  // mandaría un enlace que isFormLinkExpired marca vencido de inmediato (la fecha del slot ya
  // pasó). Se conserva solo el estado SUBMITTED, que es un enlace de LECTURA al formulario
  // que el paciente ya contestó.
  const showFormularioButton =
    booking.status === "CONFIRMED" || booking.formLink?.status === "SUBMITTED";
  // El botón de Facturación solo aparece si el doctor marcó la casilla "Factura" de ESTA
  // cita. Desmarcada = la fila se comporta como siempre, sin nada de facturación.
  // Además espeja el guard interno de FiscalFormButton (`if (!booking.patientId) return
  // null`): sin expediente vinculado ese botón no rinde nada y el grupo quedaría como un
  // encabezado "Documentos" vacío. Si aquel guard cambia, éste tiene que cambiar con él.
  const showFiscalButton = !!booking.patientId && !!booking.facturaSolicitada;
  const showDocsGroup =
    booking.status === "CONFIRMED" ||
    (isCompleted && (showFiscalButton || booking.formLink?.status === "SUBMITTED"));
  // Cobro: citas activas y COMPLETADAS siempre; canceladas/no-asistió solo con link PAGADO o
  // ACTIVO (un link viejo desactivado y no pagado NO debe reabrir el botón de crear sobre una
  // cita que nunca ocurrió). Ese guard se conserva tal cual para esos dos estados.
  const hasRelevantPaymentLink =
    booking.paymentLink?.status === "PAID" ||
    booking.mpPaymentPreference?.status === "PAID" ||
    booking.paymentLink?.isActive ||
    booking.mpPaymentPreference?.isActive;
  const showCobroGroup = !isTerminal || isCompleted || !!hasRelevantPaymentLink;

  const modal = completeModalOpen && (
    <CompleteBookingModal
      booking={booking}
      onClose={() => setCompleteModalOpen(false)}
      onConfirm={async (price, formaDePago) => {
        const result = await onCompleteBooking(booking.id, price, formaDePago);
        return result || {};
      }}
      onEmitCfdi={onEmitCfdi}
    />
  );

  const estadoGroup = showStatusGroup && (
        <div className="pt-2 first:pt-0">
          <span className="hidden sm:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Estado</span>
          <div className="flex gap-1 flex-wrap">
            {booking.status === "PENDING" && (
              <button
                onClick={() => onUpdateStatus(booking.id, "CONFIRMED")}
                className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
              >
                Confirmar
              </button>
            )}
            <button
              onClick={() => setCompleteModalOpen(true)}
              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
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
            {canReschedule && (
              <button
                onClick={() => onReschedule(booking)}
                className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1"
              >
                <CalendarClock className="w-3 h-3" />
                Reagendar
              </button>
            )}
          </div>
        </div>
      );

  // CONFIRMACIÓN — dos canales para el MISMO mensaje: la confirmación de la cita.
  //
  // Correo: el envío es automático al crear/confirmar la cita
  // (lib/send-confirmation-email, enchufado en las 5 rutas de creación), pero solo ocurre
  // si hay correo Y el doctor tiene Gmail conectado. Medido en prod sobre las 104 citas
  // CONFIRMED: 54 con envío, 33 sin correo siquiera, y 17 CON correo y sin envío. Por eso
  // "Enviar" sigue existiendo — no es una opción de diseño, son 17 citas reales que si no
  // mostrarían un "Reenviar" que no reenvía nada.
  //
  // WhatsApp: NO hay API — es un enlace wa.me que abre el chat con el mensaje listo y el
  // doctor presiona enviar. Por eso nunca dice "reenviar" ni tiene estado de "ya enviado":
  // nada de nuestro lado se entera de que se mandó.
  // Cita primero, expediente de respaldo — MISMO orden que resuelve el servidor
  // (send-email/route.ts y lib/send-confirmation-email.ts). Si divergen, el botón
  // prometería un envío que la API rechaza, o al revés.
  const emailDestino = booking.patientEmail?.trim() || booking.patient?.email?.trim() || "";
  const waDestino = waNumber(booking.patientWhatsapp || booking.patientPhone || booking.patient?.phone);
  const yaEnviado = !!booking.confirmationEmailSentAt;
  const ultimoEnvio = booking.confirmationEmailSentAt
    ? new Date(booking.confirmationEmailSentAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  const esTelemedicina = booking.appointmentMode === "TELEMEDICINA";

  // El dato de contacto vive en el expediente, así que "Necesita …" lleva ahí. Sin
  // expediente vinculado no hay a dónde ir: queda informativo y dice qué hacer antes.
  const faltaContacto = (que: string) =>
    booking.patientId ? (
      <Link
        href={`/dashboard/medical-records/patients/${booking.patientId}`}
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 hover:text-gray-700 flex items-center gap-1"
        title={`Agrega ${que} en el expediente del paciente`}
      >
        <AlertCircle className="w-3 h-3" /> Necesita {que}
      </Link>
    ) : (
      <span
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-400 border border-gray-200 flex items-center gap-1"
        title={`Vincula el expediente para poder capturar ${que}`}
      >
        <AlertCircle className="w-3 h-3" /> Necesita {que}
      </span>
    );

  const mensajeWhatsApp = [
    `Hola ${booking.patientName}, te confirmamos tu cita`,
    bookingDate ? ` el ${formatLocalDate(bookingDate, { weekday: "long", day: "numeric", month: "long" })}` : "",
    booking.slot?.startTime ?? booking.startTime ? ` a las ${booking.slot?.startTime ?? booking.startTime}` : "",
    ".",
    booking.meetLink ? ` Enlace de la videoconsulta: ${booking.meetLink}` : "",
  ].join("");

  const comunicacionGroup = showCommsGroup && (
        <div className="pt-2 first:pt-0">
          <span className="hidden sm:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Confirmación</span>
          <div className="flex gap-1 flex-wrap">
            {!emailDestino ? (
              faltaContacto("correo")
            ) : (
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                title={
                  ultimoEnvio
                    ? `Último envío: ${ultimoEnvio}${esTelemedicina && booking.meetLink ? " · Meet creado" : ""}`
                    : esTelemedicina
                      ? "Crear Google Meet y enviar la confirmación al paciente"
                      : "Enviar la confirmación de la cita al paciente"
                }
                className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : yaEnviado ? (
                  <CheckCircle className="w-3 h-3 text-teal-600" />
                ) : esTelemedicina ? (
                  <Video className="w-3 h-3" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                {isSendingEmail ? "Enviando..." : yaEnviado ? "Reenviar confirmación" : "Enviar confirmación"}
              </button>
            )}

            {!waDestino ? (
              faltaContacto("WhatsApp")
            ) : (
              <a
                href={`https://wa.me/${waDestino}?text=${encodeURIComponent(mensajeWhatsApp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1"
                title="Abre WhatsApp con la confirmación lista para enviar"
              >
                <MessageCircle className="w-3 h-3" /> Confirmación por WhatsApp
              </a>
            )}

            {esTelemedicina && booking.meetLink && (
              <a
                href={booking.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1"
                title="Abrir Google Meet"
              >
                <ExternalLink className="w-3 h-3" />
                Entrar a Meet
              </a>
            )}
          </div>
        </div>
      );

  const cobroGroup = showCobroGroup && (
        <div className="pt-2 first:pt-0">
          <span className="hidden sm:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Cobro</span>
          {/* Mismo respaldo que el envío y la fila: si el correo/teléfono solo viven en
              el expediente, el link de pago debe poder pre-llenarlos igual. */}
          <PaymentLinkButton
            bookingId={booking.id}
            patientId={booking.patientId}
            patientName={booking.patientName}
            patientPhone={resolverContacto(booking).phone || null}
            patientWhatsapp={booking.patientWhatsapp}
            patientEmail={resolverContacto(booking).email || undefined}
            defaultAmount={booking.finalPrice}
            defaultDescription={booking.serviceName ? `${booking.serviceName} - ${booking.patientName}` : `Consulta - ${booking.patientName}`}
            stripeLink={booking.paymentLink ? {
              status: booking.paymentLink.status,
              isActive: booking.paymentLink.isActive,
              url: booking.paymentLink.stripePaymentLinkUrl,
              paidAt: booking.paymentLink.paidAt,
              amount: booking.paymentLink.amount,
            } : null}
            mpLink={booking.mpPaymentPreference ? {
              status: booking.mpPaymentPreference.status,
              isActive: booking.mpPaymentPreference.isActive,
              url: booking.mpPaymentPreference.mpInitPoint,
              paidAt: booking.mpPaymentPreference.paidAt,
              amount: booking.mpPaymentPreference.amount,
            } : null}
          />
        </div>
      );

  const documentosGroup = showDocsGroup && (
        <div className="pt-2 first:pt-0">
          <span className="hidden sm:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Documentos</span>
          <div className="flex gap-1 flex-wrap">
            {showFormularioButton && (
              <FormularioStatusButton
                booking={booking}
                onCreateForm={() => onOpenFormLinkModal(booking)}
                onDeleteForm={() => onDeleteFormLink(booking.id)}
              />
            )}
            {showFiscalButton && <FiscalFormButton booking={booking} />}
          </div>
        </div>
      );

  const eliminarGroup = isTerminal && (
        <div className="pt-2 first:pt-0">
          <button
            onClick={() => onDeleteBooking(booking.id, booking.patientName)}
            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            Eliminar
          </button>
        </div>
      );

  // Expanded layout: los 6 grupos en rejilla, dentro de la fila desplegable de la
  // tabla. Los grupos falsos (su condición no aplica) no rinden celda vacía porque
  // React ignora `false`.
  if (layout === "expanded") {
    return (
      <>
        {modal}
        {/* [&>div]:pt-0 — los grupos traen `pt-2 first:pt-0`, pensado para la pila
            del móvil. En rejilla eso solo quitaría el padding al PRIMER grupo, así que
            el 2º y 3º de la fila superior quedarían 8px más abajo. Aquí se normaliza. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 border-t border-gray-200 pt-3 [&>div]:pt-0">
          {estadoGroup}
          {comunicacionGroup}
          {cobroGroup}
          {documentosGroup}
          {eliminarGroup}
        </div>
      </>
    );
  }

  // Table layout: two cells — gestión (Estado/Documentos/Horario/Eliminar) and
  // contacto-cobro (Comunicación/Cobro) — so the row stays short.
  if (layout === "table") {
    return (
      <>
        <td className="py-3 px-3 align-top">
          {modal}
          <div className="flex flex-col gap-2 divide-y divide-gray-100">
            {estadoGroup}
            {documentosGroup}
            {eliminarGroup}
          </div>
        </td>
        <td className="py-3 px-3 align-top">
          <div className="flex flex-col gap-2 divide-y divide-gray-100">
            {comunicacionGroup}
            {cobroGroup}
          </div>
        </td>
      </>
    );
  }

  // Card layout (mobile): all groups stacked
  return (
    <>
      {modal}
      <div className="flex flex-col gap-2 divide-y divide-gray-100">
        {estadoGroup}
        {comunicacionGroup}
        {cobroGroup}
        {documentosGroup}
        {eliminarGroup}
      </div>
    </>
  );
}
