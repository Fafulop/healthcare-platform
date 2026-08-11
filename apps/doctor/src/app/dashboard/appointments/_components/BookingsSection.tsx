import { Calendar, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, Mail, DollarSign, ChevronsUpDown, MapPin } from "lucide-react";
import { useState, Fragment } from "react";
import { formatLocalDate } from "@/lib/dates";
import { resolverContacto } from "@/lib/booking-contact";
import { BookingStatusBadge } from "./BookingStatusBadge";
// Los controles de UNA cita viven en `BookingActions.tsx` desde que el modal del
// calendario necesitó los mismos: una sola definición para las TRES superficies.
import {
  StopClick,
  FacturaCheckbox,
  PriceCell,
  ExtendedBlockControl,
  ExpedienteCell,
  StatusActions,
} from "./BookingActions";
import { defaultBookingFilterDate } from "../_hooks/useBookings";
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

/** Estados con botón propio en la barra de filtros — se excluyen del desplegable. */
const STATUS_BUTTONS = ["ACTIVE", "COMPLETED"];
/** Valor centinela del desplegable cuando el estado lo controla un botón. */
const BUTTON_OWNED = "__button__";

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
              {/* Toca SOLO la fecha. Antes también reseteaba estado y paciente,
                  pero con "Activas"/"Completada" al lado eso rompería la consulta
                  más útil: completadas + todas las fechas.
                  Es un INTERRUPTOR: ya se pintaba como activo (`aria-pressed`) pero no
                  tenía vuelta — apagarlo devuelve la tabla al día de HOY, que es el estado
                  con el que se entra a la página. */}
              <button
                onClick={() =>
                  setBookingFilterDate(bookingFilterDate ? "" : defaultBookingFilterDate())
                }
                title={bookingFilterDate ? "Ver todas las fechas" : "Volver a hoy"}
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
            {(bookingFilterDate !== defaultBookingFilterDate() || bookingFilterPatient || bookingFilterStatus !== "ACTIVE") && (
              <button
                onClick={() => {
                  setBookingFilterDate(defaultBookingFilterDate());
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

                      {/* Row 3: service + consultorio + badges */}
                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {booking.serviceName && (
                          <span className="text-xs text-blue-600 font-medium">{booking.serviceName}</span>
                        )}
                        {/* El consultorio, SÓLO cuando se sabe. `null` = no registrado
                            (ninguna cita anterior al 2026-08-06 lo guardó: 412 de 425
                            medidas en prod), y NO significa "el de siempre" — hay 3
                            doctores con más de una sede. Repetir "sin consultorio" en
                            el 97% de las tarjetas no informaría nada. */}
                        {booking.location && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {booking.location.name}
                          </span>
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
                  {/* Sin `divide-y`: ponía la MISMA línea entre dos citas distintas y entre una
                      cita y su propia fila desplegada, así que una cita abierta se leía como dos.
                      Ahora el borde lo pone cada cita al final de su bloque (ver más abajo), y es
                      lo bastante marcado para saber dónde termina una fila y empieza la otra. */}
                  <tbody>
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
                          /* El borde cierra la CITA, no la fila: abierta, la línea va hasta
                             después del panel de acciones para que ambas se lean como una sola. */
                          className={`cursor-pointer hover:bg-gray-50 ${
                            isExpanded ? "bg-gray-50" : "border-b border-gray-200 last:border-b-0"
                          }`}
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
                          <tr className="bg-gray-50 border-b border-gray-200 last:border-b-0">
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

