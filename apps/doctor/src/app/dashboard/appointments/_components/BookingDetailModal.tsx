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
import { NotasCita, tieneNotas } from "@/components/citas/NotasCita";
import { formatLocalDate } from "@/lib/dates";
import { resolverContacto } from "@/lib/booking-contact";
import { resolveBookingTime } from "../_lib/event-model";
import { BookingStatusBadge } from "./BookingStatusBadge";
import {
  StatusActions,
  ExpedienteCell,
  PriceCell,
  FacturaCheckbox,
  ExtendedBlockControl,
} from "./BookingActions";
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

/** Etiqueta de una sección del cuerpo — mismo tono que los rótulos de `StatusActions`. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
      {children}
    </span>
  );
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
  const contacto = resolverContacto(booking);

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

        <div className="p-5 space-y-4">
          {/* Expediente · contacto. El contacto sale de `resolverContacto`, o sea el
              EXPEDIENTE manda y la copia de la cita es el respaldo (decisión #30) — la
              misma función que usan la fila, el link de pago y el botón fiscal. */}
          <div>
            <SectionLabel>Expediente</SectionLabel>
            <ExpedienteCell booking={booking} onUpdatePatientLink={onUpdatePatientLink} />
            {(contacto.phone || contacto.email) && (
              <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-gray-500">
                {contacto.phone && <span>{contacto.phone}</span>}
                {contacto.email && <span className="break-all">{contacto.email}</span>}
              </div>
            )}
          </div>

          {/* Notas de la cita — lo que el doctor escribió al agendarla. Van ARRIBA de
              precio/factura porque son contexto clínico ("seguimiento Wegovy"), no un
              dato administrativo, y hasta hoy no se veían en NINGUNA pantalla.
              `trim()`: en prod hay 29 citas con notes = "", y una sección vacía se lee
              como un error de carga. */}
          {tieneNotas(booking.notes) && (
            <div>
              <SectionLabel>Notas</SectionLabel>
              {/* Ya hay rótulo (SectionLabel), así que el bloque va sin su etiqueta. */}
              <NotasCita notes={booking.notes} conEtiqueta={false} recortable={false} />
            </div>
          )}

          {/* Precio y la casilla, juntos como en la columna PRECIO de la tabla.
              La casilla va SIN rótulo, igual que allá: ya se rotula a sí misma ("¿Necesita
              factura?"), y un encabezado "Factura" aquí chocaría con el grupo FACTURA que
              rinde `StatusActions` más abajo — los dos aparecen a la vez en cuanto la
              casilla se marca, y el modal es angosto: dos secciones con el mismo nombre. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <SectionLabel>Precio</SectionLabel>
              <PriceCell booking={booking} onUpdatePrice={onUpdatePrice} />
            </div>
            <FacturaCheckbox booking={booking} onChange={onUpdateFacturaSolicitada} />
          </div>

          {/* Mismo gate que la tabla: el bloqueo sólo tiene sentido en una cita CONFIRMED
              (no hay agenda futura que ocupar en una terminal). */}
          {booking.status === "CONFIRMED" && (
            <div>
              <SectionLabel>Horario</SectionLabel>
              <ExtendedBlockControl booking={booking} onUpdate={onUpdateExtendedBlock} />
            </div>
          )}

          {/* Los 6 grupos de acciones, apilados: el modal es angosto, así que "card"
              (la pila del móvil) encaja mejor que la rejilla de 3 columnas. */}
          <div className="border-t border-gray-100 pt-3">
            <StatusActions
              booking={booking}
              layout="card"
              onUpdateStatus={onUpdateStatus}
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
    </div>
  );
}
