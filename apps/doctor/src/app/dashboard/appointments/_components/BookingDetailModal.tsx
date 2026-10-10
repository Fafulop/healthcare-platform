"use client";

/**
 * Modal de UNA cita, el que abre al hacer clic en su bloque del calendario.
 *
 * No reimplementa ninguna acción: rinde exactamente los mismos componentes que la fila
 * desplegada de la tabla —`StatusActions` más los cuatro controles que viven fuera de él
 * (expediente · precio · ¿necesita factura? · bloqueo extendido)— importados de
 * `BookingActions.tsx`. Es la TERCERA superficie de esos controles, no una copia: una copia
 * derivaría en cuanto alguien tocara la tabla y no esto.
 *
 * ⚠️ **Modal dentro de modal.** `StatusActions` rinde `CompleteBookingModal` DENTRO de sí
 * mismo, y `ExpedienteCell` rinde `CreatePatientFromBookingModal`: los dos son hijos del DOM
 * de este modal, así que cualquier clic suyo burbujea hasta aquí. Por eso el clic en el fondo
 * sólo cierra cuando ocurrió en el fondo MISMO (`target === currentTarget`).
 *
 * Precisión sobre ese guard, para no atribuirle un mérito que no tiene: hoy **ningún** modal
 * de esta carpeta cierra al clicar su propio fondo (se verificó en los dos internos), así que
 * la cadena "cierro el interno por su fondo → burbujea → se desmonta el de la cita a media
 * captura" **no puede ocurrir todavía**. Lo que el guard sí evita hoy es que soltar un
 * arrastre fuera del panel cierre el modal a media edición. Se queda porque el día que
 * alguien le ponga cierre-por-fondo al modal interno —que es lo natural— el bug aparecería
 * sin que nada lo delate: es exactamente el que `StopClick` existe para evitar en la tarjeta
 * móvil, y ahí sí llegó a ocurrir.
 */

import { X, MapPin } from "lucide-react";
import { formatLocalDate } from "@/lib/dates";
import { resolveBookingTime } from "../_lib/event-model";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { SesionDeLaCita } from "@/components/medical-records/tratamientos/SesionDeLaCita";
import { TarjetaDeCita } from "./TarjetaDeCita";
import type { Booking } from "../_hooks/useBookings";

interface Props {
  booking: Booking;
  onClose: () => void;
  getStatusColor: (status: string, endTime?: string, date?: string) => string;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateExtendedBlock: (id: string, extendedBlockMinutes: number | null) => Promise<void>;
  onUpdateFacturaSolicitada: (id: string, facturaSolicitada: boolean) => void;
  onUpdatePatientLink: (bookingId: string, patientId: string | null, patient: { id: string; firstName: string; lastName: string } | null) => void;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onDeleteBooking: (id: string, patientName: string) => void;
  onOpenFormLinkModal: (booking: Booking) => void;
  onDeleteFormLink: (bookingId: string) => void;
  onSendEmail: (id: string) => Promise<void>;
  onReschedule: (booking: Booking) => void;
  onCompleteBooking: (id: string, price: number, formaDePago: string) => Promise<{ ledgerEntryId?: number }>;
}

export function BookingDetailModal({
  booking, onClose, getStatusColor,
  onUpdateStatus, onUpdateExtendedBlock, onUpdateFacturaSolicitada, onUpdatePatientLink,
  onUpdatePrice, onDeleteBooking, onOpenFormLinkModal, onDeleteFormLink, onSendEmail,
  onReschedule, onCompleteBooking,
}: Props) {
  // Fecha/hora por el resolvedor compartido: las citas tienen DOS formas (con `slot` y
  // libres) y derivarlo aquí a mano es cómo una vista pierde citas en silencio.
  const tiempo = resolveBookingTime(booking);

  return (
    // El scroll vive en el FONDO, no en el panel. Con `overflow-y-auto` en el panel, la
    // lista de resultados de `InlinePatientSearch` (absolute, dentro de la sección
    // Expediente) quedaba RECORTADA por él: `overflow` recorta a sus descendientes
    // absolutos aunque la caja no necesite scroll, y en una cita sin acciones —una NO_SHOW
    // sin expediente sólo rinde "Eliminar"— el panel mide ~300px y se comía media lista.
    // En la tabla no pasa porque ahí no hay ningún ancestro con overflow.
    // `min-h-full` + centrado en el hijo es lo que evita el otro fallo clásico del par
    // "fondo scrollable + items-center": un panel más alto que la pantalla se queda con el
    // encabezado cortado y sin forma de subir.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl">
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{booking.patientName}</h2>
              <BookingStatusBadge
                status={booking.status}
                colorClass={getStatusColor(booking.status, tiempo?.endTime, tiempo?.date)}
                slotEndTime={tiempo?.endTime}
                slotDate={tiempo?.date}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {tiempo
                ? `${formatLocalDate(tiempo.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${tiempo.startTime}–${tiempo.endTime}`
                : "Sin fecha y hora"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {booking.serviceName && (
                <span className="text-xs text-blue-600 font-medium">{booking.serviceName}</span>
              )}
              {/* El consultorio, SÓLO cuando se sabe — mismo criterio que la tarjeta.
                  `null` = no registrado, NO "el de siempre" (ver `Booking.locationId`
                  en el schema: adivinar el default manda al paciente al hospital
                  equivocado en las sedes múltiples). */}
              {booking.location && (
                <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {booking.location.name}
                </span>
              )}
              <SesionDeLaCita patientId={booking.patientId} sesion={booking.tratamientoSesion} />
              {booking.appointmentMode === "TELEMEDICINA" && (
                <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Telemedicina</span>
              )}
              {/* Se muestra porque EXPLICA la sección Expediente de abajo: en una cita de
                  Primera vez sólo se ofrece crear, y sin esta etiqueta la ausencia del
                  buscador parece un fallo. */}
              {booking.isFirstTime === true && (
                <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Primera vez</span>
              )}
              {booking.isFirstTime === false && (
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Recurrente</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* El cuerpo es `TarjetaDeCita` (10-PLAN P1): el mismo que pintan la visita y la sesión. */}
          <TarjetaDeCita
            booking={booking}
            onUpdateStatus={onUpdateStatus}
            onUpdateExtendedBlock={onUpdateExtendedBlock}
            onUpdateFacturaSolicitada={onUpdateFacturaSolicitada}
            onUpdatePatientLink={onUpdatePatientLink}
            onUpdatePrice={onUpdatePrice}
            onDeleteBooking={onDeleteBooking}
            onOpenFormLinkModal={onOpenFormLinkModal}
            onDeleteFormLink={onDeleteFormLink}
            onSendEmail={onSendEmail}
            onReschedule={onReschedule}
            onCompleteBooking={onCompleteBooking}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
